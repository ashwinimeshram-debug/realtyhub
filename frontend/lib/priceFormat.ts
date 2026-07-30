export function formatIndianPrice(raw: string): string {
  const cleaned = raw.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  const reversed = cleaned.split("").reverse().join("");
  const parts: string[] = [];
  for (let i = 0; i < reversed.length; i++) {
    if (i === 3 || i === 5 || i === 7) parts.push(",");
    parts.push(reversed[i]);
  }
  return parts.reverse().join("");
}

export function parseNumericPrice(val: string): string {
  if (val === "Connect for Price") return val;
  return val.replace(/[^0-9]/g, "");
}

const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigit(n: number): string {
  if (n < 20) return ones[n];
  return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
}

function threeDigit(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  return (h ? ones[h] + " Hundred" : "") + (h && r ? " and " : "") + twoDigit(r);
}

export function numberToWordsIndian(num: number): string {
  if (num === 0) return "Zero";
  if (num < 0) return "Minus " + numberToWordsIndian(-num);

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const rest = num;

  const parts: string[] = [];
  if (crore) parts.push(twoDigit(crore) + " Crore");
  if (lakh) parts.push(twoDigit(lakh) + " Lakh");
  if (thousand) parts.push(twoDigit(thousand) + " Thousand");
  if (rest) parts.push(threeDigit(rest));

  return parts.join(" ");
}

export function priceInWords(val: string): string {
  if (val === "Connect for Price") return "";
  const cleaned = val.replace(/[^0-9]/g, "");
  if (!cleaned) return "";
  const n = parseInt(cleaned, 10);
  if (isNaN(n) || n === 0) return "";
  return numberToWordsIndian(n) + " Rupees";
}
