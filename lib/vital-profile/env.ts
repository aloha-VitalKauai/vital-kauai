// Server-only env access for Vital Profile providers.
//
// Every key here is a SERVER secret. None of them use the NEXT_PUBLIC_*
// prefix, which means Next.js will not inline them into the browser
// bundle — they resolve to `undefined` on the client. The runtime guard
// below adds belt-and-suspenders enforcement: if this module is ever
// imported from a browser context, the first call throws loudly instead
// of silently returning null and masking the bug.
//
// Real provider integrations will call into this module when they
// arrive. Today (stub phase) it is referenced only by lib/vital-profile/*
// server code and never reaches the client.

export type ProviderEnvName =
  | "VITAL_PROFILE_ASTROLOGY_API_KEY"
  | "VITAL_PROFILE_ASTROLOGY_API_URL"
  | "VITAL_PROFILE_HUMAN_DESIGN_API_KEY"
  | "VITAL_PROFILE_HUMAN_DESIGN_API_URL"
  | "VITAL_PROFILE_GENE_KEYS_API_KEY"
  | "VITAL_PROFILE_GENE_KEYS_API_URL";

export function getProviderEnv(name: ProviderEnvName): string | null {
  if (typeof window !== "undefined") {
    throw new Error(
      "lib/vital-profile/env.ts is server-only — do not import from client code.",
    );
  }
  const raw = process.env[name];
  return raw && raw.length > 0 ? raw : null;
}

// Future call sites will do something like:
//
//   const url = getProviderEnv("VITAL_PROFILE_ASTROLOGY_API_URL");
//   const key = getProviderEnv("VITAL_PROFILE_ASTROLOGY_API_KEY");
//   if (!url || !key) {
//     return { kind: "error", code: "provider_disabled",
//              message: "Western astrology API not configured" };
//   }
//   const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` }, ... });
