export function normalizeHexColorForPicker(hex) {
  const normalized = normalizeHexColor(hex);
  return normalized != null ? normalized : "#000000";
}

export function normalizeHexColor(hex) {
  const s = String(hex || "").trim();
  const m = /^#(?<r>[0-9a-fA-F]{2})(?<g>[0-9a-fA-F]{2})(?<b>[0-9a-fA-F]{2})$/.exec(s);
  if (m == null || m.groups == null) {
    return null;
  }
  return `#${m.groups.r.toLowerCase()}${m.groups.g.toLowerCase()}${m.groups.b.toLowerCase()}`;
}

export function parseHexColor(hex) {
  const normalized = normalizeHexColor(hex);
  if (normalized == null) {
    return { r: 0, g: 0, b: 0, a: 255 };
  }
  const m = /^#(?<r>[0-9a-f]{2})(?<g>[0-9a-f]{2})(?<b>[0-9a-f]{2})$/.exec(normalized);
  if (m == null || m.groups == null) {
    return { r: 0, g: 0, b: 0, a: 255 };
  }
  return {
    r: Number.parseInt(m.groups.r, 16),
    g: Number.parseInt(m.groups.g, 16),
    b: Number.parseInt(m.groups.b, 16),
    a: 255,
  };
}

export function rgbaToHex(rgba) {
  const r = Math.min(255, Math.max(0, rgba.r | 0)).toString(16).padStart(2, "0");
  const g = Math.min(255, Math.max(0, rgba.g | 0)).toString(16).padStart(2, "0");
  const b = Math.min(255, Math.max(0, rgba.b | 0)).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

export function rgbToHsl(r, g, b) {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const delta = max - min;

  let h = 0;
  if (delta !== 0) {
    if (max === rr) {
      h = ((gg - bb) / delta) % 6;
    } else if (max === gg) {
      h = (bb - rr) / delta + 2;
    } else {
      h = (rr - gg) / delta + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  return { h, s: s * 100, l: l * 100 };
}

export function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.min(100, Math.max(0, s)) / 100;
  const ll = Math.min(100, Math.max(0, l)) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let rr = 0;
  let gg = 0;
  let bb = 0;
  if (hh < 60) {
    rr = c;
    gg = x;
    bb = 0;
  } else if (hh < 120) {
    rr = x;
    gg = c;
    bb = 0;
  } else if (hh < 180) {
    rr = 0;
    gg = c;
    bb = x;
  } else if (hh < 240) {
    rr = 0;
    gg = x;
    bb = c;
  } else if (hh < 300) {
    rr = x;
    gg = 0;
    bb = c;
  } else {
    rr = c;
    gg = 0;
    bb = x;
  }

  const r = Math.round((rr + m) * 255);
  const g = Math.round((gg + m) * 255);
  const b = Math.round((bb + m) * 255);
  return rgbaToHex({ r, g, b, a: 255 });
}

export function adjustHexHsl(hex, dh, ds, dl) {
  const normalized = normalizeHexColor(hex);
  if (normalized == null) {
    return "#000000";
  }
  const rgb = parseHexColor(normalized);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const hh = hsl.h + dh;
  const ss = hsl.s + ds;
  const ll = hsl.l + dl;
  return hslToHex(hh, ss, ll);
}
