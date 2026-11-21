import { useEffect, useRef, useState } from 'preact/hooks';
import * as ops from './core/ops';
import { sampleFile } from './core/sample';
import type { FamilyFile } from './core/types';
import { downloadJson, loadFile, loadPrefs, saveFile, savePrefs, type Script, type ViewPrefs } from './storage';
import { LabelSettings } from './ui/LabelSettings';
import { Modal } from './ui/Modal';
import { PersonDialog, type DialogState } from './ui/PersonDialog';
import { TreeView, isKinshipHidden, isNameHidden, type MaskState } from './ui/TreeView';
import { Ruby } from './ui/Ruby';
import { PrintDialog } from './ui/Print';
import { ExportDialog, GUIDE_URL, ImportDialog } from './ui/DataDialogs';
import { ConsentScreen } from './ui/Consent';
import { PRIVACY_URL, TERMS_URL, hasCurrentConsent, loadConsent, requestPersistentStorage, saveConsent } from './legal';
import { QuizBar, useQuiz } from './ui/Quiz';
import { isKana, personName } from './ui/display';

type Mode = 'view' | 'quiz' | 'edit';
type BoolPref = { [K in keyof ViewPrefs]: ViewPrefs[K] extends boolean ? K : never }[keyof ViewPrefs];
const EMPTY = ops.emptyFile();
/** Each dialog state mounts a fresh dialog, so focus starts at its first field again. */
const dialogKey = (d: DialogState) => (d.kind === 'edit' ? `edit-${d.id}` : `add-${d.relation}-${d.baseId ?? ''}-${d.unionId ?? ''}`);
type Confirm = { message: string; action: () => void } | null;

export function App() {
  const [file, setFile] = useState<FamilyFile | null | undefined>(undefined); // undefined = loading
  const [prefs, setPrefs] = useState<ViewPrefs>(loadPrefs);
  const [mode, setMode] = useState<Mode>('view');
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Terms / privacy consent by an adult, required before anything else (re-asked when the terms change).
  const [consented, setConsented] = useState(hasCurrentConsent);
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const focusCard = (id: string | undefined) => id && setFocusRequest({ id });
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [importErrors, setImportErrors] = useState<string[] | null>(null);
  const [toast, setToast] = useState('');
  const [fitRequest, setFitRequest] = useState({ whole: false });
  const [revealedNames, setRevealedNames] = useState<Set<string>>(new Set());
  const [revealedKinship, setRevealedKinship] = useState<Set<string>>(new Set());
  const fileInput = useRef<HTMLInputElement>(null);
  const quiz = useQuiz(file ?? EMPTY, prefs, mode === 'quiz' && !!file?.persons.length);

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
  // Ask the browser to keep this site's storage (no prompt in most browsers once granted).
  useEffect(() => {
    if (consented) requestPersistentStorage();
  }, [consented]);
  // Close the menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.('.menu-wrap')) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
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
    replaceFile(r.file); // the import dialog already warned about replacing and got agreement
  };
  const openImport = () => fileInput.current?.click();
  // Cancelling a person dialog returns focus to the card it was opened from.
  const closeDialog = () => {
    if (dialog) focusCard(dialog.kind === 'edit' ? dialog.id : dialog.baseId);
    setDialog(null);
  };
  const closeMenuDialog = (close: () => void) => () => {
    close();
    requestAnimationFrame(() => menuButton.current?.focus());
  };

  if (!consented)
    return (
      <ConsentScreen
        renewed={!!loadConsent()}
        onAgree={() => {
          saveConsent();
          setConsented(true);
        }}
      />
    );
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
            <button type="button" data-autofocus onClick={() => setConfirm(null)}>
              やめる
            </button>
          </div>
        </Modal>
      )}
      {showImport && (
        <ImportDialog
          existingCount={file?.persons.length ?? 0}
          onExportCurrent={() => file && downloadJson(file)}
          onChooseFile={openImport}
          onClose={() => setShowImport(false)}
        />
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
          <button type="button" onClick={() => setShowImport(true)}>
            JSONファイルを読み込む
          </button>
        </div>
        <p class="hint">データはこのブラウザの中だけに保存され、どこにも送信されません。</p>
        {dialog && (
          <PersonDialog
            key={dialogKey(dialog)}
            file={startFile}
            state={dialog}
            script={prefs.script}
            onClose={closeDialog}
            onSave={(fields) => {
              const r = ops.createFirstPerson(startFile, fields);
              if (r.ok) {
                replaceFile(r.file);
                setMode('edit');
                focusCard(r.personId); // Enter on the card opens it to add the next person
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
  const maskQuiz = mode === 'view' && (prefs.maskName || prefs.maskKinship);
  const masks: MaskState | null = maskQuiz
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
    if (mode === 'quiz') return quiz.answerCard(id);
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
  const onSave = (fields: ops.PersonFields, opts?: { fillUnionId?: string }) => {
    if (!dialog) return;
    if (dialog.kind === 'edit') {
      if (apply(ops.updatePerson(file, dialog.id, fields))) {
        setDialog(null);
        focusCard(dialog.id);
      }
      return;
    }
    const base = dialog.baseId!;
    const r =
      dialog.relation === 'parent'
        ? ops.addParent(file, base, fields)
        : dialog.relation === 'spouse'
          ? ops.addSpouse(file, base, fields, 'current', opts?.fillUnionId)
          : dialog.relation === 'child'
            ? ops.addChild(file, base, fields, dialog.unionId)
            : ops.addSibling(file, base, fields);
    if (apply(r)) {
      setDialog(null);
      focusCard(r.personId); // the new person's card, ready for Enter -> add the next one
    }
  };

  return (
    <div class="app">
      <header class="toolbar">
        <div class="seg" role="group" aria-label="モード">
          <button type="button" class={mode === 'view' ? 'on' : ''} onClick={() => setMode('view')}>
            みる
          </button>
          <button type="button" class={mode === 'quiz' ? 'on' : ''} onClick={() => setMode('quiz')}>
            クイズ
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
            {maskQuiz && (
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
          <button ref={menuButton} type="button" aria-expanded={menuOpen} aria-haspopup="true" onClick={() => setMenuOpen((o) => !o)}>
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
                  ['showBirthName', '旧姓'],
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
              <button type="button" onClick={() => setShowPrint(true)}>
                印刷・画像で保存…
              </button>
              <button type="button" onClick={() => setShowExport(true)}>
                JSONで書き出す…
              </button>
              <button type="button" onClick={() => setShowImport(true)}>
                JSONを読み込む…
              </button>
              <a class="menu-link" href={GUIDE_URL} target="_blank" rel="noopener">
                しくみと注意（せつめい）
              </a>
              <a class="menu-link" href={TERMS_URL} target="_blank" rel="noopener">
                利用規約・免責事項
              </a>
              <a class="menu-link" href={PRIVACY_URL} target="_blank" rel="noopener">
                プライバシーポリシー
              </a>
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
          ? 'カードを押すと、その人の編集・家族の追加ができます（キーボードでは矢印キーでカードを移動、Enterで開く）'
          : mode === 'quiz'
            ? kana
              ? 'もんだいに こたえてね。きじゅんを かえるときは「みる」で カードを おしてね'
              : '問題に答えましょう。基準の人を変えるときは「みる」でカードを押します'
          : maskQuiz
            ? 'だれかな？ カードを おして こたえを みてみよう。もう いちど おすと、その ひとから みた よびかたに かわるよ'
            : kana
              ? 'カードを おすと、その ひとから みた よびかたに かわるよ'
              : 'カードを押すと、その人から見た続柄に切り替わります'}
      </p>
      <main class="stage">
        {mode === 'quiz' && <QuizBar quiz={quiz} script={prefs.script} />}
        <TreeView
          file={file}
          prefs={prefs}
          hidden={
            mode === 'quiz'
              ? quiz.hidden
              : (id) => ({ name: isNameHidden(masks, id, file.settings.egoId), kinship: isKinshipHidden(masks, id, file.settings.egoId) })
          }
          cardClass={mode === 'quiz' ? quiz.cardClass : undefined}
          onCardClick={onCardClick}
          fitRequest={fitRequest}
          focusRequest={focusRequest}
        />
      </main>
      {dialog && (
        <PersonDialog
          key={dialogKey(dialog)}
          file={file}
          state={dialog}
          script={prefs.script}
          onClose={closeDialog}
          onSave={onSave}
          onAdd={setDialog}
          onSetEgo={(id) => {
            if (apply(ops.setEgo(file, id))) {
              setDialog(null);
              focusCard(id);
            }
          }}
          onDelete={(id) => {
            const r = ops.deletePerson(file, id);
            if (apply(r)) {
              setDialog(null);
              if (r.ok) focusCard(r.file.settings.egoId);
            }
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
      {showExport && <ExportDialog onExport={() => downloadJson(file)} onClose={closeMenuDialog(() => setShowExport(false))} />}
      {showPrint && <PrintDialog file={file} prefs={prefs} onClose={closeMenuDialog(() => setShowPrint(false))} />}
      {showLabels && (
        <LabelSettings
          overrides={file.settings.labelOverrides}
          onChange={(id, o) => apply(ops.setLabelOverride(file, id, o))}
          onClose={closeMenuDialog(() => setShowLabels(false))}
        />
      )}
      {hiddenInput}
      {commonDialogs}
    </div>
  );
}
