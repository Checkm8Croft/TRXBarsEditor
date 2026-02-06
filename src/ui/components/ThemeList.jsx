import React, { useMemo } from "react";
import { ThemeBars } from "./ThemeBars.jsx";

export function ThemeList({ barColorSteps, workspace, selected, percent, smooth, onSelectBar }) {
  const themes = useMemo(() => {
    return Object.entries(workspace || {}).filter(([, v]) => v != null);
  }, [workspace]);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Bars</h2>
        <div className="meta">{themes.length} themes</div>
      </div>
      <div className="bars">
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", gap: 12 }}>
          {themes.map(([themeKey, section]) => (
            <ThemeBars
              key={themeKey}
              barColorSteps={barColorSteps}
              themeKey={themeKey}
              section={section}
              selected={selected}
              percent={percent}
              smooth={smooth}
              onSelectBar={onSelectBar}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
