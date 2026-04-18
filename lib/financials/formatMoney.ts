export function formatMoney(
  cents: number | null | undefined,
  opts: { withCents?: boolean } = {},
) {
  const v = cents ?? 0;
  const withCents = opts.withCents ?? v % 100 !== 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(v / 100);
}

export function formatPercent(pct: number | null | undefined) {
  if (pct == null) return "—";
  return `${pct.toFixed(1)}%`;
}
