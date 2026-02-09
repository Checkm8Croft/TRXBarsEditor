import React, { useMemo } from "react";
import { defaultBarValue } from "../lib/bar-values.js";
import { ColorModal } from "./components/ColorModal.jsx";
import { UploadModal } from "./components/UploadModal.jsx";
import { BarEditor } from "./components/BarEditor.jsx";
import { BarManager } from "./components/BarManager.jsx";
import { ThemeList } from "./components/ThemeList.jsx";
import { ThemeManager } from "./components/ThemeManager.jsx";
import { BAR_COLOR_STEPS } from "./constants.js";
import { useColorPicker } from "./hooks/useColorPicker.js";
import { useDraft } from "./hooks/useDraft.js";
import { useSavedIndicator } from "./hooks/useSavedIndicator.js";
import { useStateStore } from "./hooks/useStateStore.js";
import { useUiJson5File } from "./hooks/useUiJson5File.js";
import { defaultNameGsForThemeKey } from "../lib/workspace-ops.js";

const STORAGE_KEY = "trx.tools.uiBars.state.v2";
const FILE_STORAGE_KEY = "trx.tools.uiBars.uiJson5.v1";

function buildExportText({ baseData, stateStore }) {
  const base = baseData || {};
  const workspace = stateStore.buildWorkspaceData(base);
  return JSON.stringify(workspace, null, 2);
}

function openDownload(text) {
  const blob = new Blob([text], { type: "application/json5" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ui.json5";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function App() {
  const { store, viewState, bumpVersion, persistStore } = useStateStore(STORAGE_KEY);
  const { savedIndicator, flashSaved } = useSavedIndicator({ durationMs: 700 });

  const {
    baseData,
    fileName,
    uploadOpen,
    uploadError,
    setUploadOpen,
    onUploadText,
    forgetSavedFile,
    flashFileNameSaved,
  } = useUiJson5File({
    fileStorageKey: FILE_STORAGE_KEY,
    store,
    onParsed: (parsed) => {
      store.migrateLegacyEdits(parsed);
      bumpVersion();
    },
  });

  const workspaceBase = useMemo(
    () => store.buildWorkspaceData(baseData || {}),
    // viewState changes when store changes
    [store, baseData, viewState],
  );

  const {
    draft,
    setDraft,
    startDraft,
    setDraftValue,
    setDraftHsl,
    confirmDraft,
    resetDraft,
    maybePromptToResolveDraft,
    resetEdits,
  } = useDraft({
    store,
    baseData,
    workspaceBase,
    persistStore,
    onAfterConfirm: (sectionKey, barName) => {
      flashSaved(sectionKey, barName);
      flashFileNameSaved();
    },
  });

  const { colorModal, openColorPicker, onModalChange, onModalClose } = useColorPicker({
    barColorSteps: BAR_COLOR_STEPS,
    setDraftValue,
  });

  const workspace = useMemo(() => {
    const ws = store.buildWorkspaceData(baseData || {});
    if (draft != null && draft.sectionKey && draft.barName && ws[draft.sectionKey]?.colors) {
      ws[draft.sectionKey].colors[draft.barName] = draft.value;
    }
    return ws;
  }, [store, baseData, draft, viewState]);

  const selectBar = (sectionKey, barName) => {
    if (maybePromptToResolveDraft(sectionKey, barName) !== true) {
      return;
    }
    startDraft(sectionKey, barName);
    store.selectBar(sectionKey, barName);
    persistStore();
  };

  const clearSelection = () => {
    if (maybePromptToResolveDraft(null, null) !== true) {
      return;
    }
    store.state.selected = null;
    persistStore();
    setDraft(null);
  };

  const selectTheme = (themeKey) => {
    if (maybePromptToResolveDraft(themeKey, null) !== true) {
      return;
    }
    store.selectTheme(themeKey, baseData || {});
    persistStore();
    const next = store.state.selected;
    if (next?.sectionKey && next?.barName) {
      startDraft(next.sectionKey, next.barName);
    } else {
      setDraft(null);
    }
  };

  const setPercent = (value) => {
    store.state.percent = value;
    persistStore();
  };

  const setSmooth = (value) => {
    store.state.smooth = value;
    persistStore();
  };

  const addTheme = (themeKey, kind, nameGs) => {
    store.addTheme(themeKey, kind);
    const nextNameGs = String(nameGs || "").trim() || defaultNameGsForThemeKey(themeKey);
    store.setThemeLabel(themeKey, nextNameGs, baseData || {});
    store.selectTheme(themeKey, baseData || {});
    const next = store.state.selected;
    if (next?.sectionKey && next?.barName) {
      startDraft(next.sectionKey, next.barName);
    }
    persistStore();
  };

  const setThemeLabel = (themeKey, nameGs) => {
    store.setThemeLabel(themeKey, nameGs, baseData || {});
    persistStore();
  };

  const copyTheme = (fromKey, toKey) => {
    store.copyTheme(fromKey, toKey, baseData || {});
    store.selectTheme(toKey, baseData || {});
    const next = store.state.selected;
    if (next?.sectionKey && next?.barName) {
      startDraft(next.sectionKey, next.barName);
    }
    persistStore();
  };

  const renameTheme = (fromKey, toKey) => {
    copyTheme(fromKey, toKey);
    deleteTheme(fromKey);
  };

  const deleteTheme = (themeKey) => {
    store.deleteTheme(themeKey);
    if (store.state.selected?.sectionKey === themeKey) {
      store.state.selected = null;
      setDraft(null);
    }
    persistStore();
  };

  const moveTheme = (themeKey, delta) => {
    store.moveTheme(themeKey, delta, baseData || {});
    persistStore();
  };

  const addBar = (themeKey, barName) => {
    const theme = workspace[themeKey];
    const value = defaultBarValue({ sectionStyle: theme?.style, barColorSteps: BAR_COLOR_STEPS });
    store.setBarValue(themeKey, barName, value, baseData || {});
    store.selectBar(themeKey, barName);
    startDraft(themeKey, barName);
    persistStore();
  };

  const copyBar = (themeKey, fromName, toName) => {
    const theme = workspace[themeKey];
    if (theme?.colors?.[fromName] == null) {
      return;
    }
    store.setBarValue(themeKey, toName, structuredClone(theme.colors[fromName]), baseData || {});
    store.selectBar(themeKey, toName);
    startDraft(themeKey, toName);
    persistStore();
  };

  const renameBar = (themeKey, fromName, toName) => {
    store.renameBar(themeKey, fromName, toName, baseData || {});
    store.selectBar(themeKey, toName);
    startDraft(themeKey, toName);
    persistStore();
  };

  const deleteBar = (themeKey, barName) => {
    store.deleteBar(themeKey, barName, baseData || {});
    const ws = store.buildWorkspaceData(baseData || {});
    const names = Object.keys(ws[themeKey]?.colors || {});
    const next = names.length > 0 ? names[0] : null;
    if (next != null) {
      store.selectBar(themeKey, next);
      startDraft(themeKey, next);
    } else {
      store.state.selected = { sectionKey: themeKey, barName: "" };
      setDraft(null);
    }
    persistStore();
  };

  const moveBar = (themeKey, barName, delta) => {
    store.moveBar(themeKey, barName, delta, baseData || {});
    store.selectBar(themeKey, barName);
    startDraft(themeKey, barName);
    persistStore();
  };

  const selected = store.state.selected;
  const selectedSection = selected ? workspace[selected.sectionKey] : null;
  const selectedValue = selectedSection?.colors ? selectedSection.colors[selected.barName] : null;
  const selectedStyle = String(selectedSection?.style || "").toLowerCase();
  const hasSelectedBar = selected != null && selectedSection != null && selectedValue != null;

  const handleOpenUpload = () => setUploadOpen(true);
  const handleDownload = () => openDownload(buildExportText({ baseData, stateStore: store }));
  const handlePercentChange = (e) => setPercent(Number(e.target.value));
  const handleSmoothChange = (e) => setSmooth(e.target.checked);

  // If we loaded a file and have a persisted selection, start a draft once.
  // This keeps behavior aligned with the pre-hook App.
  React.useEffect(() => {
    if (baseData == null) {
      setDraft(null);
      return;
    }
    if (store.state.selected != null && draft == null) {
      startDraft(store.state.selected.sectionKey, store.state.selected.barName, baseData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseData]);

  return (
    <>
      <header>
        <div className="header-inner">
          <div className="title">
            <h1>UI Bars</h1>
            <div className="path">{fileName}</div>
          </div>
          <div className="actions">
            <button type="button" onClick={handleOpenUpload}>
              Upload…
            </button>
            <button type="button" onClick={handleDownload} disabled={baseData == null}>
              Download
            </button>
          </div>
        </div>
      </header>

      <main>
        {baseData == null ? (
          <div className="empty-state">
            <div className="empty-state-inner">
              <h1 className="empty-state-title">No file loaded</h1>
              <div className="empty-state-subtitle">Click Upload… or drop ui.json5 to begin.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="controls">
              <label>
                <span>Fill</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={String(viewState.percent)}
                  onChange={handlePercentChange}
                />
                <span>{Math.round(viewState.percent * 100)}%</span>
              </label>
              <label>
                <input type="checkbox" checked={viewState.smooth} onChange={handleSmoothChange} />
                <span>Smooth</span>
              </label>
              <button type="button" onClick={resetEdits} disabled={viewState.hasAnyEdits !== true}>
                Reset edits
              </button>
            </div>

            <div className="grid">
              <div className="panel sidebar">
                <div className="panel-header">
                  <h2>Editor</h2>
                  <div className="meta">
                    {selected == null
                      ? "No selection"
                      : selectedSection == null
                        ? "Invalid selection"
                        : selectedValue == null
                          ? `Theme: ${selected.sectionKey}`
                          : `${selected.sectionKey}.${selected.barName}`}
                  </div>
                </div>

                <div className="bars" style={{ paddingTop: 12 }}>
                  <ThemeManager
                    workspace={workspace}
                    selectedThemeKey={selected?.sectionKey || ""}
                    onSelectThemeKey={selectTheme}
                    onClearSelection={clearSelection}
                    onAddTheme={addTheme}
                    onSetThemeLabel={setThemeLabel}
                    onCopyTheme={copyTheme}
                    onRenameTheme={renameTheme}
                    onMoveTheme={moveTheme}
                    onDeleteTheme={deleteTheme}
                  />

                  <BarManager
                    themeKey={selected?.sectionKey || ""}
                    barName={selected?.barName || ""}
                    section={selectedSection}
                    hasSelection={hasSelectedBar}
                    onAddBar={addBar}
                    onCopyBar={copyBar}
                    onRenameBar={renameBar}
                    onDeleteBar={deleteBar}
                    onMoveBar={moveBar}
                  />

                  <BarEditor
                    barColorSteps={BAR_COLOR_STEPS}
                    sectionKey={selected?.sectionKey || ""}
                    barName={selected?.barName || ""}
                    section={selectedSection}
                    value={selectedValue}
                    style={selectedStyle}
                    percent={viewState.percent}
                    smooth={viewState.smooth}
                    draft={draft}
                    savedIndicator={savedIndicator}
                    onResetDraft={resetDraft}
                    onConfirmDraft={confirmDraft}
                    onSetDraftHsl={setDraftHsl}
                    onOpenColorPicker={openColorPicker}
                  />
                </div>
              </div>

              <ThemeList
                barColorSteps={BAR_COLOR_STEPS}
                workspace={workspace}
                selected={viewState.selected}
                percent={viewState.percent}
                smooth={viewState.smooth}
                onSelectBar={selectBar}
              />
            </div>
          </>
        )}
      </main>

      <UploadModal
        open={uploadOpen}
        error={uploadError}
        onClose={() => setUploadOpen(false)}
        onForget={forgetSavedFile}
        onUpload={onUploadText}
      />

      <ColorModal
        open={colorModal.open}
        title={colorModal.title}
        initialHex={colorModal.initialHex}
        onClose={onModalClose}
        onChange={onModalChange}
      />
    </>
  );
}
