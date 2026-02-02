import { createElement } from "../dom.js";
import { normalizeHexColor } from "../hsl.js";
import { drawBarPreview } from "../draw.js";
import { buildThemeFromSection } from "../theme.js";

export class EditorView {
  constructor({
    barColorSteps,
    onPreviewBarValue,
    onSetDraftValue,
    onConfirmDraft,
    onCancelDraft,
    onResetDraft,
    onSetDraftHsl,
    onSelectTheme,
    onClearSelection,
    onAddTheme,
    onCopyTheme,
    onRenameTheme,
    onDeleteTheme,
    onAddBar,
    onCopyBar,
    onRenameBar,
    onDeleteBar,
    onMoveBar,
  }) {
    this.barColorSteps = barColorSteps;
    this.handlers = {
      onPreviewBarValue,
      onSetDraftValue,
      onConfirmDraft,
      onCancelDraft,
      onResetDraft,
      onSetDraftHsl,
      onSelectTheme,
      onClearSelection,
      onAddTheme,
      onCopyTheme,
      onRenameTheme,
      onDeleteTheme,
      onAddBar,
      onCopyBar,
      onRenameBar,
      onDeleteBar,
      onMoveBar,
    };
    this.dragState = null;
    this.editorMountEl = null;
    this.editorMetaEl = null;
    this.bigPreviewCanvasEl = null;
    this.modalEl = null;
    this.modalState = null;
    this.saveBtnEl = null;
    this.resetBtnEl = null;
  }

  mount(editorMountEl, editorMetaEl) {
    this.editorMountEl = editorMountEl;
    this.editorMetaEl = editorMetaEl;
  }

  render(workspace, state, draft) {
    if (this.editorMountEl == null || this.editorMetaEl == null) {
      return;
    }
    this.editorMountEl.innerHTML = "";

    this.editorMountEl.appendChild(this.renderThemeCrudBox(workspace, state));

    if (state.selected == null) {
      this.editorMetaEl.textContent = "No selection";
      this.editorMountEl.appendChild(
        createElement("div", {
          class: "muted",
          text: "Click a bar name or preview to edit its colors. Edits are remembered in localStorage.",
        }),
      );
      return;
    }

    const sectionKey = state.selected.sectionKey;
    const barName = state.selected.barName;
    const section = workspace[sectionKey];

    if (section == null) {
      this.editorMetaEl.textContent = "Invalid selection";
      this.editorMountEl.appendChild(
        createElement("div", { class: "muted", text: "Selected theme not found." }),
      );
      return;
    }
    if (section.colors == null || section.colors[barName] == null) {
      this.editorMetaEl.textContent = `Theme: ${sectionKey}`;
      this.editorMountEl.appendChild(
        createElement("div", { class: "muted", text: "Selected bar not found." }),
      );
      return;
    }

    this.editorMetaEl.textContent = `${sectionKey}.${barName}`;
    const value = section.colors[barName];
    const style = String(section.style || "").toLowerCase();

    this.editorMountEl.appendChild(
      this.renderBarEditor(sectionKey, barName, section, value, style, state, draft),
    );
  }

  renderThemeCrudBox(workspace, state) {
    const box = createElement("div", { class: "box" });
    box.appendChild(this.renderThemeManager(workspace, state));
    box.appendChild(this.renderBarManager(workspace, state));
    return box;
  }

  renderBarEditor(sectionKey, barName, section, value, style, state, draft) {
    const wrap = createElement("div", { class: "box" });

    const hasDraft = draft != null;
    const draftValue = hasDraft ? draft.value : value;
    const draftHsl = hasDraft ? draft.hsl : { h: 0, s: 0, l: 0 };
    const dirty = hasDraft && draft.dirty === true;

    wrap.appendChild(createElement("div", { class: "tag", text: "Bar editor" }));

    // Big preview
    this.bigPreviewCanvasEl = createElement("canvas", { class: "bar-preview bar-preview-large" });
    wrap.appendChild(this.bigPreviewCanvasEl);

    // Confirm/Cancel
    const actions = createElement("div", { class: "row" });
    actions.style.justifyContent = "flex-start";
    actions.style.gap = "8px";
    const resetBtn = createElement("button", { type: "button", text: "Reset" });
    resetBtn.disabled = dirty !== true;
    resetBtn.addEventListener("click", () => this.handlers.onResetDraft());
    const saveBtn = createElement("button", { type: "button", text: "Save" });
    saveBtn.disabled = dirty !== true;
    saveBtn.addEventListener("click", () => this.handlers.onConfirmDraft());
    actions.appendChild(resetBtn);
    actions.appendChild(saveBtn);
    wrap.appendChild(actions);
    this.saveBtnEl = saveBtn;
    this.resetBtnEl = resetBtn;

    // HSL slider (absolute)
    wrap.appendChild(createElement("div", { class: "tag", text: "HSL" }));
    wrap.appendChild(this.renderBarAdjustControls(sectionKey, barName, draftValue, draftHsl));

    // Color ramps (inline)
    wrap.appendChild(createElement("div", { class: "tag", text: "Colors" }));
    wrap.appendChild(
      style === "ps1"
        ? this.renderPs1Colors(sectionKey, barName, draftValue, section)
        : this.renderPcColors(sectionKey, barName, draftValue, section),
    );

    // Initial draw: defer until layout so canvas has a real size.
    requestAnimationFrame(() =>
      this.redrawBigPreview(sectionKey, barName, section, draftValue, state),
    );
    return wrap;
  }

  syncDraftControls(draft) {
    if (this.saveBtnEl == null || this.resetBtnEl == null) {
      return;
    }
    const dirty = draft != null && draft.dirty === true;
    this.saveBtnEl.disabled = dirty !== true;
    this.resetBtnEl.disabled = dirty !== true;
  }

  redrawBigPreviewIfReady(workspace, state, draft) {
    if (this.bigPreviewCanvasEl == null) {
      return;
    }
    if (state.selected == null) {
      return;
    }
    const sectionKey = state.selected.sectionKey;
    const barName = state.selected.barName;
    const section = workspace[sectionKey];
    if (section == null || section.colors == null || section.colors[barName] == null) {
      return;
    }
    const value = section.colors[barName];
    this.redrawBigPreview(sectionKey, barName, section, value, state);
  }

  redrawBigPreview(sectionKey, barName, section, barValue, state) {
    if (this.bigPreviewCanvasEl == null) {
      return;
    }
    const theme = buildThemeFromSection(section, barValue, this.barColorSteps);
    this.bigPreviewCanvasEl.dataset.kind = theme.kind;
    this.bigPreviewCanvasEl.dataset.sectionKey = sectionKey;
    this.bigPreviewCanvasEl.dataset.barName = barName;
    this.bigPreviewCanvasEl.dataset.themeJson = JSON.stringify(theme);
    const rect = this.bigPreviewCanvasEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      requestAnimationFrame(() =>
        this.redrawBigPreview(sectionKey, barName, section, barValue, state),
      );
      return;
    }
    drawBarPreview(this.bigPreviewCanvasEl, theme, state.percent, state.smooth, this.barColorSteps);
  }

  updateSwatchesIfSelected(sectionKey, barName, barValue, state) {
    if (this.editorMountEl == null) {
      return;
    }
    if (state.selected == null) {
      return;
    }
    if (state.selected.sectionKey !== sectionKey || state.selected.barName !== barName) {
      return;
    }

    const applyRamp = (ramp, rampIndex) => {
      for (let i = 0; i < this.barColorSteps; i++) {
        const color = normalizeHexColor(String(ramp[i] || "#000000")) || "#000000";
        const sel =
          rampIndex == null
            ? `.color-swatch[data-color-index="${i}"]:not([data-ps1-ramp-index])`
            : `.color-swatch[data-color-index="${i}"][data-ps1-ramp-index="${rampIndex}"]`;
        const swatch = this.editorMountEl.querySelector(sel);
        if (swatch == null) {
          continue;
        }
        swatch.style.background = color;
      }
    };

    if (Array.isArray(barValue) && Array.isArray(barValue[0]) && Array.isArray(barValue[1])) {
      applyRamp(barValue[0], 0);
      applyRamp(barValue[1], 1);
      return;
    }
    if (Array.isArray(barValue)) {
      applyRamp(barValue, null);
    }
  }

  renderThemeManager(workspace, state) {
    const wrap = document.createElement("div");
    wrap.appendChild(createElement("div", { class: "tag", text: "Theme" }));

    const keys = Object.keys(workspace || {}).sort((a, b) => a.localeCompare(b));
    const select = createElement("select", { style: "width: 100%;" });
    select.appendChild(createElement("option", { value: "", text: "-- select theme --" }));
    for (const key of keys) {
      select.appendChild(createElement("option", { value: key, text: key }));
    }

    if (state.selected != null && state.selected.sectionKey) {
      select.value = state.selected.sectionKey;
    }

    select.addEventListener("change", () => {
      if (select.value.length === 0) {
        this.handlers.onClearSelection();
        return;
      }
      this.handlers.onSelectTheme(select.value);
    });

    const row = createElement("div", { class: "row" }, [
      createElement("label", { text: "Select" }),
      select,
    ]);
    row.style.alignItems = "stretch";
    row.style.gap = "10px";
    row.firstChild.style.paddingTop = "9px";

    const buttons = createElement("div", { class: "row" });
    buttons.style.justifyContent = "flex-start";
    buttons.style.gap = "8px";

    const addBtn = createElement("button", { type: "button", text: "Add" });
    addBtn.addEventListener("click", () => {
      const kind = (window.prompt("New theme kind? (pc|ps1)", "pc") || "").trim().toLowerCase();
      if (kind !== "pc" && kind !== "ps1") {
        return;
      }
      const key = (window.prompt("New theme key?", "") || "").trim();
      if (key.length === 0) {
        return;
      }
      if (workspace[key] != null) {
        window.alert("Theme key already exists.");
        return;
      }
      this.handlers.onAddTheme(key, kind);
    });

    const copyBtn = createElement("button", { type: "button", text: "Copy" });
    copyBtn.addEventListener("click", () => {
      if (select.value.length === 0) {
        return;
      }
      const key = (window.prompt("Copy to new theme key?", `${select.value}_copy`) || "").trim();
      if (key.length === 0) {
        return;
      }
      if (workspace[key] != null) {
        window.alert("Theme key already exists.");
        return;
      }
      this.handlers.onCopyTheme(select.value, key);
    });

    const renameBtn = createElement("button", { type: "button", text: "Rename" });
    renameBtn.addEventListener("click", () => {
      const from = select.value;
      if (from.length === 0) {
        return;
      }
      const to = (window.prompt("Rename theme to:", from) || "").trim();
      if (to.length === 0 || to === from) {
        return;
      }
      if (workspace[to] != null) {
        window.alert("Theme key already exists.");
        return;
      }
      this.handlers.onRenameTheme(from, to);
    });

    const delBtn = createElement("button", { type: "button", text: "Delete" });
    delBtn.addEventListener("click", () => {
      const key = select.value;
      if (key.length === 0) {
        return;
      }
      const ok = window.confirm(`Delete theme "${key}"?`);
      if (ok !== true) {
        return;
      }
      this.handlers.onDeleteTheme(key);
    });

    buttons.appendChild(addBtn);
    buttons.appendChild(copyBtn);
    buttons.appendChild(renameBtn);
    buttons.appendChild(delBtn);

    wrap.appendChild(row);
    wrap.appendChild(buttons);
    return wrap;
  }

  renderBarManager(workspace, state) {
    const wrap = document.createElement("div");
    wrap.appendChild(createElement("div", { class: "tag", text: "Bar" }));

    const themeKey = state.selected != null ? state.selected.sectionKey : null;
    const barName = state.selected != null ? state.selected.barName : null;
    if (themeKey == null || workspace[themeKey] == null) {
      wrap.appendChild(
        createElement("div", { class: "muted", text: "Select a theme/bar to manage bars." }),
      );
      return wrap;
    }
    const theme = workspace[themeKey];
    const style = String(theme.style || "").toLowerCase();
    const hasSelection = barName != null && theme.colors != null && theme.colors[barName] != null;
    const namesInOrder = Object.keys(theme.colors || {});
    const idx = barName != null ? namesInOrder.indexOf(barName) : -1;

    const buttons = createElement("div", { class: "row" });
    buttons.style.justifyContent = "flex-start";
    buttons.style.flexWrap = "wrap";
    buttons.style.gap = "8px";

    const addBtn = createElement("button", { type: "button", text: "New" });
    addBtn.addEventListener("click", () => {
      const name = (window.prompt("New bar name?", "") || "").trim();
      if (name.length === 0) {
        return;
      }
      if (theme.colors && theme.colors[name] != null) {
        window.alert("Bar already exists.");
        return;
      }
      const value =
        style === "ps1"
          ? [Array(this.barColorSteps).fill("#000000"), Array(this.barColorSteps).fill("#000000")]
          : Array(this.barColorSteps).fill("#000000");
      this.handlers.onAddBar(themeKey, name, value);
    });

    const copyBtn = createElement("button", { type: "button", text: "Dupe" });
    copyBtn.disabled = hasSelection !== true;
    copyBtn.addEventListener("click", () => {
      if (hasSelection !== true) {
        return;
      }
      const from = barName;
      const to = (window.prompt("Duplicate bar to:", `${from}_copy`) || "").trim();
      if (to.length === 0) {
        return;
      }
      if (theme.colors && theme.colors[to] != null) {
        window.alert("Bar already exists.");
        return;
      }
      this.handlers.onCopyBar(themeKey, from, to);
    });

    const renameBtn = createElement("button", { type: "button", text: "Rename" });
    renameBtn.disabled = hasSelection !== true;
    renameBtn.addEventListener("click", () => {
      if (hasSelection !== true) {
        return;
      }
      const from = barName;
      const to = (window.prompt("Rename bar to:", from) || "").trim();
      if (to.length === 0 || to === from) {
        return;
      }
      if (theme.colors && theme.colors[to] != null) {
        window.alert("Bar already exists.");
        return;
      }
      this.handlers.onRenameBar(themeKey, from, to);
    });

    const delBtn = createElement("button", { type: "button", text: "Delete" });
    delBtn.disabled = hasSelection !== true;
    delBtn.addEventListener("click", () => {
      if (hasSelection !== true) {
        return;
      }
      const ok = window.confirm(`Delete bar "${barName}"?`);
      if (ok !== true) {
        return;
      }
      this.handlers.onDeleteBar(themeKey, barName);
    });

    const upBtn = createElement("button", { type: "button", text: "Move up" });
    upBtn.disabled = hasSelection !== true || idx <= 0;
    upBtn.addEventListener("click", () => {
      if (hasSelection !== true) {
        return;
      }
      this.handlers.onMoveBar(themeKey, barName, -1);
    });

    const downBtn = createElement("button", { type: "button", text: "Move down" });
    downBtn.disabled = hasSelection !== true || idx < 0 || idx >= namesInOrder.length - 1;
    downBtn.addEventListener("click", () => {
      if (hasSelection !== true) {
        return;
      }
      this.handlers.onMoveBar(themeKey, barName, 1);
    });

    buttons.appendChild(addBtn);
    buttons.appendChild(copyBtn);
    buttons.appendChild(renameBtn);
    buttons.appendChild(delBtn);
    buttons.appendChild(upBtn);
    buttons.appendChild(downBtn);

    wrap.appendChild(
      createElement("div", {
        class: "muted",
        text: hasSelection ? `Selected: ${themeKey}.${barName}` : `Theme: ${themeKey}`,
      }),
    );
    wrap.appendChild(buttons);
    return wrap;
  }

  renderBarAdjustControls(sectionKey, barName, barValue, hsl) {
    const wrap = document.createElement("div");
    wrap.appendChild(
      createElement("div", {
        class: "muted",
        text: "Applies to all 5 steps (and both PS1 ramps) at once.",
      }),
    );

    const h = createElement("input", {
      type: "range",
      min: "-180",
      max: "180",
      step: "1",
      value: String(hsl.h || 0),
    });
    const s = createElement("input", {
      type: "range",
      min: "-100",
      max: "100",
      step: "1",
      value: String(hsl.s || 0),
    });
    const l = createElement("input", {
      type: "range",
      min: "-100",
      max: "100",
      step: "1",
      value: String(hsl.l || 0),
    });
    const ho = createElement("output", { text: String(hsl.h || 0) });
    const so = createElement("output", { text: String(hsl.s || 0) });
    const lo = createElement("output", { text: String(hsl.l || 0) });

    const apply = () => {
      const nextH = Number(h.value);
      const nextS = Number(s.value);
      const nextL = Number(l.value);
      ho.textContent = String(nextH);
      so.textContent = String(nextS);
      lo.textContent = String(nextL);
      this.handlers.onSetDraftHsl(nextH, nextS, nextL);
    };

    h.addEventListener("input", apply);
    s.addEventListener("input", apply);
    l.addEventListener("input", apply);

    wrap.appendChild(
      createElement("div", { class: "sliders" }, [
        createElement("label", { text: "Hue Δ" }),
        h,
        ho,
        createElement("label", { text: "Sat Δ" }),
        s,
        so,
        createElement("label", { text: "Light Δ" }),
        l,
        lo,
      ]),
    );

    return wrap;
  }

  renderPcColors(sectionKey, barName, value, section) {
    const wrap = document.createElement("div");
    wrap.appendChild(createElement("div", { class: "tag", text: "Ramp" }));
    wrap.appendChild(this.renderSwatchRow(sectionKey, barName, value, null, section));
    return wrap;
  }

  renderPs1Colors(sectionKey, barName, value, section) {
    const wrap = document.createElement("div");
    wrap.appendChild(createElement("div", { class: "tag", text: "Left ramp" }));
    wrap.appendChild(this.renderSwatchRow(sectionKey, barName, value[0], 0, section));
    wrap.appendChild(createElement("div", { class: "tag", text: "Right ramp" }));
    wrap.appendChild(this.renderSwatchRow(sectionKey, barName, value[1], 1, section));
    return wrap;
  }

  renderSwatchRow(sectionKey, barName, ramp, ps1RampIndex, section) {
    const row = createElement("div", { class: "swatch-row" });
    for (let i = 0; i < this.barColorSteps; i++) {
      const color = String(ramp[i] || "#000000");
      row.appendChild(this.renderSwatch(sectionKey, barName, color, ps1RampIndex, i, section));
    }
    return row;
  }

  renderSwatch(sectionKey, barName, color, ps1RampIndex, idx, section) {
    const normalized = normalizeHexColor(color) || "#000000";
    const swatch = createElement("div", { class: "color-swatch", role: "button", tabindex: "0" });
    swatch.style.background = normalized;
    swatch.dataset.colorIndex = String(idx);
    if (ps1RampIndex != null) {
      swatch.dataset.ps1RampIndex = String(ps1RampIndex);
    }
    swatch.title = "Click to edit";

    const open = () => {
      this.openColorModal({
        sectionKey,
        barName,
        ps1RampIndex,
        colorIndex: idx,
        section,
        initialHex: normalized,
      });
    };

    swatch.addEventListener("click", open);
    swatch.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });

    return swatch;
  }

  applySwatchChange(section, sectionKey, barName, ps1RampIndex, colorIndex, colorHex) {
    const current = section && section.colors ? section.colors[barName] : null;
    if (current == null) {
      return current;
    }

    const style = String(section.style || "").toLowerCase();
    if (style === "ps1") {
      const left =
        Array.isArray(current) && Array.isArray(current[0])
          ? [...current[0]]
          : Array(this.barColorSteps).fill("#000000");
      const right =
        Array.isArray(current) && Array.isArray(current[1])
          ? [...current[1]]
          : Array(this.barColorSteps).fill("#000000");
      if (ps1RampIndex === 1) {
        right[colorIndex] = colorHex;
      } else {
        left[colorIndex] = colorHex;
      }
      return [left, right];
    }

    const ramp = Array.isArray(current) ? [...current] : Array(this.barColorSteps).fill("#000000");
    ramp[colorIndex] = colorHex;
    return ramp;
  }

  openColorModal({ sectionKey, barName, ps1RampIndex, colorIndex, section, initialHex }) {
    this.closeColorModal();

    const parsed = this.hexToRgb(initialHex);
    const hsl = this.rgbToHsl(parsed.r, parsed.g, parsed.b);
    this.modalState = {
      sectionKey,
      barName,
      ps1RampIndex,
      colorIndex,
      section,
      currentHex: initialHex,
      rgb: { ...parsed },
      hsl: { ...hsl },
    };

    const backdrop = createElement("div", { class: "modal-backdrop" });
    const modal = createElement("div", { class: "modal" });
    const header = createElement("div", { class: "modal-header" }, [
      createElement("div", { class: "modal-title", text: `Edit ${sectionKey}.${barName}` }),
      (() => {
        const close = createElement("button", { type: "button", text: "Close" });
        close.addEventListener("click", () => this.closeColorModal());
        return close;
      })(),
    ]);

    const preview = createElement("div", { class: "modal-color-preview" });
    preview.style.background = initialHex;

    const hexInput = createElement("input", {
      type: "text",
      value: initialHex,
      class: "modal-hex",
    });
    const hexRow = createElement("div", { class: "modal-row" }, [
      createElement("label", { text: "HEX" }),
      hexInput,
    ]);

    const sliders = createElement("div", { class: "modal-sliders" });
    const rgbR = this.makeSlider("R", 0, 255, 1, parsed.r);
    const rgbG = this.makeSlider("G", 0, 255, 1, parsed.g);
    const rgbB = this.makeSlider("B", 0, 255, 1, parsed.b);
    const hslH = this.makeSlider("H", 0, 360, 1, Math.round(hsl.h));
    const hslS = this.makeSlider("S", 0, 100, 1, Math.round(hsl.s));
    const hslL = this.makeSlider("L", 0, 100, 1, Math.round(hsl.l));
    sliders.appendChild(rgbR.el);
    sliders.appendChild(rgbG.el);
    sliders.appendChild(rgbB.el);
    sliders.appendChild(hslH.el);
    sliders.appendChild(hslS.el);
    sliders.appendChild(hslL.el);

    const applyFromHex = () => {
      const normalized = normalizeHexColor(hexInput.value);
      if (normalized == null) {
        return;
      }
      const rgb = this.hexToRgb(normalized);
      const hsl2 = this.rgbToHsl(rgb.r, rgb.g, rgb.b);
      this.modalState.currentHex = normalized;
      this.modalState.rgb = rgb;
      this.modalState.hsl = hsl2;
      preview.style.background = normalized;
      rgbR.set(rgb.r);
      rgbG.set(rgb.g);
      rgbB.set(rgb.b);
      hslH.set(Math.round(hsl2.h));
      hslS.set(Math.round(hsl2.s));
      hslL.set(Math.round(hsl2.l));
      this.commitModalColor();
    };

    hexInput.addEventListener("change", applyFromHex);
    hexInput.addEventListener("blur", applyFromHex);

    const applyFromRgb = () => {
      const r = Number(rgbR.input.value);
      const g = Number(rgbG.input.value);
      const b = Number(rgbB.input.value);
      const hex = this.rgbToHex(r, g, b);
      const hsl2 = this.rgbToHsl(r, g, b);
      this.modalState.currentHex = hex;
      this.modalState.rgb = { r, g, b, a: 255 };
      this.modalState.hsl = hsl2;
      preview.style.background = hex;
      hexInput.value = hex;
      hslH.set(Math.round(hsl2.h));
      hslS.set(Math.round(hsl2.s));
      hslL.set(Math.round(hsl2.l));
      this.commitModalColor();
    };

    const applyFromHsl = () => {
      const hh = Number(hslH.input.value);
      const ss = Number(hslS.input.value);
      const ll = Number(hslL.input.value);
      const rgb = this.hslToRgb(hh, ss, ll);
      const hex = this.rgbToHex(rgb.r, rgb.g, rgb.b);
      this.modalState.currentHex = hex;
      this.modalState.rgb = rgb;
      this.modalState.hsl = { h: hh, s: ss, l: ll };
      preview.style.background = hex;
      hexInput.value = hex;
      rgbR.set(rgb.r);
      rgbG.set(rgb.g);
      rgbB.set(rgb.b);
      this.commitModalColor();
    };

    rgbR.input.addEventListener("input", applyFromRgb);
    rgbG.input.addEventListener("input", applyFromRgb);
    rgbB.input.addEventListener("input", applyFromRgb);
    hslH.input.addEventListener("input", applyFromHsl);
    hslS.input.addEventListener("input", applyFromHsl);
    hslL.input.addEventListener("input", applyFromHsl);

    modal.appendChild(header);
    modal.appendChild(preview);
    modal.appendChild(hexRow);
    modal.appendChild(sliders);

    const onBackdrop = (e) => {
      if (e.target === backdrop) {
        this.closeColorModal();
      }
    };
    backdrop.addEventListener("click", onBackdrop);
    window.addEventListener("keydown", this.onModalKeyDown, true);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    this.modalEl = backdrop;
  }

  closeColorModal() {
    if (this.modalEl != null) {
      this.modalEl.remove();
      this.modalEl = null;
    }
    window.removeEventListener("keydown", this.onModalKeyDown, true);
    this.modalState = null;
  }

  onModalKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      this.closeColorModal();
    }
  };

  commitModalColor() {
    if (this.modalState == null) {
      return;
    }
    const s = this.modalState.section;
    const nextValue = this.applySwatchChange(
      s,
      this.modalState.sectionKey,
      this.modalState.barName,
      this.modalState.ps1RampIndex,
      this.modalState.colorIndex,
      this.modalState.currentHex,
    );
    this.handlers.onSetDraftValue(this.modalState.sectionKey, this.modalState.barName, nextValue);
  }

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

  hexToRgb(hex) {
    const normalized = normalizeHexColor(hex) || "#000000";
    const m = /^#(?<r>[0-9a-f]{2})(?<g>[0-9a-f]{2})(?<b>[0-9a-f]{2})$/i.exec(normalized);
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

  rgbToHex(r, g, b) {
    const rr = Math.min(255, Math.max(0, r | 0))
      .toString(16)
      .padStart(2, "0");
    const gg = Math.min(255, Math.max(0, g | 0))
      .toString(16)
      .padStart(2, "0");
    const bb = Math.min(255, Math.max(0, b | 0))
      .toString(16)
      .padStart(2, "0");
    return `#${rr}${gg}${bb}`;
  }

  rgbToHsl(r, g, b) {
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

  hslToRgb(h, s, l) {
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

    return {
      r: Math.round((rr + m) * 255),
      g: Math.round((gg + m) * 255),
      b: Math.round((bb + m) * 255),
      a: 255,
    };
  }
}
