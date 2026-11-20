// family-chart (donatso) adapter. The library is ego-centric: it lays out the
// ancestors and descendants of the "main" person, and clicking a card re-centers.
import * as f3 from 'family-chart';
import 'family-chart/styles/family-chart.css';
import type { FamilyData } from '../model';
import { index } from '../model';

export function toF3Data(data: FamilyData, kana: boolean): f3.Data {
  const idx = index(data);
  return data.persons.map((p) => {
    const parents = p.childOf ? idx.unions.get(p.childOf)!.partners.filter((x): x is string => !!x) : [];
    const unions = idx.unionsOf.get(p.id) ?? [];
    return {
      id: p.id,
      data: {
        // The library only accepts 'M' | 'F'; "other" cannot be represented.
        gender: p.gender === 'F' ? 'F' : 'M',
        'first name': kana ? p.givenNameKana : p.givenName,
        'last name': kana ? p.familyNameKana : p.familyName,
        birthday: p.birth ? `${p.birth.y}年生` : '',
      },
      rels: {
        parents,
        spouses: unions.flatMap((u) => u.partners.filter((x): x is string => !!x && x !== p.id)),
        children: unions.flatMap((u) => (idx.childrenOf.get(u.id) ?? []).map((c) => c.id)),
      },
    };
  });
}

export function renderFamilyChart(host: HTMLElement, data: FamilyData, kana: boolean, mainId: string) {
  host.innerHTML = '';
  const cont = document.createElement('div');
  cont.className = 'f3';
  cont.style.cssText = 'width:100%;height:100%;background:#2b2b2b;color:#fff;';
  host.appendChild(cont);
  const chart = f3
    .createChart(cont, toF3Data(data, kana))
    .setTransitionTime(600)
    .setCardXSpacing(250)
    .setCardYSpacing(150)
    .setShowSiblingsOfMain(true)
    .setSingleParentEmptyCard(true, { label: '不明' });
  chart.setCardHtml().setCardDisplay([['last name', 'first name'], ['birthday']]).setMiniTree(true);
  chart.updateMainId(mainId);
  chart.updateTree({ initial: true });
}
