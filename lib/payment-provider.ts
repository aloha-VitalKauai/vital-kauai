// Server-only payment provider flag.
//
// Reads PAYMENT_PROVIDER env. Default 'stripe' preserves existing behavior;
// 'square' routes the journey-contribution path through the new Square flow.
// Only consumed by server code (API routes + server components) so the value
// can be evaluated at request time without shipping a Square SDK to the browser.

export type PaymentProvider = "stripe" | "square";

export function getPaymentProvider(): PaymentProvider {
  const raw = (process.env.PAYMENT_PROVIDER ?? "stripe").toLowerCase().trim();
  return raw === "square" ? "square" : "stripe";
}

export function isSquareActive(): boolean {
  return getPaymentProvider() === "square";
}
