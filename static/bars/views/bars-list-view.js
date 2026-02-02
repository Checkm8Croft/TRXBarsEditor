import { createElement, cssEscape } from "../dom.js";
import { drawBarPreview } from "../draw.js";
import { buildThemeFromSection, describeThemeTooltip } from "../theme.js";

export class BarsListView {
  constructor({ barColorSteps }) {
    this.barColorSteps = barColorSteps;
    this.rootEl = null;
    this.editorMountEl = null;
    this.editorMetaEl = null;
    this.fillValueEl = null;
    this.resetEditsButtonEl = null;
  }

  render(rootEl, workspace, state, handlers) {
    this.rootEl = rootEl;
    rootEl.innerHTML = "";

    const controls = this.renderControls(state, handlers);

    const grid = createElement("div", { class: "grid" });

    const sidebar = createElement("div", { class: "panel sidebar" });
    sidebar.appendChild(
      createElement("div", { class: "panel-header" }, [
        createElement("h2", { text: "Editor" }),
        createElement("div", { class: "meta", text: "No selection" }),
      ]),
    );

    this.editorMetaEl = sidebar.querySelector(".meta");
    this.editorMountEl = createElement("div", { class: "editor" });
    sidebar.appendChild(this.editorMountEl);

    const columnsWrap = createElement("div", { class: "grid", id: "columnsGrid" });
    columnsWrap.style.gridTemplateColumns = "repeat(4, minmax(240px, 1fr))";
    columnsWrap.style.gap = "12px";

    grid.appendChild(sidebar);
    grid.appendChild(columnsWrap);

    rootEl.appendChild(controls);
    rootEl.appendChild(grid);

    const entries = Object.entries(workspace || {}).filter(([, value]) => value != null);
    entries.sort(([a], [b]) => a.localeCompare(b));

    for (const [themeKey, section] of entries) {
      const colors = section.colors || {};
      const names = Object.keys(colors);

      const panel = createElement("div", { class: "panel" });
      const header = createElement("div", { class: "panel-header" }, [
        createElement("h2", { text: themeKey }),
        createElement("div", {
          class: "meta",
          text: `${names.length} bar${names.length === 1 ? "" : "s"} • ${
            String(section.style || "").toLowerCase() === "ps1" ? "ps1" : "pc"
          }`,
        }),
      ]);

      const bars = createElement("div", { class: "bars" });
      for (const barName of names) {
        const value = colors[barName];
        const tracksEl = createElement("div", { class: "tracks" });

        const btn = createElement("button", {
          type: "button",
          text: barName,
          "data-section-key": themeKey,
          "data-bar-name": barName,
        });
        btn.addEventListener("click", () => handlers.onSelectBar(themeKey, barName));

        const row = createElement("div", { class: "bar" }, [btn, tracksEl]);
        bars.appendChild(row);

        const theme = buildThemeFromSection(section, value, this.barColorSteps);
        const preview = this.createBarCanvas(barName, themeKey, theme, handlers);
        tracksEl.appendChild(preview);
      }

      panel.appendChild(header);
      panel.appendChild(bars);
      columnsWrap.appendChild(panel);
    }

    this.redrawAllBars(state);
    this.syncResetEditsButton(state);
    return { editorMountEl: this.editorMountEl, editorMetaEl: this.editorMetaEl };
  }

  renderControls(state, handlers) {
    const fillRange = createElement("input", {
      type: "range",
      min: "0",
      max: "1",
      step: "0.01",
      value: String(state.percent),
    });
    fillRange.addEventListener("input", () => handlers.onPercentChange(Number(fillRange.value)));

    this.fillValueEl = createElement("span", { text: `${Math.round(state.percent * 100)}%` });

    const fill = createElement("label", {}, [
      createElement("span", { text: "Fill" }),
      fillRange,
      this.fillValueEl,
    ]);

    const smoothLabel = createElement("label", {});
    const cb = createElement("input", { type: "checkbox" });
    cb.checked = state.smooth;
    cb.addEventListener("change", () => handlers.onSmoothChange(cb.checked));
    smoothLabel.appendChild(cb);
    smoothLabel.appendChild(createElement("span", { text: "Smooth" }));

    this.resetEditsButtonEl = createElement("button", { type: "button", text: "Reset edits" });
    this.resetEditsButtonEl.addEventListener("click", () => handlers.onResetEdits());

    return createElement("div", { class: "controls" }, [
      fill,
      smoothLabel,
      this.resetEditsButtonEl,
    ]);
  }

  createBarCanvas(barName, sectionKey, theme, handlers) {
    const canvas = createElement("canvas", { class: "bar-preview" });
    canvas.dataset.kind = theme.kind;
    canvas.dataset.name = barName;
    canvas.dataset.sectionKey = sectionKey;
    canvas.dataset.barName = barName;
    canvas.dataset.themeJson = JSON.stringify(theme);
    canvas.title = describeThemeTooltip(barName, theme);
    canvas.addEventListener("click", () => handlers.onSelectBar(sectionKey, barName));
    return canvas;
  }

  redrawAllBars(state) {
    if (this.fillValueEl != null) {
      this.fillValueEl.textContent = `${Math.round(state.percent * 100)}%`;
    }

    for (const canvas of document.querySelectorAll("canvas.bar-preview")) {
      const themeJson = canvas.dataset.themeJson;
      if (themeJson == null) {
        continue;
      }
      const theme = JSON.parse(themeJson);
      drawBarPreview(canvas, theme, state.percent, state.smooth, this.barColorSteps);
    }

    for (const btn of document.querySelectorAll("button[data-section-key][data-bar-name]")) {
      const selected =
        state.selected != null &&
        btn.dataset.sectionKey === state.selected.sectionKey &&
        btn.dataset.barName === state.selected.barName;
      btn.classList.toggle("selected", selected);
    }
  }

  syncResetEditsButton(state) {
    if (this.resetEditsButtonEl == null) {
      return;
    }
    this.resetEditsButtonEl.disabled = state.hasAnyEdits !== true;
  }

  updateRenderedBar(sectionKey, barName, section, barValue, state) {
    const canvases = document.querySelectorAll(
      `canvas.bar-preview[data-section-key="${cssEscape(sectionKey)}"][data-bar-name="${cssEscape(barName)}"]`,
    );
    for (const canvas of canvases) {
      const theme = buildThemeFromSection(section, barValue, this.barColorSteps);
      canvas.dataset.themeJson = JSON.stringify(theme);
      canvas.title = describeThemeTooltip(barName, theme);
    }
    this.redrawAllBars(state);
  }

  flashSavedBar(sectionKey, barName) {
    const btn = document.querySelector(
      `button[data-section-key="${cssEscape(sectionKey)}"][data-bar-name="${cssEscape(barName)}"]`,
    );
    const canvases = document.querySelectorAll(
      `canvas.bar-preview[data-section-key="${cssEscape(sectionKey)}"][data-bar-name="${cssEscape(barName)}"]`,
    );

    if (btn != null) {
      btn.classList.add("saved-flash");
    }
    for (const canvas of canvases) {
      canvas.classList.add("saved-flash");
    }

    window.setTimeout(() => {
      if (btn != null) {
        btn.classList.remove("saved-flash");
      }
      for (const canvas of canvases) {
        canvas.classList.remove("saved-flash");
      }
    }, 700);
  }
}
