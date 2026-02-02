import { parseHexColor, rgbaToHex } from "./hsl.js";

export function drawBarPreview(canvas, theme, percent, smooth, barColorSteps) {
  const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  const cssWidth = Math.max(1, Math.floor(canvas.getBoundingClientRect().width));
  const cssHeight = Math.max(1, Math.floor(canvas.getBoundingClientRect().height));
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = cssWidth;
  const h = cssHeight;

  // Preview path should mirror `src/trx/game/ui/elements/bar.c`:
  // border = padding = h / (UI_BAR_COLOR_STEPS + 4)
  const border = Math.max(1, Math.floor(h / (barColorSteps + 4)));
  const padding = border;

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const fill = clamp01(percent);

  if (theme.kind === "ps1") {
    drawBilinearGradientRect(
      ctx,
      { x: 0, y: 0, w, h },
      theme.border_tl || "#000000",
      theme.border_tr || "#000000",
      theme.border_br || "#000000",
      theme.border_bl || "#000000",
    );
  } else {
    drawSolidRect(ctx, { x: 0, y: 0, w, h }, theme.border_light || "#ffffff");
    // PC border draws the dark quad inset by border, subtracting border once.
    drawSolidRect(
      ctx,
      { x: border, y: border, w: w - border, h: h - border },
      theme.border_dark || "#404040",
    );
  }

  const innerRect = {
    x: border,
    y: border,
    w: Math.max(0, w - border * 2),
    h: Math.max(0, h - border * 2),
  };
  drawSolidRect(ctx, innerRect, "#000000");

  const rect = {
    x: innerRect.x + padding,
    y: innerRect.y + padding,
    w: Math.floor(Math.max(0, innerRect.w - padding * 2) * fill),
    h: Math.max(0, innerRect.h - padding * 2),
  };
  if (rect.w <= 0 || rect.h <= 0) {
    return;
  }

  if (theme.kind === "ps1") {
    const rampLeft = Array.isArray(theme.ramps) ? theme.ramps[0] : null;
    const rampRight = Array.isArray(theme.ramps) ? theme.ramps[1] : null;
    if (!Array.isArray(rampLeft) || !Array.isArray(rampRight)) {
      return;
    }

    if (smooth) {
      for (let i = 0; i < barColorSteps - 1; i++) {
        const ctl = rampLeft[i];
        const ctr = rampRight[i];
        const cbl = rampLeft[i + 1];
        const cbr = rampRight[i + 1];
        const ctrm = mixColors(ctl, ctr, percent);
        const cbrm = mixColors(cbl, cbr, percent);

        const y1 = rect.y + Math.floor((i * rect.h) / (barColorSteps - 1));
        const y2 =
          i === barColorSteps - 2
            ? rect.y + rect.h
            : rect.y + Math.floor(((i + 1) * rect.h) / (barColorSteps - 1));
        const segH = Math.max(1, y2 - y1);
        drawBilinearGradientRect(ctx, { x: rect.x, y: y1, w: rect.w, h: segH }, ctl, ctrm, cbrm, cbl);
      }
    } else {
      for (let i = 0; i < barColorSteps; i++) {
        const cl = rampLeft[i];
        const cr = rampRight[i];
        const crm = mixColors(cl, cr, percent);

        const y1 = rect.y + Math.floor((i * rect.h) / barColorSteps);
        const y2 = i === barColorSteps - 1 ? rect.y + rect.h : rect.y + Math.floor(((i + 1) * rect.h) / barColorSteps);
        const segH = Math.max(1, y2 - y1);
        drawBilinearGradientRect(ctx, { x: rect.x, y: y1, w: rect.w, h: segH }, cl, crm, crm, cl);
      }
    }
    return;
  }

  const ramp = Array.isArray(theme.ramp) ? theme.ramp : [];
  if (ramp.length !== barColorSteps) {
    return;
  }
  if (smooth) {
    for (let i = 0; i < barColorSteps - 1; i++) {
      const y1 = rect.y + Math.floor((i * rect.h) / (barColorSteps - 1));
      const y2 =
        i === barColorSteps - 2 ? rect.y + rect.h : rect.y + Math.floor(((i + 1) * rect.h) / (barColorSteps - 1));
      const segH = Math.max(1, y2 - y1);
      drawVerticalGradientRect(ctx, { x: rect.x, y: y1, w: rect.w, h: segH }, ramp[i], ramp[i + 1]);
    }
    return;
  }
  for (let i = 0; i < barColorSteps; i++) {
    const y1 = rect.y + Math.floor((i * rect.h) / barColorSteps);
    const y2 = i === barColorSteps - 1 ? rect.y + rect.h : rect.y + Math.floor(((i + 1) * rect.h) / barColorSteps);
    const segH = Math.max(1, y2 - y1);
    drawSolidRect(ctx, { x: rect.x, y: y1, w: rect.w, h: segH }, ramp[i]);
  }
}

function drawSolidRect(ctx, rect, color) {
  ctx.fillStyle = color;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function drawVerticalGradientRect(ctx, rect, topColor, bottomColor) {
  const grad = ctx.createLinearGradient(0, rect.y, 0, rect.y + rect.h);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
}

function drawBilinearGradientRect(ctx, rect, tl, tr, br, bl) {
  const sampleW = 40;
  const sampleH = 40;
  const off = document.createElement("canvas");
  off.width = sampleW;
  off.height = sampleH;
  const octx = off.getContext("2d");
  const img = octx.createImageData(sampleW, sampleH);

  const cTL = parseHexColor(tl);
  const cTR = parseHexColor(tr);
  const cBR = parseHexColor(br);
  const cBL = parseHexColor(bl);

  for (let y = 0; y < sampleH; y++) {
    const fy = sampleH <= 1 ? 0 : y / (sampleH - 1);
    for (let x = 0; x < sampleW; x++) {
      const fx = sampleW <= 1 ? 0 : x / (sampleW - 1);
      const top = lerpRgba(cTL, cTR, fx);
      const bottom = lerpRgba(cBL, cBR, fx);
      const out = lerpRgba(top, bottom, fy);
      const idx = (y * sampleW + x) * 4;
      img.data[idx + 0] = out.r;
      img.data[idx + 1] = out.g;
      img.data[idx + 2] = out.b;
      img.data[idx + 3] = out.a;
    }
  }

  octx.putImageData(img, 0, 0);
  ctx.drawImage(off, rect.x, rect.y, rect.w, rect.h);
}

function lerpRgba(a, b, t) {
  const tt = Math.min(1, Math.max(0, t));
  return {
    r: Math.round(a.r * (1 - tt) + b.r * tt),
    g: Math.round(a.g * (1 - tt) + b.g * tt),
    b: Math.round(a.b * (1 - tt) + b.b * tt),
    a: Math.round(a.a * (1 - tt) + b.a * tt),
  };
}

function mixColors(c0, c1, percent) {
  const a = parseHexColor(c0);
  const b = parseHexColor(c1);
  return rgbaToHex(lerpRgba(a, b, percent));
}
