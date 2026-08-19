#!/usr/bin/env node
/**
 * AST-aware inventory of every source file that WRITES a legacy financial table.
 *
 * WHY AST AND NOT GREP (D-078 remediation).
 * The first shutdown attempt scoped itself by grepping for payment-session
 * creation and missed eleven writers, including two live provider webhooks. A
 * regex also cannot tell `.from("donations").select()` from
 * `.from("donations").insert()`, so it either under-reports writes or floods the
 * list with reads. This walks the real TypeScript AST and classifies each
 * `.from(<legacy table>)` chain by the mutating method actually called on it.
 *
 * Output: JSON { writers: [...], readers: [...] } sorted, for
 * `supabase/tests/legacy-writers.manifest.json` to be validated against.
 *
 * Deno files under supabase/functions are parsed too — they are TypeScript and
 * the Edge Function is a live writer.
 */
import ts from "typescript";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
/**
 * `payment_allocations` is included even though the shutdown brief named only
 * the other three.
 *
 * Recursive analysis of the production catalog found the trigger
 * `payment_allocations:trg_recompute_commitment_on_allocation` calls
 * `recompute_commitment_status_for()`, which is VOLATILE and UPDATEs
 * `financial_commitments`. So a write to `payment_allocations` is an INDIRECT
 * write to a retired table. Both of its current writers (record-offline and the
 * Stripe Edge Function) are already guarded, so nothing is open today — but
 * leaving the table untracked would let a future writer silently reopen the
 * path. It is tracked so that cannot happen quietly.
 */
export const LEGACY_TABLES = [
  "donations",
  "financial_commitments",
  "payment_tokens",
  "payment_allocations",
];
const MUTATORS = new Set(["insert", "update", "upsert", "delete"]);
/** Receivers whose `.from()` is a JS builtin, not a Supabase table selector. */
const JS_BUILTIN_FROM = new Set([
  "Array", "Buffer", "Object", "Uint8Array", "Int8Array", "Float32Array", "Float64Array", "Set", "Map",
]);
/**
 * Independent review found `components/` (95 source files, including
 * `components/dashboard/financials/`) was NOT scanned, so a browser-side write
 * planted there was certified clean by this gate. The directory list is now
 * audited against the filesystem below rather than trusted — a scope boundary
 * nobody is checking is exactly where the next writer hides.
 */
const SCAN_DIRS = ["app", "components", "lib", "supabase", "scripts", "public"];

/** Top-level directories that legitimately contain no scannable source. */
const IGNORED_TOP_LEVEL = new Set([
  "node_modules", ".next", "out", ".git", "docs", "ios", "android",
  ".vercel", ".claude", "coverage",
]);
/**
 * Scannable source extensions. Restricting this to .ts/.tsx/.mts was a hole:
 * Next.js compiles a `.js`/`.jsx`/`.mjs` route handler and ships it, so such a
 * file is a live, deployable money route that the gate could not see.
 * `allowJs: false` stops `tsc` — it does not stop the build.
 */
const SOURCE_EXT = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/;

/**
 * Anchored deliberately. The previous pattern was unanchored, so ANY directory
 * whose path merely contained "out" (e.g. `lib/out/`) was skipped wholesale and
 * a writer parked there was invisible.
 */
const SKIP = /(^|\/)node_modules(\/|$)|(^|\/)\.next(\/|$)/;

function walkFiles(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs)) {
    const rel = path.join(dir, e);
    if (SKIP.test(rel)) continue;
    const s = statSync(path.join(ROOT, rel));
    if (s.isDirectory()) walkFiles(rel, out);
    else if (SOURCE_EXT.test(e)) out.push(rel);
  }
  return out;
}

/**
 * The property name of a member access, whether written `x.from` or
 * `x["from"]`. Handling only the dot form was a hole: `db["from"]("donations")`
 * — one character different from an existing mutant — was invisible to the
 * entire gate and shipped as a deployable unguarded money route.
 */
function accessName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node)) {
    const a = node.argumentExpression;
    return a && ts.isStringLiteralLike(a) ? a.text : null;
  }
  return null;
}
const isMemberAccess = (n) =>
  ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n);

/** Unwrap `await x`, `(x)`, `x!`, `x as T` to reach the real expression. */
function unwrap(n) {
  while (
    ts.isAwaitExpression(n) ||
    ts.isParenthesizedExpression(n) ||
    ts.isNonNullExpression(n) ||
    ts.isAsExpression(n)
  ) n = n.expression;
  return n;
}

/**
 * Given a call like a.b.from("donations").insert(...), walk the callee chain
 * back to find a `.from(<legacy table>)` call. Returns the table or null.
 */
function tableOfChain(node) {
  let cur = node;
  for (let hops = 0; hops < 12 && cur; hops++) {
    cur = unwrap(cur);
    if (ts.isCallExpression(cur)) {
      const callee = unwrap(cur.expression);
      if (isMemberAccess(callee) && accessName(callee) === "from") {
        const arg = cur.arguments[0];
        if (arg && ts.isStringLiteralLike(arg) && LEGACY_TABLES.includes(arg.text)) {
          return arg.text;
        }
      }
      cur = callee;
      continue;
    }
    if (isMemberAccess(cur)) { cur = cur.expression; continue; }
    return null;
  }
  return null;
}

export function analyse(relFile) {
  const src = readFileSync(path.join(ROOT, relFile), "utf8");
  const sf = ts.createSourceFile(
    relFile,
    src,
    ts.ScriptTarget.Latest,
    true,
    /\.(tsx|jsx)$/.test(relFile)
      ? ts.ScriptKind.TSX
      : /\.(js|mjs|cjs)$/.test(relFile)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS,
  );
  const writes = new Set();
  const reads = new Set();
  const dynamicTables = new Set();
  const rpcCalls = new Set();
  let guarded = false;

  // A "use client" file executes in the browser, where no server flag can
  // intercept anything it does. Any legacy write here is unguardable by
  // construction, so it is reported separately and always fails the gate.
  const isClient = /^\s*["']use client["']/.test(src.slice(0, 200));

  /**
   * Does `node` sit inside a branch that can never run — `if (false)`, `if (0)`,
   * or the else-branch of `if (true)`? Independent review showed the previous
   * check accepted ANY occurrence of the guard identifier, so parking a dead
   * `if (false) { legacyPaymentsEnabled(); }` next to an unconditional write
   * made the file read as "guarded". A guard that cannot execute is not a guard.
   */
  const inDeadBranch = (node) => {
    for (let p = node.parent; p; p = p.parent) {
      // An import binding is not a call site. Counting it meant a file that
      // merely IMPORTED the guard read as guarded, which is how a dead-code
      // guard slipped past: the import alone satisfied the check.
      if (ts.isImportDeclaration(p) || ts.isImportSpecifier(p)) return true;
      if (ts.isIfStatement(p)) {
        const cond = p.expression.getText(sf).trim();
        const isFalse = cond === "false" || cond === "0";
        const isTrue = cond === "true" || cond === "1";
        // Reached via the never-taken side of a constant condition.
        const inThen = p.thenStatement && isWithin(node, p.thenStatement);
        const inElse = p.elseStatement && isWithin(node, p.elseStatement);
        if (isFalse && inThen) return true;
        if (isTrue && inElse) return true;
      }
    }
    return false;
  };
  const isWithin = (node, container) =>
    node.getStart(sf) >= container.getStart(sf) && node.getEnd() <= container.getEnd();

  /**
   * PER-HANDLER guard tracking.
   *
   * `guarded` used to be one boolean for the whole file, so adding a second
   * exported handler to an already-guarded route inherited its status: review
   * appended an unauthenticated DELETE that zeroes commitments and the gate
   * stayed green. Guarding is now attributed to the enclosing function, and a
   * handler counts as guarded if it — or any local function it transitively
   * calls — runs the guard. The call graph matters: `approve-member`'s GET is
   * guarded only via `handleApproval`.
   */
  const MODULE_SCOPE = "<module>";
  const HTTP_HANDLERS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
  const fnGuards = new Map();
  const fnWrites = new Map();
  const fnCalls = new Map();
  const exportedHandlers = new Set();

  const fnNameOf = (node) => {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
      if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
          p.parent && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) {
        return p.parent.name.text;
      }
      if (ts.isMethodDeclaration(p) && p.name && ts.isIdentifier(p.name)) return p.name.text;
    }
    return MODULE_SCOPE;
  };
  const mark = (map, key, val = true) => map.set(key, (map.get(key) || false) || val);

  // Which functions are exported HTTP handlers (or the default-export page)?
  sf.forEachChild((n) => {
    const isExported = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    const isDefault = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);

    // `export async function POST() {}`
    if (ts.isFunctionDeclaration(n) && (isExported || isDefault) && n.name) {
      if (HTTP_HANDLERS.has(n.name.text) || isDefault) exportedHandlers.add(n.name.text);
      return;
    }

    // `export const POST = async () => {}` — the idiomatic Next.js form, and
    // previously invisible: a VariableStatement is not a FunctionDeclaration, so
    // the handler was never registered and the file-level flag was used instead.
    if (ts.isVariableStatement(n) && isExported) {
      for (const d of n.declarationList.declarations) {
        if (!ts.isIdentifier(d.name)) continue;
        const init = d.initializer && unwrap(d.initializer);
        const isFn = init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init));
        if (isFn && HTTP_HANDLERS.has(d.name.text)) exportedHandlers.add(d.name.text);
      }
      return;
    }

    // `export { nukeIt as DELETE }` — the alias is the handler; the local name
    // is what the call graph knows it by, so register the local name.
    if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const spec of n.exportClause.elements) {
        const exportedAs = (spec.name?.text) ?? "";
        const localName = (spec.propertyName ?? spec.name).text;
        if (HTTP_HANDLERS.has(exportedAs) || exportedAs === "default") {
          exportedHandlers.add(localName);
        }
      }
    }
  });

  /**
   * Identifiers bound to a `.from` accessor, e.g.
   *   const { from } = supabase;      const f = supabase.from;
   * A call through one of these matched none of the chain patterns, so the write
   * was not misclassified — it was ABSENT from the inventory, which made the
   * "18/18 writers" census itself unsound. These are surfaced as unresolvable.
   */
  const fromAliases = new Set(["from"]);
  const collectAliases = (node) => {
    if (ts.isVariableDeclaration(node) && node.initializer) {
      const init = unwrap(node.initializer);
      if (isMemberAccess(init) && accessName(init) === "from" && ts.isIdentifier(node.name)) {
        fromAliases.add(node.name.text);
      }
      if (ts.isObjectBindingPattern(node.name)) {
        for (const el of node.name.elements) {
          const prop = el.propertyName ?? el.name;
          if (ts.isIdentifier(prop) && prop.text === "from" && ts.isIdentifier(el.name)) {
            fromAliases.add(el.name.text);
          }
        }
      }
    }
    ts.forEachChild(node, collectAliases);
  };
  collectAliases(sf);

  const visit = (node) => {
    if (
      ts.isIdentifier(node) &&
      (node.text === "legacyPaymentsEnabled" || node.text === "assertLegacyPaymentsEnabled") &&
      !inDeadBranch(node)
    ) {
      guarded = true;
      mark(fnGuards, fnNameOf(node));
    }

    // Local call edges, for transitive guard reachability.
    // A call through a `.from` alias — `from("donations")`, `from.call(db, ...)`.
    // Reported as unresolvable rather than ignored: a gate that reports
    // "0 unguarded" must fail loudly on writes it cannot analyse.
    if (ts.isCallExpression(node)) {
      const c = unwrap(node.expression);
      const base = ts.isIdentifier(c)
        ? c
        : isMemberAccess(c) && ts.isIdentifier(unwrap(c.expression))
          ? unwrap(c.expression)
          : null;
      if (base && fromAliases.has(base.text)) {
        dynamicTables.add(`${base.text}(...) [aliased .from]`);
      }
    }

    if (ts.isCallExpression(node)) {
      // Both `helper()` and `obj.helper()` / `obj["helper"]()`. Following only
      // bare identifiers meant a handler reaching its write through a member
      // call recorded no edge, so it looked write-free and therefore guarded.
      const callee = unwrap(node.expression);
      let target = null;
      if (ts.isIdentifier(callee)) target = callee.text;
      else if (isMemberAccess(callee)) target = accessName(callee);
      if (target) {
        const from = fnNameOf(node);
        if (!fnCalls.has(from)) fnCalls.set(from, new Set());
        fnCalls.get(from).add(target);
      }
    }

    if (ts.isCallExpression(node)) {
      const callee = unwrap(node.expression);
      if (isMemberAccess(callee)) {
        const method = accessName(callee);
        if (method === null) {
          // `db[someVar](...)` — the method cannot be resolved statically.
          dynamicTables.add(callee.getText(sf).slice(0, 60));
        }
        const table = tableOfChain(callee.expression);
        if (table) {
          (MUTATORS.has(method) ? writes : reads).add(`${table}.${method}`);
          if (MUTATORS.has(method)) mark(fnWrites, fnNameOf(node));
        }

        // `.from(someVariable)` — the table cannot be resolved statically, so
        // this scanner cannot prove it is not a legacy table. Reported rather
        // than assumed safe.
        // `Array.from` / `Buffer.from` etc. are not Supabase calls. Excluding
        // them by receiver keeps this signal readable — a detector that cries
        // wolf on every `Array.from` is one nobody reads, which is exactly how
        // a genuinely dynamic table name would slip past unnoticed.
        if (method === "from" && !JS_BUILTIN_FROM.has(callee.expression.getText(sf))) {
          const arg = node.arguments[0];
          if (arg && !ts.isStringLiteralLike(arg)) {
            dynamicTables.add(arg.getText(sf).slice(0, 60));
          }
        }

        // `.rpc("name")` can write any table from inside the function body,
        // which is invisible to source analysis. Reported for human review.
        if (method === "rpc") {
          const arg = node.arguments[0];
          rpcCalls.add(arg && ts.isStringLiteralLike(arg) ? arg.text : "<dynamic>");
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  /** Does `fn`, or anything it transitively calls in this file, satisfy `map`? */
  const reaches = (fn, map, seen = new Set()) => {
    if (seen.has(fn)) return false;
    seen.add(fn);
    if (map.get(fn)) return true;
    for (const callee of fnCalls.get(fn) ?? []) {
      if (reaches(callee, map, seen)) return true;
    }
    return false;
  };

  // A handler is unguarded when it can reach a legacy write but cannot reach the
  // guard. Module-scope writes (the Edge Function's helpers, called from its
  // guarded Deno.serve handler) are covered by the file-level flag instead.
  const unguardedHandlers = [...exportedHandlers].filter(
    (h) => reaches(h, fnWrites) && !reaches(h, fnGuards),
  );

  return {
    file: relFile,
    writes: [...writes].sort(),
    reads: [...reads].sort(),
    guarded,
    unguardedHandlers,
    isClient,
    dynamicTables: [...dynamicTables].sort(),
    rpcCalls: [...rpcCalls].sort(),
  };
}

/**
 * No residuals are permitted.
 *
 * An earlier revision of this script carried an allowlist for one browser-direct
 * write that a server flag could not gate. That was rejected as a deployment
 * blocker: a write the server cannot refuse means `legacyPaymentsEnabled()` is
 * not actually authoritative, and "the button is hidden" is product removal
 * rather than enforcement. That write now goes through a guarded founder-only
 * route, and the allowlist mechanism is deliberately gone so a future residual
 * cannot be waved through by adding an entry.
 */
const RESIDUALS = {};

/**
 * Fail if any top-level directory containing scannable source is not covered by
 * SCAN_DIRS. Without this, adding `src/` or restoring `pages/` would silently
 * shrink coverage while the gate kept reporting "0 unguarded".
 */
/** Root-level source files (middleware.ts, instrumentation.ts, ...). */
function rootSourceFiles() {
  const out = [];
  for (const e of readdirSync(ROOT)) {
    if (!SOURCE_EXT.test(e) || SKIP.test(e)) continue;
    try {
      if (statSync(path.join(ROOT, e)).isFile()) out.push(e);
    } catch { /* ignore */ }
  }
  return out;
}

const AUDIT_SKIP = /(^|\/)node_modules(\/|$)|(^|\/)\.next(\/|$)|(^|\/)\.git(\/|$)/;

/** Walk for the SCOPE AUDIT only — deliberately does not honour SKIP. */
function auditWalk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const e of readdirSync(abs)) {
    const rel = path.join(dir, e);
    if (AUDIT_SKIP.test(rel)) continue;
    let st;
    try { st = statSync(path.join(ROOT, rel)); } catch { continue; }
    if (st.isDirectory()) auditWalk(rel, out);
    else if (SOURCE_EXT.test(e)) out.push(rel);
  }
  return out;
}

function unscannedSourceDirs() {
  const covered = new Set(SCAN_DIRS.map((d) => d.split("/")[0]));
  const missed = [];
  for (const e of readdirSync(ROOT)) {
    // IGNORED_TOP_LEVEL used to be trusted on its say-so. It is now VERIFIED:
    // if an "ignored" directory actually contains source, that is reported as
    // unscanned rather than silently skipped.
    if (e.startsWith(".") || covered.has(e)) continue;
    if (IGNORED_TOP_LEVEL.has(e)) {
      let st;
      try { st = statSync(path.join(ROOT, e)); } catch { continue; }
      if (st.isDirectory() && auditWalk(e).length) missed.push(e);
      continue;
    }
    let st;
    try {
      st = statSync(path.join(ROOT, e));
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    if (auditWalk(e).length) missed.push(e);
  }
  return missed;
}

const unscanned = unscannedSourceDirs();

const files = [...SCAN_DIRS.flatMap((d) => walkFiles(d)), ...rootSourceFiles()];
const results = files.map(analyse);
const writers = results.filter((r) => r.writes.length).sort((a, b) => a.file.localeCompare(b.file));
const readers = results.filter((r) => !r.writes.length && r.reads.length).map((r) => r.file).sort();

/**
 * A browser-side write is never "guarded", even if the file happens to mention
 * the flag: the check would run in the browser, where it is advisory at best.
 * It is its own failure class so it can never be confused with enforcement.
 */
const classify = (w) =>
  w.isClient
    ? "BROWSER-WRITE"
    : w.unguardedHandlers?.length
      ? "UNGUARDED"
      : w.guarded
        ? "guarded"
        : "UNGUARDED";

const unguarded = writers.filter((w) => classify(w) === "UNGUARDED");
const browserWrites = writers.filter((w) => classify(w) === "BROWSER-WRITE");
const staleResiduals = Object.keys(RESIDUALS);
const dynamic = results.filter((r) => r.dynamicTables.length);
const rpc = results.filter((r) => r.rpcCalls.length);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(
    {
      writers: writers.map((w) => ({ ...w, classification: classify(w) })),
      readers,
      residuals: RESIDUALS,
      scanDirs: SCAN_DIRS,
      unscannedSourceDirs: unscanned,
      dynamicTableSites: dynamic.map((r) => ({ file: r.file, args: r.dynamicTables })),
      rpcSites: rpc.map((r) => ({ file: r.file, functions: r.rpcCalls })),
    },
    null,
    2,
  ));
} else {
  console.log(`scanned ${files.length} files\n`);
  console.log(`WRITERS (${writers.length}):`);
  for (const w of writers) {
    const handlers = w.unguardedHandlers?.length
      ? `  UNGUARDED HANDLERS: ${w.unguardedHandlers.join(", ")}`
      : "";
    console.log(`  ${classify(w).padEnd(13)} ${w.file}  [${w.writes.join(", ")}]${handlers}`);
  }
  console.log(`\nREADERS (${readers.length}) — no guard required:`);
  for (const r of readers) console.log(`  ${r}`);

  // Reported, not silently trusted. Neither can be classified from source
  // alone, so both are surfaced for human review on every run.
  console.log(`\nDYNAMIC .from(<non-literal>) sites (${dynamic.length}) — table not statically resolvable:`);
  for (const r of dynamic) console.log(`  ${r.file}  [${r.dynamicTables.join(", ")}]`);
  console.log(`\n.rpc() sites (${rpc.length}) — function bodies are invisible to this scanner:`);
  for (const r of rpc) console.log(`  ${r.file}  [${r.rpcCalls.join(", ")}]`);

  if (browserWrites.length) {
    console.log(`\nBROWSER-SIDE WRITES TO RETIRED TABLES (${browserWrites.length}) — unguardable by construction:`);
    for (const w of browserWrites) console.log(`  ${w.file}  [${w.writes.join(", ")}]`);
  }
  if (staleResiduals.length) {
    console.log(`\nRESIDUALS PRESENT (${staleResiduals.length}) — residuals are not permitted: ${staleResiduals.join(", ")}`);
  }

  if (unscanned.length) {
    console.log(`\nUNSCANNED SOURCE DIRECTORIES (${unscanned.length}) — writers here are invisible to this gate: ${unscanned.join(", ")}`);
  }
  console.log(`\n${unguarded.length} unguarded writer(s)`);
  console.log(`${browserWrites.length} browser-side mutation(s) to retired financial tables`);
  console.log(`${staleResiduals.length} residual(s)`);
  console.log(`${unscanned.length} unscanned source director(ies)`);
  console.log(`${dynamic.length} unresolvable table reference(s)`);
  process.exit(
    unguarded.length ||
    browserWrites.length ||
    staleResiduals.length ||
    unscanned.length ||
    dynamic.length
      ? 1
      : 0,
  );
}
