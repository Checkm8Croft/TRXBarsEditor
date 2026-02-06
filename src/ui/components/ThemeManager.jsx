import React from "react";

export function ThemeManager({
  workspace,
  selectedThemeKey,
  onSelectThemeKey,
  onClearSelection,
  onAddTheme,
  onCopyTheme,
  onRenameTheme,
  onDeleteTheme,
}) {
  const keys = Object.keys(workspace || {});

  return (
    <div className="box">
      <div className="tag">Theme</div>
      <div className="row" style={{ alignItems: "center", gap: 10 }}>
        <label>Select</label>
        <div className="select-wrap">
          <select
            value={selectedThemeKey || ""}
            onChange={(e) => {
              if (e.target.value.length === 0) {
                onClearSelection();
                return;
              }
              onSelectThemeKey(e.target.value);
            }}
          >
            <option value="">-- select theme --</option>
            {keys.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row" style={{ justifyContent: "flex-start", gap: 8 }}>
        <button
          type="button"
          onClick={() => {
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
            onAddTheme(key, kind);
          }}
        >
          Add
        </button>

        <button
          type="button"
          onClick={() => {
            if (!selectedThemeKey) {
              return;
            }
            const key = (window.prompt("Copy to new theme key?", `${selectedThemeKey}_copy`) || "").trim();
            if (key.length === 0) {
              return;
            }
            if (workspace[key] != null) {
              window.alert("Theme key already exists.");
              return;
            }
            onCopyTheme(selectedThemeKey, key);
          }}
        >
          Copy
        </button>

        <button
          type="button"
          onClick={() => {
            const from = selectedThemeKey || "";
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
            onRenameTheme(from, to);
          }}
        >
          Rename
        </button>

        <button
          type="button"
          onClick={() => {
            const key = selectedThemeKey || "";
            if (key.length === 0) {
              return;
            }
            const ok = window.confirm(`Delete theme "${key}"?`);
            if (ok !== true) {
              return;
            }
            onDeleteTheme(key);
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
