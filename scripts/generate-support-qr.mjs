/**
 * PR 10C: generate the PERMANENT public-support QR assets.
 *
 * The QR encodes exactly https://vitalkauai.com/support — never a Stripe
 * Payment Link, Checkout Session, or any provider URL — so every printed or
 * shared copy stays valid no matter how the payment implementation changes.
 *
 * Run once (or after a deliberate brand change) and commit the outputs:
 *   node scripts/generate-support-qr.mjs
 * Writes public/support-qr.svg and public/support-qr-1024.png.
 */
import { writeFile } from "node:fs/promises";
import QRCode from "qrcode";

const URL_TEXT = "https://vitalkauai.com/support";
const DARK = "#092419"; // Vital Kauaʻi header green — high contrast on white
const LIGHT = "#ffffff";

const svg = await QRCode.toString(URL_TEXT, {
  type: "svg",
  errorCorrectionLevel: "H", // survives print wear and overlays
  margin: 2,
  color: { dark: DARK, light: LIGHT },
});
await writeFile(new URL("../public/support-qr.svg", import.meta.url), svg);

const png = await QRCode.toBuffer(URL_TEXT, {
  type: "png",
  errorCorrectionLevel: "H",
  margin: 2,
  width: 1024,
  color: { dark: DARK, light: LIGHT },
});
await writeFile(new URL("../public/support-qr-1024.png", import.meta.url), png);

console.log(`wrote public/support-qr.svg and public/support-qr-1024.png encoding ${URL_TEXT}`);
