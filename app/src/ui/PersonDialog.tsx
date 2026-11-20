import { useMemo, useState } from 'preact/hooks';
import { createKinship } from '../core/kinship';
import { parentCount, unionCount, wouldSplit, MAX_UNIONS_PER_PERSON, type PersonFields } from '../core/ops';
import type { FamilyFile, Gender, PartialDate, Person, Union } from '../core/types';
import { kinshipText } from './display';
import { Modal } from './Modal';

export type Relation = 'first' | 'parent' | 'spouse' | 'child' | 'sibling';

export type DialogState =
  | { kind: 'edit'; id: string }
  | { kind: 'add'; relation: Relation; baseId?: string; unionId?: string; preset?: PersonFields };

interface Props {
  file: FamilyFile;
  state: DialogState;
  kana: boolean;
  onClose: () => void;
  onSave: (fields: PersonFields) => void;
  onAdd: (next: DialogState) => void;
  onSetEgo: (id: string) => void;
  onDelete: (id: string) => void;
  onUnionStatus: (unionId: string, status: Union['status']) => void;
}

const relationTitle: Record<Relation, string> = {
  first: '最初の人を登録',
  parent: '親を追加',
  spouse: '配偶者を追加',
  child: '子を追加',
  sibling: 'きょうだいを追加',
};

const nameOf = (p?: Person) => (p ? [p.familyName, p.givenName].filter(Boolean).join(' ') || [p.familyNameKana, p.givenNameKana].filter(Boolean).join(' ') || '（なまえなし）' : '');

export function PersonDialog(props: Props) {
  const { file, state } = props;
  const persons = useMemo(() => new Map(file.persons.map((p) => [p.id, p])), [file.persons]);
  const person = state.kind === 'edit' ? persons.get(state.id) : undefined;
  const base = state.kind === 'add' && state.baseId ? persons.get(state.baseId) : undefined;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const title =
    state.kind === 'edit'
      ? nameOf(person)
      : base
        ? `${nameOf(base)} の${relationTitle[state.relation].replace('を追加', '')}を追加`
        : relationTitle[state.relation];

  const kin = useMemo(() => createKinship(file, file.settings.labelOverrides), [file]);
  const egoId = file.settings.egoId;
  const kinLabel = person && egoId ? kinshipText(kin.resolve(egoId, person.id), { kana: props.kana, showSide: true }) : '';

  return (
    <Modal title={title} subtitle={kinLabel && egoId !== person?.id ? `${nameOf(persons.get(egoId!))} から見て：${kinLabel}` : undefined} onClose={props.onClose}>
      <PersonForm
        key={state.kind === 'edit' ? state.id : `${state.relation}-${state.baseId}`}
        initial={person ? stripPerson(person) : state.kind === 'add' ? (state.preset ?? {}) : {}}
        submitLabel={state.kind === 'edit' ? '保存する' : '追加する'}
        onSubmit={props.onSave}
      />
      {person && (
        <>
          <Relatives file={file} person={person} persons={persons} onAdd={props.onAdd} onUnionStatus={props.onUnionStatus} />
          <div class="dialog-actions">
            {egoId !== person.id && (
              <button type="button" onClick={() => props.onSetEgo(person.id)}>
                この人から見た続柄にする
              </button>
            )}
            {!confirmDelete ? (
              <button type="button" class="danger-outline" onClick={() => setConfirmDelete(true)}>
                削除…
              </button>
            ) : (
              <div class="confirm">
                <p>
                  {nameOf(person)} を削除します。
                  {wouldSplit(file, person.id) && <strong> この人を削除すると、家系図が2つ以上に分かれます。</strong>}
                </p>
                <button type="button" class="danger" onClick={() => props.onDelete(person.id)}>
                  削除する
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}>
                  やめる
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

function stripPerson(p: Person): PersonFields {
  const { id: _id, childOf: _c, ...rest } = p;
  return rest;
}

// ---- relatives section -------------------------------------------------------

function Relatives(props: {
  file: FamilyFile;
  person: Person;
  persons: Map<string, Person>;
  onAdd: (s: DialogState) => void;
  onUnionStatus: (unionId: string, status: Union['status']) => void;
}) {
  const { file, person, persons, onAdd } = props;
  const parents = parentCount(file, person.id);
  const unions = file.unions.filter((u) => u.partners.includes(person.id));
  const marriages = unions.filter((u) => u.partners.filter(Boolean).length === 2);
  const singleUnion = unions.find((u) => u.partners.filter(Boolean).length === 1);
  const canAddSpouse = unionCount(file, person.id) < MAX_UNIONS_PER_PERSON;
  const partnerOf = (u: Union) => persons.get(u.partners.find((p) => p && p !== person.id)!);
  const add = (relation: Relation, preset: PersonFields = {}, unionId?: string) =>
    onAdd({ kind: 'add', relation, baseId: person.id, unionId, preset });
  // Child targets: each marriage, plus "partner unknown" when that is possible.
  const childTargets: { label: string; unionId?: string }[] = [
    ...marriages.map((u) => ({ label: `${nameOf(partnerOf(u))} との子`, unionId: u.id })),
    ...(singleUnion || canAddSpouse ? [{ label: marriages.length ? '相手不明の子' : '子', unionId: singleUnion?.id }] : []),
  ];

  return (
    <section class="relatives">
      <h3>家族を追加</h3>
      <div class="chips">
        <button type="button" disabled={parents >= 2} onClick={() => add('parent', { gender: 'M' })}>
          ＋ 父
        </button>
        <button type="button" disabled={parents >= 2} onClick={() => add('parent', { gender: 'F' })}>
          ＋ 母
        </button>
        <button type="button" disabled={!canAddSpouse} onClick={() => add('spouse')}>
          ＋ 配偶者
        </button>
        {childTargets.map((t) => (
          <button type="button" key={t.label} onClick={() => add('child', {}, t.unionId)}>
            ＋ {t.label}
          </button>
        ))}
        <button type="button" onClick={() => add('sibling')}>
          ＋ きょうだい
        </button>
      </div>
      {parents >= 2 && <p class="hint">親はすでに2人登録されています。</p>}
      {!canAddSpouse && <p class="hint">婚姻関係は1人につき2つまでです。</p>}
      {marriages.length > 0 && (
        <>
          <h3>婚姻関係</h3>
          <ul class="marriages">
            {marriages.map((u) => (
              <li key={u.id}>
                <span>{nameOf(partnerOf(u))}</span>
                <select
                  value={u.status}
                  onChange={(e) => props.onUnionStatus(u.id, (e.target as HTMLSelectElement).value as Union['status'])}
                >
                  <option value="current">現在の配偶者</option>
                  <option value="former">元配偶者</option>
                </select>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

// ---- form --------------------------------------------------------------------

interface DateParts {
  y: string;
  m: string;
  d: string;
}
const toParts = (d?: PartialDate): DateParts => ({ y: d ? String(d.y) : '', m: d?.m ? String(d.m) : '', d: d?.d ? String(d.d) : '' });

function fromParts(p: DateParts, label: string): { value?: PartialDate; error?: string } {
  const [y, m, d] = [p.y, p.m, p.d].map((s) => s.trim());
  if (!y && !m && !d) return {};
  if (!y) return { error: `${label}：年を入力してください` };
  if (d && !m) return { error: `${label}：日を入れるときは月も入力してください` };
  const value: PartialDate = { y: Number(y) };
  if (m) value.m = Number(m);
  if (d) value.d = Number(d);
  if (!Number.isInteger(value.y) || value.y < 1 || value.y > 9999) return { error: `${label}：年が正しくありません` };
  if (value.m !== undefined && !(Number.isInteger(value.m) && value.m >= 1 && value.m <= 12)) return { error: `${label}：月が正しくありません` };
  if (value.d !== undefined) {
    const last = new Date(value.y, value.m!, 0).getDate();
    if (!(Number.isInteger(value.d) && value.d >= 1 && value.d <= last)) return { error: `${label}：日が正しくありません` };
  }
  return { value };
}

function PersonForm(props: { initial: PersonFields; submitLabel: string; onSubmit: (f: PersonFields) => void }) {
  const init = props.initial;
  const [f, setF] = useState<PersonFields>(init);
  const [birth, setBirth] = useState(toParts(init.birth));
  const [death, setDeath] = useState(toParts(init.death));
  const [error, setError] = useState('');
  const set = <K extends keyof PersonFields>(k: K, v: PersonFields[K]) => setF((x) => ({ ...x, [k]: v }));
  const text = (k: keyof PersonFields, label: string, placeholder = '') => (
    <label>
      <span>{label}</span>
      <input
        type="text"
        value={(f[k] as string) ?? ''}
        placeholder={placeholder}
        onInput={(e) => set(k, (e.target as HTMLInputElement).value as never)}
      />
    </label>
  );
  const hasDeath = !!(death.y || death.m || death.d);

  const submit = (e: Event) => {
    e.preventDefault();
    const b = fromParts(birth, '生年月日');
    const d = fromParts(death, '没年月日');
    const err = b.error ?? d.error;
    if (err) return setError(err);
    if (b.value && d.value && (d.value.y < b.value.y)) return setError('没年月日が生年月日より前になっています');
    setError('');
    props.onSubmit({ ...f, birth: b.value, death: d.value });
  };

  return (
    <form class="person-form" onSubmit={submit}>
      <div class="row">
        {text('familyName', '姓', '山田')}
        {text('givenName', '名', '太郎')}
      </div>
      <div class="row">
        {text('familyNameKana', 'みょうじ', 'やまだ')}
        {text('givenNameKana', 'なまえ', 'たろう')}
      </div>
      <details open={!!(init.birthFamilyName || init.birthFamilyNameKana || init.nickname)}>
        <summary>旧姓・呼び名</summary>
        <div class="row">
          {text('birthFamilyName', '旧姓')}
          {text('birthFamilyNameKana', '旧姓（かな）')}
        </div>
        <div class="row">{text('nickname', '呼び名', '例：しずおかの ばあば')}</div>
      </details>
      <fieldset class="gender">
        <legend>性別</legend>
        {(
          [
            ['M', '男'],
            ['F', '女'],
            ['O', '他'],
            [undefined, '未入力'],
          ] as [Gender | undefined, string][]
        ).map(([g, label]) => (
          <label key={label} class="radio">
            <input type="radio" name="gender" checked={f.gender === g} onChange={() => set('gender', g)} />
            {label}
          </label>
        ))}
        {f.gender === 'O' && (
          <input
            type="text"
            class="gender-label"
            placeholder="自由入力"
            value={f.genderLabel ?? ''}
            onInput={(e) => set('genderLabel', (e.target as HTMLInputElement).value)}
          />
        )}
      </fieldset>
      <DateInput label="生年月日" value={birth} onChange={setBirth} />
      <DateInput label="没年月日" value={death} onChange={setDeath} />
      <label class="check">
        <input
          type="checkbox"
          checked={hasDeath || !!f.deceased}
          disabled={hasDeath}
          onChange={(e) => set('deceased', (e.target as HTMLInputElement).checked)}
        />
        亡くなっている{hasDeath ? '（没年月日から自動）' : '（没年月日が不明な場合）'}
      </label>
      {error && <p class="error">{error}</p>}
      <div class="form-actions">
        <button type="submit" class="primary">
          {props.submitLabel}
        </button>
      </div>
    </form>
  );
}

function DateInput(props: { label: string; value: DateParts; onChange: (v: DateParts) => void }) {
  const part = (k: keyof DateParts, ph: string, unit: string, w: string) => (
    <span class="date-part">
      <input
        type="number"
        inputMode="numeric"
        style={{ width: w }}
        placeholder={ph}
        value={props.value[k]}
        onInput={(e) => props.onChange({ ...props.value, [k]: (e.target as HTMLInputElement).value })}
      />
      {unit}
    </span>
  );
  return (
    <div class="date-input">
      <span>{props.label}</span>
      {part('y', '', '年', '5.5em')}
      {part('m', '', '月', '3.5em')}
      {part('d', '', '日', '3.5em')}
      <span class="hint">年だけ・年月だけでもOK</span>
    </div>
  );
}
