export const PAYMENT_MODE = (
  process.env.NEXT_PUBLIC_PAYMENT_MODE ?? "standard"
).toLowerCase() as "standard" | "x402";

export function isX402(): boolean {
  return PAYMENT_MODE === "x402";
}
