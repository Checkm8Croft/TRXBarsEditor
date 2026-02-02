export function buildThemeFromSection(section, barValue, barColorSteps) {
  const style = String(section.style || "").toLowerCase();
  if (style === "ps1") {
    if (!Array.isArray(barValue) || !Array.isArray(barValue[0]) || !Array.isArray(barValue[1])) {
      return {
        kind: "ps1",
        border_tl: section.border_tl || "#000000",
        border_tr: section.border_tr || "#000000",
        border_br: section.border_br || "#000000",
        border_bl: section.border_bl || "#000000",
        ramps: [Array(barColorSteps).fill("#000000"), Array(barColorSteps).fill("#000000")],
      };
    }
    return {
      kind: "ps1",
      border_tl: section.border_tl || "#000000",
      border_tr: section.border_tr || "#000000",
      border_br: section.border_br || "#000000",
      border_bl: section.border_bl || "#000000",
      ramps: [barValue[0], barValue[1]],
    };
  }

  return {
    kind: "pc",
    border_light: section.border_light || "#ffffff",
    border_dark: section.border_dark || "#404040",
    ramp: Array.isArray(barValue) ? barValue : Array(barColorSteps).fill("#000000"),
  };
}

export function describeThemeTooltip(barName, theme) {
  if (theme.kind === "ps1") {
    return `${barName}\n${theme.ramps[0].join(" ")} | ${theme.ramps[1].join(" ")}`;
  }
  return `${barName}\n${theme.ramp.join(" ")}`;
}
