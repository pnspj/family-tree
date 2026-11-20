import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import * as ops from './core/ops';
import { sampleFile } from './core/sample';
import type { FamilyFile } from './core/types';
import { downloadJson, loadFile, loadPrefs, saveFile, savePrefs, type Script, type ViewPrefs } from './storage';
import { LabelSettings } from './ui/LabelSettings';
import { Modal } from './ui/Modal';
import { PersonDialog, type DialogState } from './ui/PersonDialog';
import { TreeView, isKinshipHidden, isNameHidden, type MaskState } from './ui/TreeView';
import { Ruby } from './ui/Ruby';
import { isKana, personName } from './ui/display';

type Mode = 'view' | 'edit';
type BoolPref = { [K in keyof ViewPrefs]: ViewPrefs[K] extends boolean ? K : never }[keyof ViewPrefs];
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
  const [revealedNames, setRevealedNames] = useState<Set<string>>(new Set());
  const [revealedKinship, setRevealedKinship] = useState<Set<string>>(new Set());
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
    setRevealedNames(new Set());
    setRevealedKinship(new Set());
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
            script={prefs.script}
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
            onSetParents={() => {}}
            onLinkSpouse={() => {}}
          />
        )}
        {hiddenInput}
        {commonDialogs}
      </div>
    );
  }

  // ---- main screen ----------------------------------------------------------
  const ego = file.persons.find((p) => p.id === file.settings.egoId);
  const toggle = (k: BoolPref) => setPrefs((p) => ({ ...p, [k]: !p[k] }));
  const kana = isKana(prefs);
  const quiz = mode === 'view' && (prefs.maskName || prefs.maskKinship);
  const masks: MaskState | null = quiz
    ? { name: prefs.maskName, kinship: prefs.maskKinship && prefs.showKinship, revealedNames, revealedKinship }
    : null;
  const hiddenCount = file.persons.filter(
    (p) => isNameHidden(masks, p.id, file.settings.egoId) || isKinshipHidden(masks, p.id, file.settings.egoId),
  ).length;
  const remask = () => {
    setRevealedNames(new Set());
    setRevealedKinship(new Set());
  };
  const onCardClick = (id: string) => {
    if (mode === 'edit') return setDialog({ kind: 'edit', id });
    const egoId = file.settings.egoId;
    // Quiz: the first tap reveals the hidden parts, the next one switches the viewpoint.
    if (isNameHidden(masks, id, egoId) || isKinshipHidden(masks, id, egoId)) {
      setRevealedNames((s) => new Set(s).add(id));
      setRevealedKinship((s) => new Set(s).add(id));
      return;
    }
    if (id === egoId) return;
    if (apply(ops.setEgo(file, id))) setRevealedKinship(new Set()); // new viewpoint: kinship is hidden again
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
        <div class="seg" role="group" aria-label="文字">
          {(
            [
              ['kanji', 'かんじ'],
              ['furigana', 'ふりがな'],
              ['kana', 'ひらがな'],
            ] as [Script, string][]
          ).map(([s, label]) => (
            <button type="button" key={s} class={prefs.script === s ? 'on' : ''} onClick={() => setPrefs((p) => ({ ...p, script: s }))}>
              {label}
            </button>
          ))}
        </div>
        {mode === 'view' && (
          <div class="quiz" role="group" aria-label="クイズ">
            <span class="quiz-title">{kana ? 'かくす' : '隠す'}：</span>
            <label class="switch">
              <input type="checkbox" checked={prefs.maskName} onChange={() => toggle('maskName')} />
              {kana ? 'なまえ' : '名前'}
            </label>
            <label class="switch">
              <input type="checkbox" checked={prefs.maskKinship} onChange={() => toggle('maskKinship')} />
              {kana ? 'よびかた' : '続柄'}
            </label>
            {quiz && (
              <>
                <span class="quiz-count">{hiddenCount ? `あと ${hiddenCount} にん` : 'ぜんぶ わかった！'}</span>
                <button type="button" class="small" onClick={remask}>
                  もういちど かくす
                </button>
              </>
            )}
          </div>
        )}
        <span class="ego">
          {kana ? 'きじゅん' : '基準'}：
          <strong>{ego ? <Ruby text={personName(ego, prefs) || '（なまえなし）'} /> : '—'}</strong>
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
                ] as [BoolPref, string][]
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
        {mode === 'edit'
          ? 'カードを押すと、その人の編集・家族の追加ができます'
          : quiz
            ? 'だれかな？ カードを おして こたえを みてみよう。もう いちど おすと、その ひとから みた よびかたに かわるよ'
            : kana
              ? 'カードを おすと、その ひとから みた よびかたに かわるよ'
              : 'カードを押すと、その人から見た続柄に切り替わります'}
      </p>
      <main class="stage">
        <TreeView file={file} prefs={prefs} masks={masks} onCardClick={onCardClick} fitRequest={fitRequest} />
      </main>
      {dialog && (
        <PersonDialog
          file={file}
          state={dialog}
          script={prefs.script}
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
          onSetParents={(pid, uid) => {
            if (apply(ops.setParents(file, pid, uid))) setToast('親を変更しました');
          }}
          onLinkSpouse={(a, b) => {
            if (apply(ops.linkSpouses(file, a, b))) setToast('婚姻関係を結びました');
          }}
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
