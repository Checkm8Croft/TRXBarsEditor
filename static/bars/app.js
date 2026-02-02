import { escapeHtml } from "./dom.js";
import { StateStore } from "./state-store.js";
import { BarsListView } from "./views/bars-list-view.js";
import { EditorView } from "./views/editor-view.js";
import { adjustBarValueAbsolute } from "./bar-edit.js";
import { createElement } from "./dom.js";

export class BarsApp {
  constructor({ storageKey, fileStorageKey, barColorSteps }) {
    this.barColorSteps = barColorSteps;
    this.fileStorageKey = fileStorageKey;

    this.stateStore = new StateStore(storageKey);
    this.barsListView = new BarsListView({ barColorSteps });
    this.editorView = new EditorView({
      barColorSteps,
      onPreviewBarValue: (sectionKey, barName, barValue) => this.setDraftValue(sectionKey, barName, barValue),
      onSetDraftValue: (sectionKey, barName, barValue) => this.setDraftValue(sectionKey, barName, barValue),
      onConfirmDraft: () => this.confirmDraft(),
      onCancelDraft: () => this.cancelDraft(),
      onResetDraft: () => this.resetDraft(),
      onSetDraftHsl: (h, s, l) => this.setDraftHsl(h, s, l),
      onSelectTheme: (themeKey) => this.selectTheme(themeKey),
      onClearSelection: () => this.clearSelection(),
      onAddTheme: (themeKey, kind) => this.addTheme(themeKey, kind),
      onCopyTheme: (fromKey, toKey) => this.copyTheme(fromKey, toKey),
      onRenameTheme: (fromKey, toKey) => this.renameTheme(fromKey, toKey),
      onDeleteTheme: (themeKey) => this.deleteTheme(themeKey),
      onAddBar: (themeKey, barName, value) => this.addBar(themeKey, barName, value),
      onCopyBar: (themeKey, fromName, toName) => this.copyBar(themeKey, fromName, toName),
      onRenameBar: (themeKey, fromName, toName) => this.renameBar(themeKey, fromName, toName),
      onDeleteBar: (themeKey, barName) => this.deleteBar(themeKey, barName),
      onMoveBar: (themeKey, barName, delta) => this.moveBar(themeKey, barName, delta),
    });

    this.baseData = null;
    this.rawText = null;
    this.editorMount = null;
    this.editorMeta = null;
    this.draft = null;
    this.fileName = null;
    this.uploadModalEl = null;
    this.uploadModalError = null;
  }

  init() {
    document.getElementById("reload").textContent = "Upload…";
    document.getElementById("reload").addEventListener("click", () => this.openUploadModal());
    this.setupDownload();
    this.loadFromStorageOrShowUpload();
  }

  loadFromStorageOrShowUpload() {
    this.stateStore.loadFromStorage();

    const raw = this.loadUiJson5TextFromStorage();
    if (raw == null) {
      this.baseData = null;
      this.rawText = null;
      this.draft = null;
      this.renderEmptyState();
      return;
    }
    this.loadUiJson5FromText(raw, { fileName: "saved file" });
  }

  setupDownload() {
    const btn = document.getElementById("download");
    btn.onclick = () => {
      const text = this.buildExportText();
      const blob = new Blob([text], { type: "application/json5" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ui.json5";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
  }

  buildExportText() {
    const base = this.baseData || {};
    const workspace = this.stateStore.buildWorkspaceData(base);
    // Keep it as a JS object literal so it can round-trip through our parser.
    return JSON.stringify(workspace, null, 2);
  }

  openFilePicker() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json5,.json,application/json,application/json5,text/plain";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      if (file == null) {
        return;
      }
      const text = await file.text();
      this.loadUiJson5FromText(text, { fileName: file.name || "ui.json5" });
    });
    input.click();
  }

  loadUiJson5FromText(rawText, { fileName }) {
    try {
      const baseData = this.parseJson5ObjectLiteral(rawText);
      this.baseData = baseData;
      this.rawText = rawText;
      this.fileName = fileName || null;

      this.saveUiJson5TextToStorage(rawText);
      this.stateStore.migrateLegacyEdits(this.baseData);

      if (this.stateStore.state.selected != null) {
        this.startDraft(this.stateStore.state.selected.sectionKey, this.stateStore.state.selected.barName);
      } else {
        this.draft = null;
      }

      this.renderAll();
      this.closeUploadModal();
    } catch (err) {
      this.baseData = null;
      this.rawText = rawText;
      this.fileName = fileName || null;
      this.uploadModalError = err;
      this.renderEmptyState();
      if (this.uploadModalEl != null) {
        this.refreshUploadModal();
      }
      this.friendlyParseAlert(err);
    }
  }

  parseJson5ObjectLiteral(text) {
    return Function(`"use strict"; return (${text});`)();
  }

  friendlyParseAlert(err) {
    window.alert(
      "ui.json5 failed to parse.\n\n" +
        "Yes, it's probably your fault (or mine).\n" +
        "Fix the file and upload again.\n\n" +
        `Error: ${String(err)}`,
    );
  }

  loadUiJson5TextFromStorage() {
    try {
      const raw = localStorage.getItem(this.fileStorageKey);
      return raw != null && raw.length > 0 ? raw : null;
    } catch {
      return null;
    }
  }

  saveUiJson5TextToStorage(rawText) {
    try {
      localStorage.setItem(this.fileStorageKey, rawText);
    } catch {
      // ignore
    }
  }

  clearStoredUiJson5() {
    try {
      localStorage.removeItem(this.fileStorageKey);
    } catch {
      // ignore
    }
  }

  renderEmptyState() {
    const root = document.getElementById("root");
    root.innerHTML = "";
    const pathEl = document.querySelector(".title .path");
    if (pathEl != null) {
      pathEl.textContent = "";
    }
    root.appendChild(
      createElement("div", { class: "empty-state" }, [
        createElement("div", { class: "empty-state-inner" }, [
          createElement("h1", { class: "empty-state-title", text: "No file loaded" }),
          createElement("div", { class: "empty-state-subtitle", text: "Click Upload… or drop ui.json5 to begin." }),
        ]),
      ]),
    );
  }

  openUploadModal() {
    if (this.uploadModalEl != null) {
      this.refreshUploadModal();
      return;
    }

    const backdrop = createElement("div", { class: "upload-backdrop" });
    const modal = createElement("div", { class: "upload-modal" });

    const header = createElement("div", { class: "modal-header" }, [
      createElement("div", { class: "modal-title", text: "Upload ui.json5" }),
      (() => {
        const close = createElement("button", { type: "button", text: "Close" });
        close.addEventListener("click", () => this.closeUploadModal());
        return close;
      })(),
    ]);

    const drop = createElement("div", { class: "dropzone" }, [
      createElement("div", { class: "dropzone-title", text: "Drop ui.json5 here" }),
      createElement("div", { class: "muted", text: "…or click to choose a file." }),
    ]);
    drop.addEventListener("click", () => this.openFilePicker());
    drop.addEventListener("dragover", (e) => {
      e.preventDefault();
      drop.classList.add("dragover");
    });
    drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
    drop.addEventListener("drop", async (e) => {
      e.preventDefault();
      drop.classList.remove("dragover");
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0] ? e.dataTransfer.files[0] : null;
      if (file == null) {
        return;
      }
      const text = await file.text();
      this.loadUiJson5FromText(text, { fileName: file.name || "ui.json5" });
    });

    const errorBox = createElement("div", { class: "upload-error-slot" });

    const buttons = createElement("div", { class: "row" });
    buttons.style.justifyContent = "flex-start";
    buttons.style.gap = "8px";

    const forgetBtn = createElement("button", { type: "button", text: "Forget saved file" });
    forgetBtn.addEventListener("click", () => {
      const ok = window.confirm("Forget the saved ui.json5 from localStorage?");
      if (ok !== true) {
        return;
      }
      this.clearStoredUiJson5();
      this.baseData = null;
      this.rawText = null;
      this.draft = null;
      this.fileName = null;
      this.uploadModalError = null;
      this.renderEmptyState();
      this.closeUploadModal();
    });
    buttons.appendChild(forgetBtn);

    modal.appendChild(header);
    modal.appendChild(drop);
    modal.appendChild(errorBox);
    modal.appendChild(buttons);
    backdrop.appendChild(modal);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        this.closeUploadModal();
      }
    });
    window.addEventListener("keydown", this.onUploadModalKeyDown, true);

    document.body.appendChild(backdrop);
    this.uploadModalEl = backdrop;
    this.refreshUploadModal();
  }

  refreshUploadModal() {
    if (this.uploadModalEl == null) {
      return;
    }
    const slot = this.uploadModalEl.querySelector(".upload-error-slot");
    if (slot == null) {
      return;
    }
    slot.innerHTML = "";
    if (this.uploadModalError != null) {
      slot.appendChild(
        createElement("div", { class: "error" }, [
          createElement("p", { html: `Parse failed: <code>${escapeHtml(String(this.uploadModalError))}</code>` }),
        ]),
      );
    }
  }

  closeUploadModal() {
    if (this.uploadModalEl == null) {
      return;
    }
    this.uploadModalEl.remove();
    this.uploadModalEl = null;
    window.removeEventListener("keydown", this.onUploadModalKeyDown, true);
  }

  onUploadModalKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      this.closeUploadModal();
    }
  };

  renderAll() {
    if (this.draft == null && this.stateStore.state.selected != null) {
      this.startDraft(this.stateStore.state.selected.sectionKey, this.stateStore.state.selected.barName);
    }
    const root = document.getElementById("root");
    const workspace = this.buildWorkspaceWithDraft();
    const state = this.stateStore.state;
    const viewState = { ...state, hasAnyEdits: this.stateStore.hasAnyEdits() };

    const pathEl = document.querySelector(".title .path");
    if (pathEl != null) {
      pathEl.textContent = this.fileName != null ? this.fileName : "";
    }

    const { editorMountEl, editorMetaEl } = this.barsListView.render(root, workspace, viewState, {
      onSelectBar: (sectionKey, barName) => this.selectBar(sectionKey, barName),
      onPercentChange: (value) => this.setPercent(value),
      onSmoothChange: (value) => this.setSmooth(value),
      onResetEdits: () => this.resetEdits(),
    });

    this.editorMount = editorMountEl;
    this.editorMeta = editorMetaEl;
    this.editorView.mount(this.editorMount, this.editorMeta);
    this.editorView.render(workspace, viewState, this.draft);
  }

  renderError(root, err) {
    root.innerHTML = "";
    const box = document.createElement("div");
    box.className = "error";
    box.innerHTML =
      "Something went wrong while loading/parsing <code>ui.json5</code>." +
      "<br /><br />" +
      `Error: <code>${escapeHtml(String(err))}</code>`;
    root.appendChild(box);
  }

  getWorkspace() {
    return this.buildWorkspaceWithDraft();
  }

  buildWorkspaceWithDraft() {
    const workspace = this.stateStore.buildWorkspaceData(this.baseData || {});
    if (
      this.draft != null &&
      this.draft.sectionKey != null &&
      this.draft.barName != null &&
      workspace[this.draft.sectionKey] != null &&
      workspace[this.draft.sectionKey].colors != null
    ) {
      workspace[this.draft.sectionKey].colors[this.draft.barName] = this.draft.value;
    }
    return workspace;
  }

  setPercent(value) {
    this.stateStore.state.percent = value;
    this.stateStore.saveToStorage();
    this.barsListView.redrawAllBars(this.stateStore.state);
    this.editorView.redrawBigPreviewIfReady(this.getWorkspace(), this.stateStore.state, this.draft);
  }

  setSmooth(value) {
    this.stateStore.state.smooth = value;
    this.stateStore.saveToStorage();
    this.barsListView.redrawAllBars(this.stateStore.state);
    this.editorView.redrawBigPreviewIfReady(this.getWorkspace(), this.stateStore.state, this.draft);
  }

  setDraftHsl(h, s, l) {
    if (this.draft == null) {
      return;
    }
    this.draft.hsl = { h, s, l };
    this.draft.value = adjustBarValueAbsolute(this.draft.baseValueSnapshot, h, s, l);
    this.draft.dirty = true;
    this.previewDraft();
  }

  resetEdits() {
    if (this.stateStore.hasAnyEdits() !== true) {
      return;
    }
    const ok = window.confirm("Reset ALL edits?");
    if (ok !== true) {
      return;
    }
    this.stateStore.resetEdits();
    if (this.stateStore.state.selected != null) {
      this.startDraft(this.stateStore.state.selected.sectionKey, this.stateStore.state.selected.barName);
    } else {
      this.draft = null;
    }
    this.renderAll();
  }

  clearSelection() {
    if (this.maybePromptToResolveDraft(null, null) !== true) {
      return;
    }
    this.stateStore.state.selected = null;
    this.stateStore.saveToStorage();
    this.renderAll();
  }

  selectBar(sectionKey, barName) {
    if (this.maybePromptToResolveDraft(sectionKey, barName) !== true) {
      return;
    }
    this.startDraft(sectionKey, barName);
    this.stateStore.selectBar(sectionKey, barName);
    this.renderAll();
  }

  selectTheme(themeKey) {
    if (this.maybePromptToResolveDraft(themeKey, null) !== true) {
      return;
    }
    this.stateStore.selectTheme(themeKey, this.baseData || {});
    const next = this.stateStore.state.selected;
    if (next != null && next.sectionKey && next.barName) {
      this.startDraft(next.sectionKey, next.barName);
    } else {
      this.draft = null;
    }
    this.renderAll();
  }

  addTheme(themeKey, kind) {
    this.stateStore.addTheme(themeKey, kind);
    this.stateStore.selectTheme(themeKey, this.baseData || {});
    const next = this.stateStore.state.selected;
    if (next != null && next.sectionKey && next.barName) {
      this.startDraft(next.sectionKey, next.barName);
    }
    this.renderAll();
  }

  copyTheme(fromKey, toKey) {
    this.stateStore.copyTheme(fromKey, toKey, this.baseData || {});
    this.stateStore.selectTheme(toKey, this.baseData || {});
    const next = this.stateStore.state.selected;
    if (next != null && next.sectionKey && next.barName) {
      this.startDraft(next.sectionKey, next.barName);
    }
    this.renderAll();
  }

  renameTheme(fromKey, toKey) {
    this.copyTheme(fromKey, toKey);
    this.deleteTheme(fromKey);
  }

  deleteTheme(themeKey) {
    this.stateStore.deleteTheme(themeKey);
    if (this.stateStore.state.selected != null && this.stateStore.state.selected.sectionKey === themeKey) {
      this.stateStore.state.selected = null;
      this.stateStore.saveToStorage();
      this.draft = null;
    }
    this.renderAll();
  }

  addBar(themeKey, barName, value) {
    this.stateStore.setBarValue(themeKey, barName, value, this.baseData || {});
    this.stateStore.selectBar(themeKey, barName);
    this.startDraft(themeKey, barName);
    this.renderAll();
  }

  copyBar(themeKey, fromName, toName) {
    const workspace = this.getWorkspace();
    const theme = workspace[themeKey];
    if (theme == null || theme.colors == null || theme.colors[fromName] == null) {
      return;
    }
    this.stateStore.setBarValue(themeKey, toName, structuredClone(theme.colors[fromName]), this.baseData || {});
    this.stateStore.selectBar(themeKey, toName);
    this.startDraft(themeKey, toName);
    this.renderAll();
  }

  renameBar(themeKey, fromName, toName) {
    this.stateStore.renameBar(themeKey, fromName, toName, this.baseData || {});
    this.stateStore.selectBar(themeKey, toName);
    this.startDraft(themeKey, toName);
    this.renderAll();
  }

  deleteBar(themeKey, barName) {
    this.stateStore.deleteBar(themeKey, barName, this.baseData || {});
    const workspace = this.getWorkspace();
    const names = Object.keys((workspace[themeKey] && workspace[themeKey].colors) || {});
    const next = names.length > 0 ? names[0] : null;
    if (next != null) {
      this.stateStore.selectBar(themeKey, next);
      this.startDraft(themeKey, next);
    } else {
      this.stateStore.state.selected = { sectionKey: themeKey, barName: "" };
      this.stateStore.saveToStorage();
      this.draft = null;
    }
    this.renderAll();
  }

  moveBar(themeKey, barName, delta) {
    this.stateStore.moveBar(themeKey, barName, delta, this.baseData || {});
    this.stateStore.selectBar(themeKey, barName);
    this.startDraft(themeKey, barName);
    this.renderAll();
  }

  startDraft(sectionKey, barName) {
    const workspace = this.stateStore.buildWorkspaceData(this.baseData || {});
    const section = workspace[sectionKey];
    const baseValue = section && section.colors ? section.colors[barName] : null;
    if (baseValue == null) {
      this.draft = null;
      return;
    }
    this.draft = {
      sectionKey,
      barName,
      baseValueSnapshot: structuredClone(baseValue),
      value: structuredClone(baseValue),
      hsl: { h: 0, s: 0, l: 0 },
      dirty: false,
    };
  }

  setDraftValue(sectionKey, barName, value) {
    if (this.draft == null || this.draft.sectionKey !== sectionKey || this.draft.barName !== barName) {
      this.startDraft(sectionKey, barName);
    }
    if (this.draft == null) {
      return;
    }
    this.draft.value = value;
    this.draft.dirty = true;
    this.previewDraft();
  }

  previewDraft() {
    if (this.draft == null) {
      return;
    }
    const workspace = this.buildWorkspaceWithDraft();
    const section = workspace[this.draft.sectionKey];
    if (section == null) {
      return;
    }
    this.editorView.syncDraftControls(this.draft);
    this.barsListView.updateRenderedBar(
      this.draft.sectionKey,
      this.draft.barName,
      section,
      this.draft.value,
      this.stateStore.state,
    );
    this.editorView.updateSwatchesIfSelected(this.draft.sectionKey, this.draft.barName, this.draft.value, this.stateStore.state);
    this.editorView.redrawBigPreviewIfReady(workspace, this.stateStore.state, this.draft);
  }

  confirmDraft() {
    if (this.draft == null) {
      return;
    }
    try {
      const savedSectionKey = this.draft.sectionKey;
      const savedBarName = this.draft.barName;
      this.stateStore.setEditedBarValue(savedSectionKey, savedBarName, this.draft.value, this.baseData || {});
      this.draft = null;
      this.flashSavedStatus();
      this.renderAll();
      this.barsListView.flashSavedBar(savedSectionKey, savedBarName);
    } catch (err) {
      window.alert(`Save failed: ${String(err)}`);
    }
  }

  cancelDraft() {
    if (this.draft == null) {
      return;
    }
    this.draft = null;
    this.renderAll();
  }

  resetDraft() {
    if (this.draft == null) {
      return;
    }
    this.draft.value = structuredClone(this.draft.baseValueSnapshot);
    this.draft.hsl = { h: 0, s: 0, l: 0 };
    this.draft.dirty = false;
    // Apply immediately to list + big preview, then rerender to reset controls.
    this.previewDraft();
    this.renderAll();
  }

  flashSavedStatus() {
    const pathEl = document.querySelector(".title .path");
    if (pathEl == null) {
      return;
    }
    const base = this.fileName != null ? this.fileName : "";
    pathEl.textContent = base.length > 0 ? `${base} • saved` : "saved";
    window.setTimeout(() => {
      const next = this.fileName != null ? this.fileName : "";
      pathEl.textContent = next;
    }, 900);
  }

  maybePromptToResolveDraft(nextSectionKey, nextBarName) {
    if (this.draft == null || this.draft.dirty !== true) {
      return true;
    }
    const switchingBar =
      nextSectionKey != null &&
      nextBarName != null &&
      (nextSectionKey !== this.draft.sectionKey || nextBarName !== this.draft.barName);
    const leavingSelection = nextSectionKey == null && nextBarName == null;
    const switchingThemeOnly = nextSectionKey != null && nextBarName == null && nextSectionKey !== this.draft.sectionKey;
    if (switchingBar || leavingSelection || switchingThemeOnly) {
      const ok = window.confirm("You have uncommitted changes. Save them?");
      if (ok === true) {
        this.confirmDraft();
        return true;
      }
      this.cancelDraft();
      return true;
    }
    return true;
  }
}
