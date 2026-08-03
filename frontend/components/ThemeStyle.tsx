import { getSettings } from "@/lib/serverData";

function darkenHex(hex: string, amount: number = 0.15): string {
  hex = hex.replace("#", "");
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  r = Math.max(0, Math.round(r * (1 - amount)));
  g = Math.max(0, Math.round(g * (1 - amount)));
  b = Math.max(0, Math.round(b * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function isValidHex(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export default async function ThemeStyle() {
  const settings = await getSettings();
  const primary = isValidHex(settings.primary_color || "") ? settings.primary_color : undefined;
  const secondary = isValidHex(settings.secondary_color || "") ? settings.secondary_color : undefined;

  if (!primary && !secondary) return null;

  const css = [
    `:root {`,
    primary ? `  --primary: ${primary};` : "",
    primary ? `  --primary-hover: ${darkenHex(primary)};` : "",
    secondary ? `  --secondary: ${secondary};` : "",
    secondary ? `  --secondary-hover: ${darkenHex(secondary)};` : "",
    `}`,
  ].join("\n");

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
