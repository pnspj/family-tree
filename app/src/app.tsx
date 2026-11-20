import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import * as ops from './core/ops';
import { sampleFile } from './core/sample';
import type { FamilyFile } from './core/types';
import { downloadJson, loadFile, loadPrefs, saveFile, savePrefs, type ViewPrefs } from './storage';
import { LabelSettings } from './ui/LabelSettings';
import { Modal } from './ui/Modal';
import { PersonDialog, type DialogState } from './ui/PersonDialog';
import { TreeView } from './ui/TreeView';
import { personName } from './ui/display';

type Mode = 'view' | 'edit';
type Confirm = { message: string; action: () => void } | null;

export function App() {
  const [file, setFile] = useState<FamilyFile | null | undefined>(undefined); // undefined = loading
  const [prefs, setPrefs] = useState<ViewPrefs>(loadPrefs);
  const [mode, setMode] = useState<Mode>('view');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [toast, setToast] = useState('');
  const [fitRequest, setFitRequest] = useState({ whole: false });
  const fileInput = useRef<HTMLInputElement>(null);

  // Load once, then autosave every change (debounced).
  useEffect(() => {
    loadFile().then((f) => setFile(f ?? null));
  }, []);
  useEffect(() => {
    if (!file) return;
    const t = setTimeout(() => saveFile(file).catch(() => setToast('ブラウザに保存できませんでした')), 400);
    return () => clearTimeout(t);
  }, [file]);
  useEffect(() => savePrefs(prefs), [prefs]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const replaceFile = (f: FamilyFile) => {
    setFile(f);
    setDialog(null);
    setFitRequest({ whole: false });
  };
  const apply = (r: ops.OpResult): r is Extract<ops.OpResult, { ok: true }> => {
    if (!r.ok) {
      setToast(r.error);
      return false;
    }
    setFile(r.file);
    return true;
  };
  const guardReplace = (action: () => void) => {
    if (file?.persons.length) setConfirm({ message: 'いまの家系図は消えて置き換わります。先に「JSONで書き出す」で保存しておくと安心です。', action });
    else action();
  };

  const onImport = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    const r = ops.parseFamilyFile(await f.text());
    if (!r.ok) return setImportErrors(r.errors);
    guardReplace(() => replaceFile(r.file));
  };
  const openImport = () => fileInput.current?.click();
  const closeDialog = useCallback(() => setDialog(null), []);

  if (file === undefined) return <div class="loading">読み込み中…</div>;

  const hiddenInput = <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onImport} />;
  const commonDialogs = (
    <>
      {confirm && (
        <Modal title="確認" onClose={() => setConfirm(null)}>
          <p>{confirm.message}</p>
          <div class="form-actions">
            <button
              type="button"
              class="danger"
              onClick={() => {
                confirm.action();
                setConfirm(null);
              }}
            >
              続ける
            </button>
            <button type="button" onClick={() => setConfirm(null)}>
              やめる
            </button>
          </div>
        </Modal>
      )}
      {importErrors && (
        <Modal title="読み込めませんでした" onClose={() => setImportErrors(null)}>
          <ul class="errors">
            {importErrors.slice(0, 20).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Modal>
      )}
      {toast && (
        <div class="toast" role="status">
          {toast}
        </div>
      )}
    </>
  );

  // ---- start screen ---------------------------------------------------------
  if (!file || !file.persons.length) {
    const startFile = file ?? ops.emptyFile();
    return (
      <div class="start">
        <h1>かけいず</h1>
        <p>家族や親戚のつながりを、図にして見てみよう。</p>
        <div class="start-actions">
          <button type="button" class="primary" onClick={() => setDialog({ kind: 'add', relation: 'first' })}>
            あたらしく作る
          </button>
          <button type="button" onClick={() => replaceFile(sampleFile())}>
            サンプルの家族で試す
          </button>
          <button type="button" onClick={openImport}>
            JSONファイルを読み込む
          </button>
        </div>
        <p class="hint">データはこのブラウザの中だけに保存され、どこにも送信されません。</p>
        {dialog && (
          <PersonDialog
            file={startFile}
            state={dialog}
            kana={prefs.kana}
            onClose={closeDialog}
            onSave={(fields) => {
              const r = ops.createFirstPerson(startFile, fields);
              if (r.ok) {
                replaceFile(r.file);
                setMode('edit');
              }
            }}
            onAdd={setDialog}
            onSetEgo={() => {}}
            onDelete={() => {}}
            onUnionStatus={() => {}}
          />
        )}
        {hiddenInput}
        {commonDialogs}
      </div>
    );
  }

  // ---- main screen ----------------------------------------------------------
  const ego = file.persons.find((p) => p.id === file.settings.egoId);
  const toggle = (k: keyof ViewPrefs) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const onCardClick = (id: string) => {
    if (mode === 'edit') setDialog({ kind: 'edit', id });
    else apply(ops.setEgo(file, id));
  };
  const onSave = (fields: ops.PersonFields) => {
    if (!dialog) return;
    if (dialog.kind === 'edit') {
      if (apply(ops.updatePerson(file, dialog.id, fields))) setDialog(null);
      return;
    }
    const base = dialog.baseId!;
    const r =
      dialog.relation === 'parent'
        ? ops.addParent(file, base, fields)
        : dialog.relation === 'spouse'
          ? ops.addSpouse(file, base, fields)
          : dialog.relation === 'child'
            ? ops.addChild(file, base, fields, dialog.unionId)
            : ops.addSibling(file, base, fields);
    if (apply(r)) setDialog(null);
  };

  return (
    <div class="app">
      <header class="toolbar">
        <div class="seg" role="group" aria-label="モード">
          <button type="button" class={mode === 'view' ? 'on' : ''} onClick={() => setMode('view')}>
            みる
          </button>
          <button type="button" class={mode === 'edit' ? 'on' : ''} onClick={() => setMode('edit')}>
            へんしゅう
          </button>
        </div>
        <label class="switch">
          <input type="checkbox" checked={prefs.kana} onChange={() => toggle('kana')} />
          ひらがな
        </label>
        <span class="ego">
          {prefs.kana ? 'きじゅん' : '基準'}：<strong>{ego ? personName(ego, prefs) || '（なまえなし）' : '—'}</strong>
        </span>
        <span class="spacer" />
        <button type="button" onClick={() => setFitRequest({ whole: true })}>
          全体を表示
        </button>
        <div class="menu-wrap">
          <button type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
            メニュー ▾
          </button>
          {menuOpen && (
            <div class="menu" onClick={() => setMenuOpen(false)}>
              <p class="menu-title">表示</p>
              {(
                [
                  ['showKinship', '続柄'],
                  ['showSide', '父方・母方'],
                  ['pathFallback', '遠い関係も「〜の〜」で表示'],
                  ['showLife', '生年・年齢'],
                  ['genderColor', '性別の色'],
                  ['preferNickname', '呼び名で表示'],
                ] as [keyof ViewPrefs, string][]
              ).map(([k, label]) => (
                <label key={k} class="menu-check" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={prefs[k]} onChange={() => toggle(k)} />
                  {label}
                </label>
              ))}
              <hr />
              <button type="button" onClick={() => setShowLabels(true)}>
                呼び方の設定…
              </button>
              <button type="button" onClick={() => downloadJson(file)}>
                JSONで書き出す
              </button>
              <button type="button" onClick={openImport}>
                JSONを読み込む…
              </button>
              <hr />
              <button type="button" onClick={() => guardReplace(() => replaceFile(sampleFile()))}>
                サンプルを開く…
              </button>
              <button type="button" class="danger-text" onClick={() => guardReplace(() => setFile(ops.emptyFile()))}>
                新しく作り直す…
              </button>
            </div>
          )}
        </div>
      </header>
      <p class="mode-hint">
        {mode === 'view'
          ? prefs.kana
            ? 'カードを おすと、その ひとから みた よびかたに かわるよ'
            : 'カードを押すと、その人から見た続柄に切り替わります'
          : 'カードを押すと、その人の編集・家族の追加ができます'}
      </p>
      <main class="stage">
        <TreeView file={file} prefs={prefs} onCardClick={onCardClick} fitRequest={fitRequest} />
      </main>
      {dialog && (
        <PersonDialog
          file={file}
          state={dialog}
          kana={prefs.kana}
          onClose={closeDialog}
          onSave={onSave}
          onAdd={setDialog}
          onSetEgo={(id) => {
            if (apply(ops.setEgo(file, id))) setDialog(null);
          }}
          onDelete={(id) => {
            if (apply(ops.deletePerson(file, id))) setDialog(null);
          }}
          onUnionStatus={(uid, status) => apply(ops.setUnionStatus(file, uid, status))}
        />
      )}
      {showLabels && (
        <LabelSettings
          overrides={file.settings.labelOverrides}
          onChange={(id, o) => apply(ops.setLabelOverride(file, id, o))}
          onClose={() => setShowLabels(false)}
        />
      )}
      {hiddenInput}
      {commonDialogs}
    </div>
  );
}
