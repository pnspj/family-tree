// Top level: consent -> about page -> loading -> start screen or tree screen, plus the dialogs.
import { useReducer, useRef, useState } from 'preact/hooks';
import * as ops from './core/ops';
import { sampleFile } from './core/sample';
import type { FamilyFile } from './core/types';
import { hasCurrentConsent, loadConsent, requestPersistentStorage, saveConsent } from './legal';
import { downloadJson } from './storage';
import { AboutPage } from './ui/About';
import type { MenuDialog } from './ui/AppMenu';
import { appReducer, initialState } from './ui/appState';
import { ConsentScreen } from './ui/Consent';
import { Toast } from './ui/controls';
import { ExportDialog, ImportDialog } from './ui/DataDialogs';
import { useHashPage, usePrefs, useStoredFile } from './ui/hooks';
import { LabelSettings } from './ui/LabelSettings';
import { MainScreen, type Mode } from './ui/MainScreen';
import { masksFor } from './ui/masks';
import { Modal } from './ui/Modal';
import { PersonDialog, type DialogState } from './ui/PersonDialog';
import { PrintDialog } from './ui/Print';
import { useQuiz } from './ui/Quiz';
import { StartScreen } from './ui/StartScreen';

/** Modal dialogs other than the person dialog; at most one is open. */
type Overlay =
  | { kind: MenuDialog }
  | { kind: 'confirm'; message: string; action: () => void }
  | { kind: 'importErrors'; errors: string[] };

const EMPTY = ops.emptyFile();
/** Each dialog state mounts a fresh dialog, so focus starts at its first field again. */
const dialogKey = (d: DialogState) => (d.kind === 'edit' ? `edit-${d.id}` : `add-${d.relation}-${d.baseId ?? ''}-${d.unionId ?? ''}`);

export function App() {
  // Terms / privacy consent by an adult, required before anything else (asked again when the terms change).
  // Nothing touches storage before it.
  const [consented, setConsented] = useState(hasCurrentConsent);
  const about = useHashPage('about');
  const [prefs, updatePrefs] = usePrefs();
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [mode, setMode] = useState<Mode>('view');
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const { file, dialog } = state;
  const notify = (text: string) => dispatch({ type: 'notify', text });
  const quiz = useQuiz(file ?? EMPTY, prefs, mode === 'quiz' && !!file?.persons.length);

  useStoredFile(file, consented, (f) => dispatch({ type: 'loaded', file: f }), () => notify('ブラウザに保存できませんでした'));

  if (!consented)
    return (
      <ConsentScreen
        renewed={!!loadConsent()}
        onAgree={() => {
          saveConsent();
          requestPersistentStorage();
          setConsented(true);
        }}
      />
    );
  if (about.open) {
    const back = (
      <button type="button" class="primary about-start" onClick={about.close}>
        かけいずに戻る
      </button>
    );
    return <AboutPage action={back} footer={<div class="about-back">{back}</div>} />;
  }
  if (file === undefined) return <div class="loading">読み込み中…</div>;

  const current = file ?? EMPTY;
  const replace = (f: FamilyFile) => dispatch({ type: 'replace', file: f });
  /** Replacing a family that has people asks first. */
  const guardReplace = (action: () => void) => {
    if (current.persons.length) setOverlay({ kind: 'confirm', message: 'いまの家系図は消えて置き換わります。先に「JSONで書き出す」で保存しておくと安心です。', action });
    else action();
  };
  const closeOverlay = () => setOverlay(null);
  /** Dialogs opened from the menu give focus back to the menu button. */
  const closeMenuDialog = () => {
    closeOverlay();
    requestAnimationFrame(() => menuButton.current?.focus());
  };
  const onImportFile = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const r = ops.parseFamilyFile(await f.text());
    if (r.ok) replace(r.file); // the import dialog already warned about replacing and got agreement
    else setOverlay({ kind: 'importErrors', errors: r.errors });
  };

  const screen = current.persons.length ? (
    <MainScreen
      file={current}
      prefs={prefs}
      onPrefs={updatePrefs}
      mode={mode}
      onMode={setMode}
      masks={mode === 'view' ? masksFor(prefs) : null}
      reveal={state.reveal}
      quiz={quiz}
      fit={state.fit}
      focus={state.focus}
      dispatch={dispatch}
      menuButton={menuButton}
      onMenuDialog={(kind) => setOverlay({ kind })}
      onSample={() => guardReplace(() => replace(sampleFile()))}
      onStartOver={() => guardReplace(() => replace(ops.emptyFile()))}
      onAbout={about.show}
    />
  ) : (
    <StartScreen
      onNew={() => dispatch({ type: 'openDialog', dialog: { kind: 'add', relation: 'first' } })}
      onSample={() => replace(sampleFile())}
      onImport={() => setOverlay({ kind: 'import' })}
      onAbout={about.show}
    />
  );

  return (
    <>
      {screen}
      {dialog && (
        <PersonDialog
          key={dialogKey(dialog)}
          file={current}
          state={dialog}
          script={prefs.script}
          onClose={() => dispatch({ type: 'closeDialog' })}
          onSave={(fields, opts) => {
            if (dialog.kind === 'add' && dialog.relation === 'first') setMode('edit'); // ready to add the next person
            dispatch({ type: 'save', fields, fillUnionId: opts?.fillUnionId });
          }}
          onAdd={(next) => dispatch({ type: 'openDialog', dialog: next })}
          onSetEgo={(id) => dispatch({ type: 'edit', run: (f) => ops.setEgo(f, id), close: true })}
          onDelete={(id) => dispatch({ type: 'edit', run: (f) => ops.deletePerson(f, id), close: true })}
          onUnionStatus={(uid, status) => dispatch({ type: 'edit', run: (f) => ops.setUnionStatus(f, uid, status) })}
          onSetParents={(pid, uid) => dispatch({ type: 'edit', run: (f) => ops.setParents(f, pid, uid), notice: '親を変更しました' })}
          onLinkSpouse={(a, b) => dispatch({ type: 'edit', run: (f) => ops.linkSpouses(f, a, b), notice: '婚姻関係を結びました' })}
        />
      )}
      {overlay?.kind === 'labels' && (
        <LabelSettings
          overrides={current.settings.labelOverrides}
          onChange={(id, o) => dispatch({ type: 'edit', run: (f) => ops.setLabelOverride(f, id, o) })}
          onClose={closeMenuDialog}
        />
      )}
      {overlay?.kind === 'print' && <PrintDialog file={current} prefs={prefs} onClose={closeMenuDialog} />}
      {overlay?.kind === 'export' && <ExportDialog onExport={() => downloadJson(current)} onClose={closeMenuDialog} />}
      {overlay?.kind === 'import' && (
        <ImportDialog
          existingCount={current.persons.length}
          onExportCurrent={() => downloadJson(current)}
          onChooseFile={() => fileInput.current?.click()}
          onClose={closeOverlay}
        />
      )}
      {overlay?.kind === 'importErrors' && (
        <Modal title="読み込めませんでした" onClose={closeOverlay}>
          <ul class="errors">
            {overlay.errors.slice(0, 20).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Modal>
      )}
      {overlay?.kind === 'confirm' && (
        <Modal title="確認" onClose={closeOverlay}>
          <p>{overlay.message}</p>
          <div class="form-actions">
            <button
              type="button"
              class="danger"
              onClick={() => {
                overlay.action();
                closeOverlay();
              }}
            >
              続ける
            </button>
            <button type="button" data-autofocus onClick={closeOverlay}>
              やめる
            </button>
          </div>
        </Modal>
      )}
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onImportFile} />
      <Toast text={state.notice} onDone={() => notify('')} />
    </>
  );
}
