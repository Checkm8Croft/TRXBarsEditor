import { createElement } from "../dom.js";
import { hslToRgb, normalizeHexColor, parseHexColor, rgbToHex, rgbToHsl } from "../hsl.js";

export class ColorModal {
  constructor({ onChange }) {
    this.onChange = onChange;
    this.modalEl = null;
    this.state = null;
  }

  open({ title, initialHex }) {
    this.close();

    const normalized = normalizeHexColor(initialHex) || "#000000";
    const rgb = parseHexColor(normalized);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    this.state = { currentHex: normalized, rgb: { ...rgb }, hsl: { ...hsl } };

    const backdrop = createElement("div", { class: "modal-backdrop" });
    const modal = createElement("div", { class: "modal" });
    const header = createElement("div", { class: "modal-header" }, [
      createElement("div", { class: "modal-title", text: title }),
      (() => {
        const close = createElement("button", { type: "button", text: "Close" });
        close.addEventListener("click", () => this.close());
        return close;
      })(),
    ]);

    const preview = createElement("div", { class: "modal-color-preview" });
    preview.style.background = normalized;

    const hexInput = createElement("input", {
      type: "text",
      value: normalized,
      class: "modal-hex",
    });
    const hexRow = createElement("div", { class: "modal-row" }, [
      createElement("label", { text: "HEX" }),
      hexInput,
    ]);

    const sliders = createElement("div", { class: "modal-sliders" });
    const rgbR = this.makeSlider("R", 0, 255, 1, rgb.r);
    const rgbG = this.makeSlider("G", 0, 255, 1, rgb.g);
    const rgbB = this.makeSlider("B", 0, 255, 1, rgb.b);
    const hslH = this.makeSlider("H", 0, 360, 1, Math.round(hsl.h));
    const hslS = this.makeSlider("S", 0, 100, 1, Math.round(hsl.s));
    const hslL = this.makeSlider("L", 0, 100, 1, Math.round(hsl.l));
    sliders.appendChild(rgbR.el);
    sliders.appendChild(rgbG.el);
    sliders.appendChild(rgbB.el);
    sliders.appendChild(hslH.el);
    sliders.appendChild(hslS.el);
    sliders.appendChild(hslL.el);

    const applyHex = () => {
      if (this.state == null) {
        return;
      }
      const next = normalizeHexColor(hexInput.value);
      if (next == null) {
        return;
      }
      const nextRgb = parseHexColor(next);
      const nextHsl = rgbToHsl(nextRgb.r, nextRgb.g, nextRgb.b);
      this.state.currentHex = next;
      this.state.rgb = nextRgb;
      this.state.hsl = nextHsl;
      preview.style.background = next;
      rgbR.set(nextRgb.r);
      rgbG.set(nextRgb.g);
      rgbB.set(nextRgb.b);
      hslH.set(Math.round(nextHsl.h));
      hslS.set(Math.round(nextHsl.s));
      hslL.set(Math.round(nextHsl.l));
      this.onChange(next);
    };

    const applyRgb = () => {
      if (this.state == null) {
        return;
      }
      const r = Number(rgbR.input.value);
      const g = Number(rgbG.input.value);
      const b = Number(rgbB.input.value);
      const next = rgbToHex(r, g, b);
      const nextHsl = rgbToHsl(r, g, b);
      this.state.currentHex = next;
      this.state.rgb = { r, g, b, a: 255 };
      this.state.hsl = nextHsl;
      preview.style.background = next;
      hexInput.value = next;
      hslH.set(Math.round(nextHsl.h));
      hslS.set(Math.round(nextHsl.s));
      hslL.set(Math.round(nextHsl.l));
      this.onChange(next);
    };

    const applyHsl = () => {
      if (this.state == null) {
        return;
      }
      const hh = Number(hslH.input.value);
      const ss = Number(hslS.input.value);
      const ll = Number(hslL.input.value);
      const nextRgb = hslToRgb(hh, ss, ll);
      const next = rgbToHex(nextRgb.r, nextRgb.g, nextRgb.b);
      this.state.currentHex = next;
      this.state.rgb = nextRgb;
      this.state.hsl = { h: hh, s: ss, l: ll };
      preview.style.background = next;
      hexInput.value = next;
      rgbR.set(nextRgb.r);
      rgbG.set(nextRgb.g);
      rgbB.set(nextRgb.b);
      this.onChange(next);
    };

    hexInput.addEventListener("change", applyHex);
    hexInput.addEventListener("blur", applyHex);
    rgbR.input.addEventListener("input", applyRgb);
    rgbG.input.addEventListener("input", applyRgb);
    rgbB.input.addEventListener("input", applyRgb);
    hslH.input.addEventListener("input", applyHsl);
    hslS.input.addEventListener("input", applyHsl);
    hslL.input.addEventListener("input", applyHsl);

    const onBackdrop = (e) => {
      if (e.target === backdrop) {
        this.close();
      }
    };
    backdrop.addEventListener("click", onBackdrop);
    window.addEventListener("keydown", this.onModalKeyDown, true);

    modal.appendChild(header);
    modal.appendChild(preview);
    modal.appendChild(hexRow);
    modal.appendChild(sliders);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this.modalEl = backdrop;
  }

  close() {
    if (this.modalEl != null) {
      this.modalEl.remove();
      this.modalEl = null;
    }
    window.removeEventListener("keydown", this.onModalKeyDown, true);
    this.state = null;
  }

  onModalKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    }
  };

  makeSlider(label, min, max, step, value) {
    const input = createElement("input", {
      type: "range",
      min: String(min),
      max: String(max),
      step: String(step),
      value: String(value),
    });
    const out = createElement("output", { text: String(value) });
    input.addEventListener("input", () => {
      out.textContent = String(input.value);
    });
    const el = createElement("div", { class: "modal-slider" }, [
      createElement("label", { text: label }),
      input,
      out,
    ]);
    return {
      el,
      input,
      set: (v) => {
        input.value = String(v);
        out.textContent = String(v);
      },
    };
  }
}
