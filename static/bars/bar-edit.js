import { adjustHexHsl } from "./hsl.js";

export function adjustBarValueAbsolute(value, h, s, l) {
  if (Array.isArray(value) && Array.isArray(value[0]) && Array.isArray(value[1])) {
    const left = value[0].map((c) => adjustHexHsl(String(c), h, s, l));
    const right = value[1].map((c) => adjustHexHsl(String(c), h, s, l));
    return [left, right];
  }
  if (Array.isArray(value)) {
    return value.map((c) => adjustHexHsl(String(c), h, s, l));
  }
  return value;
}
