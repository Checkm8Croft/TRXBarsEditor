export class StateStore {
  constructor(storageKey) {
    this.storageKey = storageKey;
    this.state = this.createDefaultState();
  }

  createDefaultState() {
    return {
      percent: 1.0,
      smooth: true,
      selected: null, // { sectionKey: string, barName: string }
      edits: {}, // v1 compat, migrated into workspaceThemes
      workspaceThemes: {},
      deletedThemes: {},
      barAdjust: { h: 0, s: 0, l: 0 },
    };
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw == null) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (typeof parsed.percent === "number") {
        this.state.percent = parsed.percent;
      }
      if (typeof parsed.smooth === "boolean") {
        this.state.smooth = parsed.smooth;
      }
      if (parsed.barAdjust != null && typeof parsed.barAdjust === "object") {
        const h = Number(parsed.barAdjust.h);
        const s = Number(parsed.barAdjust.s);
        const l = Number(parsed.barAdjust.l);
        if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)) {
          this.state.barAdjust = { h, s, l };
        }
      }
      if (parsed.selected != null && typeof parsed.selected === "object") {
        const sectionKey = String(parsed.selected.sectionKey || "");
        const barName = String(parsed.selected.barName || "");
        if (sectionKey.length > 0 && barName.length > 0) {
          this.state.selected = { sectionKey, barName };
        }
      }
      if (parsed.edits != null && typeof parsed.edits === "object") {
        this.state.edits = parsed.edits;
      }
      if (parsed.workspaceThemes != null && typeof parsed.workspaceThemes === "object") {
        this.state.workspaceThemes = parsed.workspaceThemes;
      }
      if (parsed.deletedThemes != null && typeof parsed.deletedThemes === "object") {
        this.state.deletedThemes = parsed.deletedThemes;
      }
    } catch {
      // ignore
    }
  }

  saveToStorage() {
    const snapshot = {
      percent: this.state.percent,
      smooth: this.state.smooth,
      selected: this.state.selected,
      edits: this.state.edits,
      barAdjust: this.state.barAdjust,
      workspaceThemes: this.state.workspaceThemes,
      deletedThemes: this.state.deletedThemes,
    };
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(snapshot));
    } catch {
      // ignore
    }
  }

  hasAnyEdits() {
    if (Object.keys(this.state.edits || {}).length > 0) {
      return true;
    }
    if (Object.keys(this.state.workspaceThemes || {}).length > 0) {
      return true;
    }
    if (Object.keys(this.state.deletedThemes || {}).length > 0) {
      return true;
    }
    return false;
  }

  resetEdits() {
    this.state.edits = {};
    this.state.workspaceThemes = {};
    this.state.deletedThemes = {};
    this.saveToStorage();
  }

  migrateLegacyEdits(baseData) {
    if (baseData == null) {
      return;
    }
    if (this.state.edits == null) {
      return;
    }
    const keys = Object.keys(this.state.edits);
    if (keys.length === 0) {
      return;
    }
    for (const themeKey of keys) {
      const barEdits = this.state.edits[themeKey];
      if (barEdits == null || Object.keys(barEdits).length === 0) {
        continue;
      }
      const baseTheme = baseData[themeKey];
      if (baseTheme == null) {
        continue;
      }
      const editable = this.ensureEditableTheme(themeKey, baseData);
      for (const [barName, value] of Object.entries(barEdits)) {
        editable.colors[barName] = value;
      }
    }
    this.state.edits = {};
    this.saveToStorage();
  }

  buildWorkspaceData(baseData) {
    const out = {};

    for (const [key, section] of Object.entries(baseData || {})) {
      if (section == null) {
        continue;
      }
      if (this.state.deletedThemes && this.state.deletedThemes[key]) {
        continue;
      }
      out[key] = {
        ...section,
        colors: { ...(section.colors || {}) },
      };
    }

    for (const [key, theme] of Object.entries(this.state.workspaceThemes || {})) {
      if (this.state.deletedThemes && this.state.deletedThemes[key]) {
        continue;
      }
      out[key] = {
        ...theme,
        colors: { ...(theme.colors || {}) },
      };
    }

    for (const [themeKey, barEdits] of Object.entries(this.state.edits || {})) {
      if (barEdits == null) {
        continue;
      }
      const theme = out[themeKey];
      if (theme == null || theme.colors == null) {
        continue;
      }
      for (const [barName, value] of Object.entries(barEdits)) {
        theme.colors[barName] = value;
      }
    }

    return out;
  }

  ensureEditableTheme(themeKey, baseData) {
    if (this.state.workspaceThemes == null) {
      this.state.workspaceThemes = {};
    }
    const existing = this.state.workspaceThemes[themeKey];
    if (existing != null) {
      if (existing.colors == null) {
        existing.colors = {};
      }
      return existing;
    }

    const baseTheme = baseData != null ? baseData[themeKey] : null;
    if (baseTheme == null) {
      const fallback = { colors: {} };
      this.state.workspaceThemes[themeKey] = fallback;
      return fallback;
    }
    const copy = structuredClone(baseTheme);
    if (copy.colors == null) {
      copy.colors = {};
    }
    this.state.workspaceThemes[themeKey] = copy;
    return copy;
  }

  selectBar(sectionKey, barName) {
    this.state.selected = { sectionKey, barName };
    this.state.barAdjust = { h: 0, s: 0, l: 0 };
    this.saveToStorage();
  }

  selectTheme(themeKey, baseData) {
    const workspace = this.buildWorkspaceData(baseData);
    const theme = workspace[themeKey];
    if (theme == null) {
      return;
    }
    const names = Object.keys(theme.colors || {}).sort((a, b) => a.localeCompare(b));
    const barName = names.length > 0 ? names[0] : "";
    this.state.selected = { sectionKey: themeKey, barName };
    this.state.barAdjust = { h: 0, s: 0, l: 0 };
    this.saveToStorage();
  }

  addTheme(themeKey, kind) {
    if (this.state.deletedThemes && this.state.deletedThemes[themeKey]) {
      delete this.state.deletedThemes[themeKey];
    }
    const base =
      kind === "ps1"
        ? {
            scale: 1.0,
            style: "ps1",
            border_tl: "#000000",
            border_tr: "#000000",
            border_bl: "#000000",
            border_br: "#000000",
            colors: {},
          }
        : {
            scale: 1.0,
            style: "pc",
            border_light: "#ffffff",
            border_dark: "#404040",
            colors: {},
          };
    this.state.workspaceThemes[themeKey] = base;
    this.saveToStorage();
  }

  copyTheme(fromKey, toKey, baseData) {
    const workspace = this.buildWorkspaceData(baseData);
    const from = workspace[fromKey];
    if (from == null) {
      return;
    }
    if (this.state.deletedThemes && this.state.deletedThemes[toKey]) {
      delete this.state.deletedThemes[toKey];
    }
    this.state.workspaceThemes[toKey] = structuredClone(from);
    this.saveToStorage();
  }

  deleteTheme(themeKey) {
    if (this.state.deletedThemes == null) {
      this.state.deletedThemes = {};
    }
    this.state.deletedThemes[themeKey] = true;
    if (this.state.workspaceThemes && this.state.workspaceThemes[themeKey] != null) {
      delete this.state.workspaceThemes[themeKey];
    }
    this.saveToStorage();
  }

  setBarValue(themeKey, barName, value, baseData) {
    const theme = this.ensureEditableTheme(themeKey, baseData);
    theme.colors[barName] = value;
    this.saveToStorage();
  }

  renameBar(themeKey, fromName, toName, baseData) {
    const workspace = this.buildWorkspaceData(baseData);
    const theme = workspace[themeKey];
    if (theme == null || theme.colors == null || theme.colors[fromName] == null) {
      return;
    }
    const editable = this.ensureEditableTheme(themeKey, baseData);
    editable.colors[toName] = structuredClone(theme.colors[fromName]);
    delete editable.colors[fromName];
    this.saveToStorage();
  }

  deleteBar(themeKey, barName, baseData) {
    const editable = this.ensureEditableTheme(themeKey, baseData);
    if (editable.colors == null) {
      return;
    }
    delete editable.colors[barName];
    this.saveToStorage();
  }

  setEditedBarValue(sectionKey, barName, value, baseData) {
    const editable = this.ensureEditableTheme(sectionKey, baseData);
    editable.colors[barName] = value;
    this.state.selected = { sectionKey, barName };
    this.saveToStorage();
  }
}
