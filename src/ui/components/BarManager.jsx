import React from "react";

export function BarManager({
  themeKey,
  barName,
  section,
  hasSelection,
  onAddBar,
  onCopyBar,
  onRenameBar,
  onDeleteBar,
  onMoveBar,
}) {
  if (!themeKey || section == null) {
    return (
      <div className="box">
        <div className="tag">Bar</div>
        <div className="muted">Select a theme/bar to manage bars.</div>
      </div>
    );
  }

  const namesInOrder = Object.keys(section.colors || {});
  const idx = barName != null ? namesInOrder.indexOf(barName) : -1;

  return (
    <div className="box">
      <div className="tag">Bar</div>
      <div className="row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            const name = (window.prompt("New bar name?", "") || "").trim();
            if (name.length === 0) {
              return;
            }
            if (section.colors && section.colors[name] != null) {
              window.alert("Bar already exists.");
              return;
            }
            onAddBar(themeKey, name);
          }}
        >
          Add
        </button>

        <button
          type="button"
          disabled={hasSelection !== true}
          onClick={() => {
            if (hasSelection !== true) {
              return;
            }
            const from = barName;
            const to = (window.prompt("Duplicate bar to:", `${from}_copy`) || "").trim();
            if (to.length === 0) {
              return;
            }
            if (section.colors && section.colors[to] != null) {
              window.alert("Bar already exists.");
              return;
            }
            onCopyBar(themeKey, from, to);
          }}
        >
          Clone
        </button>

        <button
          type="button"
          disabled={hasSelection !== true}
          onClick={() => {
            if (hasSelection !== true) {
              return;
            }
            const from = barName;
            const to = (window.prompt("Rename bar to:", from) || "").trim();
            if (to.length === 0 || to === from) {
              return;
            }
            if (section.colors && section.colors[to] != null) {
              window.alert("Bar already exists.");
              return;
            }
            onRenameBar(themeKey, from, to);
          }}
        >
          Rename
        </button>

        <button
          type="button"
          disabled={hasSelection !== true}
          onClick={() => {
            if (hasSelection !== true) {
              return;
            }
            const ok = window.confirm(`Delete bar "${barName}"?`);
            if (ok !== true) {
              return;
            }
            onDeleteBar(themeKey, barName);
          }}
        >
          Delete
        </button>

        <button
          type="button"
          disabled={hasSelection !== true || idx <= 0}
          onClick={() => onMoveBar(themeKey, barName, -1)}
        >
          Move up
        </button>

        <button
          type="button"
          disabled={hasSelection !== true || idx < 0 || idx >= namesInOrder.length - 1}
          onClick={() => onMoveBar(themeKey, barName, 1)}
        >
          Move down
        </button>
      </div>
    </div>
  );
}
