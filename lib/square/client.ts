// Server-only Square SDK wrapper.
//
// Construct once per request rather than module-load so env changes (sandbox
// → production) take effect without a fresh deploy. The SDK is HTTP-only and
// stateless; instantiation is cheap.

import { SquareClient, SquareEnvironment } from "square";

export type SquareEnv = {
  accessToken: string;
  locationId: string;
  environment: "sandbox" | "production";
  webhookSignatureKey: string;
};

export function getSquareEnv(): SquareEnv {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
  const rawEnv = (process.env.SQUARE_ENVIRONMENT ?? "sandbox").toLowerCase().trim();
  const environment: "sandbox" | "production" =
    rawEnv === "production" ? "production" : "sandbox";

  if (!accessToken) {
    throw new Error("SQUARE_ACCESS_TOKEN is not configured");
  }
  if (!locationId) {
    throw new Error("SQUARE_LOCATION_ID is not configured");
  }

  return { accessToken, locationId, environment, webhookSignatureKey };
}

export function getSquareClient(): SquareClient {
  const { accessToken, environment } = getSquareEnv();
  return new SquareClient({
    token: accessToken,
    environment:
      environment === "production"
        ? SquareEnvironment.Production
        : SquareEnvironment.Sandbox,
  });
}
