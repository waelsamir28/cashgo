const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const R = ["1110010", "1100110", "1101100", "1000010", "1011110", "1001110", "1010000", "1000100", "1001000", "1110100"];
const G = ["01001", "01100", "00110", "01000", "10001", "00010", "10010", "00100", "00001", "11011"];
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

function computeCheckDigit(digits12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

function encode(digits13: string): string {
  const parity = PARITY[Number(digits13[0])] ?? PARITY[0];
  let bits = "101";
  for (let i = 1; i <= 6; i++) {
    const digit = Number(digits13[i]);
    bits += parity[i - 1] === "L" ? L[digit] : R[digit];
  }
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += R[Number(digits13[i])];
  bits += "101";
  return bits;
}

export function ean13From(value: string): { bits: string; digits: string } | null {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12) {
    const full = digits + String(computeCheckDigit(digits));
    return { bits: encode(full), digits: full };
  }
  if (digits.length === 13) {
    // Recompute the check digit so the barcode is always scannable.
    const full = digits.slice(0, 12) + String(computeCheckDigit(digits.slice(0, 12)));
    return { bits: encode(full), digits: full };
  }
  return null;
}

/** Always returns renderable bits; falls back to a deterministic pseudo-pattern for non-EAN codes. */
export function barcodeFrom(value: string): { bits: string; digits: string } {
  const ean = ean13From(value);
  if (ean) return ean;
  let hash = 2166136261;
  for (const ch of value) {
    hash ^= ch.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  let bits = "101";
  for (let i = 0; i < 42; i++) {
    hash = (Math.imul(hash, 1103515245) + 12345) >>> 0;
    bits += (hash & 1).toString();
  }
  bits += "101";
  return { bits, digits: value };
}
