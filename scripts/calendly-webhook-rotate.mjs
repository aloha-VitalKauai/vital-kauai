#!/usr/bin/env node
// Calendly webhook signing-key rotation + PAT capability verification.
//
// Why this exists: the production webhook currently fails open — no
// CALENDLY_WEBHOOK_SIGNING_KEY is configured, so signature verification is
// skipped. Recurring-series creation (Sessions Build 2) fails closed on an
// unverified payload, so the key must be in place before the feature works.
// Calendly only reveals a signing key at subscription creation, which makes
// the fix a rotation: create a NEW subscription, capture its key, set it in
// Vercel, prove verification live, and only then remove the old
// subscription. No step here deletes anything without being asked to.
//
// Usage (needs CALENDLY_API_TOKEN in the environment — the production PAT):
//
//   node scripts/calendly-webhook-rotate.mjs verify
//       Proves the PAT can do what Build 2's fan-out needs: identify the
//       host, list event types, and query availability for the coaching
//       event type. Read-only.
//
//   node scripts/calendly-webhook-rotate.mjs verify --book
//       Additionally proves booking creation: books the LAST available
//       coaching slot in the lookahead window with the host's own email as
//       invitee, fetches the event until the Zoom join_url appears, then
//       cancels it. Emails stay in the host's inbox. Leaves no residue
//       (the cancel webhook reconciles session_bookings).
//
//   node scripts/calendly-webhook-rotate.mjs list
//       Shows current webhook subscriptions (organization and user scope).
//
//   node scripts/calendly-webhook-rotate.mjs create --url https://<site>/api/calendly-webhook
//       Creates the new organization-scope subscription for invitee.created
//       + invitee.canceled and prints its signing key ONCE, to the terminal
//       only. Paste it into Vercel as CALENDLY_WEBHOOK_SIGNING_KEY
//       (production), redeploy, then send any test event and confirm the
//       function logs no longer say "skipping verification". NEVER paste
//       the key into a PR, commit, screenshot, or chat.
//
//   node scripts/calendly-webhook-rotate.mjs delete --uri <subscription uri>
//       Removes ONE subscription by URI. Run only after the new signed
//       subscription is proven live end-to-end, so there is no delivery
//       gap. The PNE organization's subscription is separate — leave it.

const API = "https://api.calendly.com";
const token = process.env.CALENDLY_API_TOKEN;

const args = process.argv.slice(2);
const command = args[0];
const flag = (name) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? true);
};

if (!token) {
  console.error("CALENDLY_API_TOKEN is not set. Copy it from Vercel → Project → Settings → Environment Variables for this one run; do not commit it anywhere.");
  process.exit(1);
}

async function calendly(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${body.slice(0, 500)}`);
  }
  return body ? JSON.parse(body) : null;
}

async function me() {
  const { resource } = await calendly("/users/me");
  return resource;
}

async function coachingEventType(userUri) {
  const { collection } = await calendly(
    `/event_types?user=${encodeURIComponent(userUri)}&active=true&count=50`,
  );
  const coaching = collection.find((et) => et.name === "1 Hour Coaching Call");
  if (!coaching) {
    throw new Error(
      `no active "1 Hour Coaching Call" event type; found: ${collection.map((et) => et.name).join(", ")}`,
    );
  }
  return coaching;
}

async function verify() {
  const user = await me();
  console.log(`PAT ok: ${user.name} <${user.email}> (${user.timezone})`);
  const et = await coachingEventType(user.uri);
  console.log(`event type ok: ${et.name} (${et.duration} min) ${et.uri}`);

  const start = new Date(Date.now() + 8 * 24 * 3600 * 1000);
  const end = new Date(start.getTime() + 6 * 24 * 3600 * 1000);
  const { collection: slots } = await calendly(
    `/event_type_available_times?event_type=${encodeURIComponent(et.uri)}` +
      `&start_time=${start.toISOString()}&end_time=${end.toISOString()}`,
  );
  console.log(`availability ok: ${slots.length} open slots in the window starting ${start.toISOString().slice(0, 10)}`);
  if (!flag("book")) {
    console.log("(run with --book to also prove booking creation + join_url + cancel)");
    return;
  }
  if (slots.length === 0) throw new Error("no open slot to book against");

  const slot = slots[slots.length - 1];
  console.log(`booking test slot ${slot.start_time} …`);
  const { resource: invitee } = await calendly("/invitees", {
    method: "POST",
    body: JSON.stringify({
      event_type: et.uri,
      start_time: slot.start_time,
      invitee: {
        email: user.email,
        name: "PAT verification test (auto-cancels)",
        timezone: user.timezone,
      },
      location: { kind: "zoom_conference" },
    }),
  });
  console.log(`booking created ok: invitee ${invitee.uri}`);

  let joinUrl = null;
  for (let attempt = 0; attempt < 5 && !joinUrl; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
    const { resource: event } = await calendly(
      invitee.event.replace(API, ""),
    );
    joinUrl = event.location?.join_url ?? null;
  }
  console.log(joinUrl ? "join_url ok (zoom provisioned)" : "join_url NOT provisioned within ~12s — investigate before relying on it");

  await calendly(invitee.event.replace(API, "") + "/cancellation", {
    method: "POST",
    body: JSON.stringify({ reason: "PAT verification complete — test booking, no action needed." }),
  });
  console.log("test booking canceled; the cancel webhook reconciles session_bookings");
}

async function listSubscriptions() {
  const user = await me();
  for (const scope of ["organization", "user"]) {
    const params = new URLSearchParams({
      organization: user.current_organization,
      scope,
      count: "20",
    });
    if (scope === "user") params.set("user", user.uri);
    const { collection } = await calendly(`/webhook_subscriptions?${params}`);
    console.log(`\n${scope}-scope subscriptions (${collection.length}):`);
    for (const sub of collection) {
      console.log(`  ${sub.uri}`);
      console.log(`    url=${sub.callback_url} state=${sub.state} events=${sub.events.join(",")} created=${sub.created_at}`);
    }
  }
}

async function createSubscription() {
  const url = flag("url");
  if (!url || url === true) {
    throw new Error("pass --url https://<production-site>/api/calendly-webhook");
  }
  const user = await me();
  const { resource } = await calendly("/webhook_subscriptions", {
    method: "POST",
    body: JSON.stringify({
      url,
      events: ["invitee.created", "invitee.canceled"],
      organization: user.current_organization,
      scope: "organization",
    }),
  });
  console.log(`subscription created: ${resource.uri}`);
  console.log(`  url=${resource.callback_url} state=${resource.state}`);
  console.log("\n─── SIGNING KEY (shown once, terminal only) ───");
  console.log(resource.signing_key ?? "(no signing_key in response — check the Calendly API changelog)");
  console.log("───────────────────────────────────────────────");
  console.log(
    "Set this as CALENDLY_WEBHOOK_SIGNING_KEY (Production) in Vercel, redeploy,\n" +
      "then confirm the webhook logs show signature verification without\n" +
      '"skipping verification". Only then delete the old subscription.',
  );
}

async function deleteSubscription() {
  const uri = flag("uri");
  if (!uri || uri === true) throw new Error("pass --uri <subscription uri from `list`>");
  await calendly(uri.replace(API, ""), { method: "DELETE" });
  console.log(`deleted: ${uri}`);
}

const commands = { verify, list: listSubscriptions, create: createSubscription, delete: deleteSubscription };
const run = commands[command];
if (!run) {
  console.error("usage: calendly-webhook-rotate.mjs <verify [--book] | list | create --url <url> | delete --uri <uri>>");
  process.exit(1);
}
run().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
