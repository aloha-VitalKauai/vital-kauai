/**
 * Module loader for the D-078 behavioural shutdown tests.
 *
 * WHY THIS EXISTS.
 * The first shutdown attempt was "proved" by grepping the source for the guard
 * and comparing line numbers. That proof was vacuous: inverting the guard and
 * deleting its `return` both left the suite fully green. The only proof that
 * cannot be satisfied by a comment is to actually CALL each handler and observe
 * that nothing happened. To call a Next.js route handler under `node --test` we
 * need three things this loader provides:
 *
 *   1. `@/*` path-alias resolution (tsconfig paths; Node does not read them).
 *   2. TSX/TS transpilation — Node 26 strips types but does not handle JSX, and
 *      `app/pay/[token]/page.tsx` is a legacy writer we must exercise.
 *   3. Recording stubs for every module that can reach Stripe, Square, the
 *      database or the mail sender.
 *
 * THE STUBS RECORD BUT NEVER THROW. That is deliberate. A throwing stub would
 * let a broken guard "pass" by producing an error response that a sloppy
 * assertion might accept. Because the stubs are inert recording proxies, a
 * handler whose guard was removed runs FURTHER and records calls — so the
 * assertion "zero calls were recorded" is what actually kills the mutant, not
 * an incidental exception.
 *
 * Every intercepted call is appended to `globalThis.__VK_CALLS`.
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = process.cwd();

globalThis.__VK_CALLS = [];
const record = (entry) => {
  globalThis.__VK_CALLS.push(entry);
};

/**
 * Record global `fetch`, and refuse to let it reach the network.
 *
 * Independent review found this hole: the loader stubs MODULES, but email is
 * sent by calling `fetch("https://api.resend.com/emails")` directly, and
 * `approve-member` reaches the Supabase admin REST API the same way. Neither
 * went through a stubbed module, so `__VK_CALLS` stayed empty while a real
 * outbound request was attempted — meaning the "no email/link creation" claim
 * had no evidence behind it, and a removed guard would have fired a genuine HTTP
 * request out of the test run rather than being trapped.
 *
 * Throwing rather than returning a fake response is deliberate: a test must
 * never be able to pass *because* an unrecorded network call quietly succeeded.
 */
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = typeof input === "string" ? input : (input?.url ?? String(input));
  record({
    module: "fetch",
    path: `fetch(${url})`,
    call: `fetch:${url}`,
    arg0: url,
    method: init?.method ?? "GET",
  });
  // A test may supply canned responses so a positive control can run a route to
  // completion. Anything NOT explicitly handled still throws: an unrecognised
  // outbound call must never be able to make a test pass by quietly succeeding.
  const handler = globalThis.__VK_FETCH_RESOLVE;
  if (typeof handler === "function") {
    const canned = handler(url, init);
    if (canned !== undefined) return canned;
  }

  throw new Error(
    `legacy-loader: outbound fetch blocked in tests -> ${url}. ` +
      `This call was recorded in __VK_CALLS.`,
  );
};
globalThis.__VK_REAL_FETCH = realFetch;

/**
 * Same treatment for the lower-level HTTP clients.
 *
 * Review noted that instrumenting global `fetch` alone left `node:http` /
 * `node:https` uninstrumented, so "no outbound request occurred" was narrower
 * than it sounded. No route currently uses them — but the claim should be true
 * because it is enforced, not because nobody has written that code yet.
 */
// Placeholder: the real patching happens after blockedHttp is defined, below.

/**
 * Shared by the default-import patch above and the named-export interception in
 * the resolve/load hooks below.
 */
function blockedHttp(mod, fn, args) {
  const target =
    typeof args[0] === "string" ? args[0] : (args[0]?.hostname ?? "unknown");
  record({
    module: mod,
    path: `${mod}.${fn}(${target})`,
    call: `${mod}:${fn}`,
    arg0: String(target),
  });
  throw new Error(
    `legacy-loader: outbound ${mod}.${fn} blocked in tests -> ${target}. ` +
      `This call was recorded in __VK_CALLS.`,
  );
}
globalThis.__VK_BLOCKED_HTTP = blockedHttp;

// Captured before anything else can import these, so the recorder always wraps
// the genuine implementations. Listed explicitly rather than derived from
// NET_MODULES, which is declared further down (temporal dead zone).
globalThis.__VK_REAL_HTTP = {};
for (const name of ["http", "https", "net", "tls", "dns", "child_process", "http2", "dgram", "worker_threads"]) {
  const lib = await import(`node:${name}`);
  globalThis.__VK_REAL_HTTP[name] = lib.default;
}

/**
 * Global `WebSocket` is another egress channel with no module import at all.
 */
if (typeof globalThis.WebSocket === "function") {
  const RealWS = globalThis.WebSocket;
  globalThis.__VK_REAL_WEBSOCKET = RealWS;
  globalThis.WebSocket = function BlockedWebSocket(url, ...rest) {
    return blockedHttp("WebSocket", "new", [String(url), ...rest]);
  };
}

/**
 * Modules replaced by recording proxies: anything that can reach a payment
 * provider, the database, the mail sender, or the founder-authorisation check.
 * `founder-check` is stubbed too so a test can prove the guard runs BEFORE
 * authorisation — a 503 that only appears for authorised callers would be a
 * different, weaker property than the one claimed.
 */
export const STUBBED = new Set([
  "stripe",
  "@supabase/supabase-js",
  "@/lib/supabase/server",
  "@/lib/supabase/client",
  "@/lib/square/client",
  "@/lib/email-renderers",
  "@/lib/auth/founder-check",
  "@/lib/payment-provider",
  "@/lib/billing/getMembershipDonationConfig",
  "@/lib/api/bookings",
]);

/** Modules that must resolve to nothing at all (Next.js build-time markers). */
const EMPTY = new Set(["server-only", "client-only"]);

/**
 * Every network egress channel, with the functions that actually leave the box.
 *
 * Instrumenting only http/https left `node:net`, `node:tls`, `node:dns` and
 * global `WebSocket` SILENT-LIVE — review opened a raw socket through `net` and
 * the harness recorded nothing. The loader's own standard is that a claim should
 * hold because it is enforced, not because nobody has written that code yet.
 */
const NET_MODULES = {
  http: ["request", "get"],
  https: ["request", "get"],
  net: ["connect", "createConnection"],
  tls: ["connect"],
  dns: ["resolve", "resolve4", "resolve6", "lookup", "lookupService"],
  // http2 is the transport a modern gRPC/Stripe client reaches for; dgram is a
  // UDP escape hatch. Both were silent-live.
  http2: ["connect"],
  dgram: ["createSocket"],
  // No blocked *functions* — its egress risk is the Worker class, handled by
  // blockConstruct below. It must still be listed here so the resolve hook
  // intercepts the module at all.
  worker_threads: [],
  // RECORD-ONLY, not blocked: this suite legitimately shells out (git, and the
  // inventory script). Recording still means a route that exfiltrates through a
  // subprocess shows up in __VK_CALLS and fails the "no side effects" assertion.
  child_process: [],
};

/**
 * Members that are objects or classes rather than plain functions, so the
 * function-list blocking above misses them. Review reached the network through
 * every one of these while the harness recorded nothing:
 *   `new net.Socket().connect(...)` actually CONNECTED to api.stripe.com,
 *   `dns.promises.resolve4(...)` ran live.
 */
const NET_MEMBER_WRAPPERS = {
  net: { classes: ["Socket"], namespaces: [] },
  tls: { classes: ["TLSSocket"], namespaces: [] },
  dns: { classes: [], namespaces: ["promises"] },
  http: { classes: [], namespaces: [] },
  https: { classes: [], namespaces: [] },
  child_process: {
    classes: [],
    namespaces: [],
    recordOnly: ["exec", "execSync", "execFile", "execFileSync", "spawn", "spawnSync", "fork"],
  },
  http2: { classes: [], namespaces: [] },
  dgram: { classes: [], namespaces: [] },
  /**
   * A worker thread does NOT inherit this process's module hooks, so code
   * running inside one bypasses the entire interception mechanism rather than a
   * single channel. Review span up a worker that connected to api.stripe.com
   * with nothing recorded. Construction is therefore blocked outright — no test
   * here legitimately spawns one.
   */
  worker_threads: { classes: [], namespaces: [], blockConstruct: ["Worker"] },
};

/**
 * Build the namespace a test-run module actually sees: real bindings, with
 * every egress path either blocked-and-recorded or (for child_process)
 * recorded and passed through.
 */
globalThis.__VK_WRAP_NET = (name, real) => {
  const spec = NET_MEMBER_WRAPPERS[name] ?? { classes: [], namespaces: [] };
  const out = { ...real };

  for (const fn of NET_MODULES[name] ?? []) {
    if (typeof real[fn] === "function") {
      out[fn] = (...args) => blockedHttp(`node:${name}`, fn, args);
    }
  }

  for (const cls of spec.classes) {
    const Real = real[cls];
    if (typeof Real !== "function") continue;
    out[cls] = class extends Real {
      connect(...args) {
        return blockedHttp(`node:${name}`, `${cls}.connect`, args);
      }
    };
  }

  for (const ns of spec.namespaces) {
    const realNs = real[ns];
    if (!realNs) continue;
    const wrapped = { ...realNs };
    for (const [k, v] of Object.entries(realNs)) {
      if (typeof v === "function") {
        wrapped[k] = (...args) => blockedHttp(`node:${name}`, `${ns}.${k}`, args);
      }
    }
    out[ns] = wrapped;
  }

  for (const cls of spec.blockConstruct ?? []) {
    if (typeof real[cls] !== "function") continue;
    out[cls] = function BlockedConstruct(...args) {
      return blockedHttp(`node:${name}`, `new ${cls}`, args);
    };
  }

  for (const fn of spec.recordOnly ?? []) {
    const realFn = real[fn];
    if (typeof realFn !== "function") continue;
    out[fn] = (...args) => {
      record({
        module: `node:${name}`,
        path: `${name}.${fn}(${typeof args[0] === "string" ? args[0] : ""})`,
        call: `node:${name}:${fn}`,
        arg0: typeof args[0] === "string" ? args[0] : undefined,
      });
      return realFn(...args);
    };
  }

  return out;
};
const HTTP_MODULES = new Set(
  Object.keys(NET_MODULES).flatMap((m) => [m, `node:${m}`]),
);

/**
 * Faithful shims, NOT recording proxies.
 *
 * `next/server` builds the actual response object the test inspects, so it must
 * behave correctly — a proxy here would make every status assertion vacuous,
 * which is the exact failure mode this rewrite exists to eliminate. These are
 * real implementations over the standard `Response`, which Node provides.
 *
 * `next/navigation`'s `redirect` throws in real Next.js too (it unwinds the
 * render), so recording-and-throwing is faithful rather than convenient.
 */
const SHIMS = {
  "next/server": `
    export class NextResponse extends Response {
      static json(body, init) {
        return new NextResponse(JSON.stringify(body), {
          ...init,
          headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
        });
      }
      static redirect(url, status = 307) {
        return new NextResponse(null, { status, headers: { location: String(url) } });
      }
      static next() { return new NextResponse(null, { status: 200 }); }
    }
    export class NextRequest extends Request {}
  `,
  "next/navigation": `
    export function redirect(url) {
      globalThis.__VK_CALLS.push({ module: "next/navigation", path: "redirect", call: "next/navigation:redirect", arg0: url });
      const e = new Error("NEXT_REDIRECT:" + url);
      e.digest = "NEXT_REDIRECT";
      throw e;
    }
    export function notFound() {
      const e = new Error("NEXT_NOT_FOUND");
      e.digest = "NEXT_NOT_FOUND";
      throw e;
    }
    export const useRouter = () => ({ refresh() {}, push() {} });
  `,
};

/**
 * Named exports a stub must provide, derived from the REAL module's AST for
 * first-party files. Hardcoding this list was a defect: a stub that silently
 * lacks an export makes the importing route fail to load, and a route that
 * never loads is a route whose guard was never tested. Deriving it means adding
 * an export to a stubbed module cannot quietly drop it out of coverage.
 *
 * Third-party packages are listed explicitly — their type surface is large and
 * only these bindings are actually imported by legacy code.
 */
const VENDOR_EXPORTS = {
  stripe: [],
  "@supabase/supabase-js": ["createClient"],
};

function exportedNames(spec) {
  if (VENDOR_EXPORTS[spec]) return VENDOR_EXPORTS[spec];
  const base = path.join(ROOT, spec.slice(2));
  for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    let src;
    try {
      src = readFileSync(base + ext, "utf8");
    } catch {
      continue;
    }
    const sf = ts.createSourceFile(base + ext, src, ts.ScriptTarget.Latest, true);
    const out = new Set();
    sf.forEachChild((n) => {
      const exported = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (!exported) return;
      if (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) {
        if (n.name) out.add(n.name.text);
      } else if (ts.isVariableStatement(n)) {
        for (const d of n.declarationList.declarations) {
          if (ts.isIdentifier(d.name)) out.add(d.name.text);
        }
      }
    });
    return [...out];
  }
  throw new Error(`legacy-loader: cannot derive exports for stubbed module ${spec}`);
}

registerHooks({
  resolve(specifier, context, next) {
    if (EMPTY.has(specifier)) {
      return { url: "vkempty:" + specifier, shortCircuit: true };
    }
    // Named imports of node:http / node:https bind to a SEPARATE snapshot from
    // `lib.default`, so patching the default export left
    // `import { request } from "node:https"` fully live — review issued a real
    // TLS connection through it. Redirect the module itself so every export
    // form goes through the recorder.
    if (HTTP_MODULES.has(specifier)) {
      return { url: "vkhttp:" + specifier.replace(/^node:/, ""), shortCircuit: true };
    }
    if (SHIMS[specifier]) {
      return { url: "vkshim:" + specifier, shortCircuit: true };
    }
    if (STUBBED.has(specifier)) {
      return { url: "vkstub:" + specifier, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const base = path.join(ROOT, specifier.slice(2));
      for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        try {
          const p = base + ext;
          readFileSync(p);
          return { url: pathToFileURL(p).href, shortCircuit: true };
        } catch {
          /* try the next extension */
        }
      }
    }
    return next(specifier, context);
  },

  load(url, context, next) {
    if (url.startsWith("vkempty:")) {
      return { format: "module", source: "export {};", shortCircuit: true };
    }
    if (url.startsWith("vkhttp:")) {
      const name = url.slice("vkhttp:".length);
      const real = globalThis.__VK_WRAP_NET(name, globalThis.__VK_REAL_HTTP[name] ?? {});
      const blocked = [];
      // Re-export every real binding, with the egress functions replaced. Named
      // exports are generated from the real module so no binding silently
      // disappears — a missing export would break the importing route and hide
      // the very code we are trying to observe.
      const passthrough = Object.keys(real).filter(
        (k) => !blocked.includes(k) && /^[A-Za-z_$][\w$]*$/.test(k),
      );
      return {
        format: "module",
        source: `
          const real = globalThis.__VK_WRAP_NET(
            ${JSON.stringify(name)},
            globalThis.__VK_REAL_HTTP[${JSON.stringify(name)}],
          );
          ${passthrough.map((k) => `export const ${k} = real[${JSON.stringify(k)}];`).join("\n")}
          export default real;
        `,
        shortCircuit: true,
      };
    }
    if (url.startsWith("vkshim:")) {
      return { format: "module", source: SHIMS[url.slice("vkshim:".length)], shortCircuit: true };
    }
    if (url.startsWith("vkstub:")) {
      const name = url.slice("vkstub:".length);
      const names = exportedNames(name);
      return {
        format: "module",
        source: `
          const s = globalThis.__VK_MKSTUB(${JSON.stringify(name)});
          export default s;
          ${names.map((n) => `export const ${n} = s.${n};`).join("\n")}
        `,
        shortCircuit: true,
      };
    }
    // Transpile TS/TSX ourselves: Node strips types but cannot handle JSX.
    if (url.startsWith("file:") && /\.(ts|tsx)$/.test(url)) {
      const file = fileURLToPath(url);
      const out = ts.transpileModule(readFileSync(file, "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
        fileName: file,
      });
      return { format: "module", source: out.outputText, shortCircuit: true };
    }
    return next(url, context);
  },
});

/**
 * A proxy that records every property access and call and returns another such
 * proxy, so arbitrarily long chains (`supabase.from(t).update(v).eq(a,b)`) work
 * and every link is logged.
 *
 * `then` deliberately returns undefined: without that, `await proxy` would treat
 * the proxy as a thenable and never settle.
 */
function makeStub(modName, trail = []) {
  const fn = function () {};
  return new Proxy(fn, {
    get(_t, prop) {
      if (prop === "then") return undefined;
      if (typeof prop === "symbol") return undefined;
      if (prop === "__vkTrail") return trail;

      // Supabase result shape. Routes commonly do
      //   const { data, error } = await q; data.reduce(...)
      // and a bare proxy makes that arithmetic collapse, stopping the route
      // before it reaches the write we want the positive control to observe.
      // These defaults are inert: an empty result set and no error.
      if (prop === "data") return [];
      if (prop === "error") return null;
      if (prop === "count") return 0;

      return makeStub(modName, [...trail, prop]);
    },
    apply(_t, _this, args) {
      const call = `${modName}:${trail.join(".")}`;
      record({
        module: modName,
        path: trail.join("."),
        call,
        // Table names matter for the "zero database writes" assertion.
        arg0: typeof args[0] === "string" ? args[0] : undefined,
      });

      // The string argument is kept in the trail so a resolver can tell
      // `.from("user_roles").…single()` apart from `.from("journeys").…single()`.
      // Without it every chain looks identical and a test cannot steer a route
      // past its auth check to the write it actually wants to observe.
      const tag = typeof args[0] === "string" ? `(${args[0]})` : "()";
      const nextTrail = [...trail, tag];

      /**
       * Optional test-supplied resolver. Returning a value short-circuits the
       * proxy so a route can be driven down a realistic path (authorised
       * founder, existing row) and reach its real write. Returning undefined
       * keeps the default proxy behaviour.
       */
      const resolve = globalThis.__VK_RESOLVE;
      if (typeof resolve === "function") {
        // `call` is the invocation being made, with the table tags accumulated
        // by earlier links still in it, e.g.
        //   ...from.(user_roles).select.(role).eq.(user_id).single
        const v = resolve(call, args);
        if (v !== undefined) return v;
      }
      return makeStub(modName, nextTrail);
    },
    construct() {
      record({ module: modName, path: trail.join("."), call: `new ${modName}`, arg0: undefined });
      return makeStub(modName, [...trail, "new"]);
    },
  });
}
globalThis.__VK_MKSTUB = (name) => makeStub(name);
