import { useMemo, useState } from 'preact/hooks';
import { KIN_MASTER } from '../core/kinshipMaster';
import type { LabelOverride } from '../core/types';
import { Modal } from './Modal';

/** Edit per-family wording of kinship labels (e.g. おとうさん → パパ). */
export function LabelSettings(props: {
  overrides: Record<string, LabelOverride>;
  onChange: (labelId: string, o: LabelOverride | undefined) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const labels = useMemo(() => {
    const seen = new Map<string, { id: string; kanji: string; kana: string }>();
    for (const r of KIN_MASTER) if (!seen.has(r.id)) seen.set(r.id, { id: r.id, kanji: r.kanji, kana: r.kana });
    return [...seen.values()];
  }, []);
  const shown = labels.filter((l) => {
    const o = props.overrides[l.id];
    return !q || [l.kanji, l.kana, o?.kanji, o?.kana].some((s) => s?.includes(q));
  });
  const changed = Object.keys(props.overrides).length;

  return (
    <Modal title="呼び方の設定" subtitle="家庭での呼び方に変えられます。空欄なら標準の言い方になります。" onClose={props.onClose} wide>
      <div class="label-toolbar">
        <input type="search" placeholder="さがす（例：おとうさん）" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
        <span class="hint">{changed ? `${changed}件 変更中` : ''}</span>
      </div>
      <div class="label-table-wrap">
        <table class="label-table">
          <thead>
            <tr>
              <th>標準（漢字）</th>
              <th>漢字の呼び方</th>
              <th>標準（ひらがな）</th>
              <th>ひらがなの呼び方</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((l) => {
              const o = props.overrides[l.id] ?? {};
              const update = (patch: LabelOverride) => props.onChange(l.id, { ...o, ...patch });
              return (
                <tr key={l.id} class={props.overrides[l.id] ? 'changed' : ''}>
                  <td>{l.kanji}</td>
                  <td>
                    <input type="text" value={o.kanji ?? ''} placeholder={l.kanji} onChange={(e) => update({ kanji: (e.target as HTMLInputElement).value })} />
                  </td>
                  <td>{l.kana}</td>
                  <td>
                    <input type="text" value={o.kana ?? ''} placeholder={l.kana} onChange={(e) => update({ kana: (e.target as HTMLInputElement).value })} />
                  </td>
                  <td>
                    {props.overrides[l.id] && (
                      <button type="button" class="small" onClick={() => props.onChange(l.id, undefined)}>
                        もとに戻す
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
