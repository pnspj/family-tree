// Static drawing of the tree (lines + cards), shared by the interactive view,
// the print sheet and image export.
import { useMemo } from 'preact/hooks';
import { isDeceased } from '../core/date';
import { createKinship, type KinshipResolver } from '../core/kinship';
import { rubyBase } from '../core/kinshipMaster';
import type { FamilyFile } from '../core/types';
import { computeLayout, DEFAULT_LAYOUT, type LayoutOptions, type LayoutResult } from '../layout/layout';
import type { ViewPrefs } from '../prefs';
import { birthNameText, fitName, isKana, kinshipText, lifeText, personNameParts, visibleLength, type NameFit } from './display';
import { Ruby } from './Ruby';

export interface TreeModel {
  layout: LayoutResult;
  opt: LayoutOptions;
  kin: KinshipResolver;
  nameFits: Map<string, NameFit>;
  persons: Map<string, FamilyFile['persons'][number]>;
}

/** Kinship resolver for the family, recomputed only when people, unions or wording change. */
export const useKinship = (file: FamilyFile): KinshipResolver =>
  useMemo(() => createKinship(file, file.settings.labelOverrides), [file.persons, file.unions, file.settings.labelOverrides]);

/** Layout and derived data for drawing; card height adapts to the content shown. */
export function useTreeModel(file: FamilyFile, prefs: ViewPrefs): TreeModel {
  const nameFits = useMemo(
    () => new Map(file.persons.map((p) => [p.id, fitName(personNameParts(p, prefs))])),
    [file.persons, prefs.script, prefs.preferNickname],
  );
  const twoLineNames = [...nameFits.values()].some((f) => f.lines.length > 1);
  const birthNames = prefs.showBirthName && file.persons.some((p) => p.birthFamilyName || p.birthFamilyNameKana);
  const opt = useMemo(() => {
    const furigana = prefs.script === 'furigana';
    let cardH = furigana ? 100 : DEFAULT_LAYOUT.cardH;
    if (twoLineNames) cardH += furigana ? 26 : 18; // one more name line
    if (birthNames) cardH += furigana ? 20 : 14; // 旧姓 line
    return { ...DEFAULT_LAYOUT, cardH };
  }, [prefs.script, twoLineNames, birthNames]);
  const layout = useMemo(() => computeLayout(file, opt), [file.persons, file.unions, opt]);
  const kin = useKinship(file);
  const persons = useMemo(() => new Map(file.persons.map((p) => [p.id, p])), [file.persons]);
  return { layout, opt, kin, nameFits, persons };
}

export interface CardHidden {
  name: boolean;
  kinship: boolean;
}

interface ContentProps {
  file: FamilyFile;
  prefs: ViewPrefs;
  model: TreeModel;
  /** Which parts of a card are hidden (quiz / masks). */
  hidden?: (id: string) => CardHidden;
  /** Print worksheets show empty boxes to write in instead of "？". */
  blanks?: boolean;
  /** Extra classes per card (quiz feedback). */
  cardClass?: (id: string) => string;
  onCardClick?: (id: string) => void;
}

const NONE: CardHidden = { name: false, kinship: false };

export function TreeContent({ file, prefs, model, hidden, blanks, cardClass, onCardClick }: ContentProps) {
  const { layout, opt, kin, nameFits, persons } = model;
  const ego = file.settings.egoId;
  const today = new Date();
  return (
    <>
      <g class="lines">
        {layout.descents.map((l, i) => (
          <path key={`d${i}`} d={l.d} />
        ))}
        {layout.marriages.map((l, i) => (
          <path key={`m${i}`} d={l.d} class={l.former ? 'former' : ''} />
        ))}
      </g>
      {/* DOM order = visual order (top row first, left to right), so Tab moves as you read. */}
      {[...layout.cards].sort((a, b) => a.y - b.y || a.x - b.x).map((c) => {
        const p = persons.get(c.id)!;
        const k = ego && prefs.showKinship ? kin.resolve(ego, c.id, { pathFallback: prefs.pathFallback }) : undefined;
        const kinText = kinshipText(k, prefs);
        const h = hidden?.(c.id) ?? NONE;
        const hideName = h.name;
        const hideKin = prefs.showKinship && h.kinship && (!!kinText || !!blanks);
        const fit = nameFits.get(c.id)!;
        const fullName = rubyBase(fit.lines.join(' '));
        const birthName = prefs.showBirthName && !hideName ? birthNameText(p, prefs.script) : '';
        const cls = [
          'card',
          fit.lines.length > 1 ? 'two-line-name' : '',
          prefs.genderColor ? `g-${p.gender ?? 'none'}` : 'g-none',
          isDeceased(p) ? 'deceased' : '',
          c.id === ego ? 'is-ego' : '',
          k?.kind === 'path' ? 'path' : '',
          hideName || hideKin ? 'has-mask' : '',
          blanks ? 'blanks' : '',
          cardClass?.(c.id) ?? '',
        ].join(' ');
        const label = hideName || hideKin ? 'かくれている カード' : undefined;
        const body = (
          <>
            {hideKin ? (
              <span class="kin masked">{blanks ? '' : '？'}</span>
            ) : (
              <span class={visibleLength(kinText) > 9 ? 'kin long' : 'kin'}>
                <Ruby text={kinText} />
              </span>
            )}
            {hideName ? (
              <span class="name masked">{blanks ? '' : '？？？'}</span>
            ) : (
              <span class={`name size-${fit.size}`}>
                {fit.lines.length
                  ? fit.lines.map((line, i) => (
                      <span key={i} class="name-line">
                        <Ruby text={line} />
                      </span>
                    ))
                  : '？'}
              </span>
            )}
            {birthName && (
              <span class="birth-name">
                <Ruby text={birthName} />
              </span>
            )}
            {prefs.showLife && !hideName && <span class="life">{lifeText(p, today, isKana(prefs))}</span>}
          </>
        );
        return (
          <foreignObject key={c.id} x={c.x} y={c.y} width={opt.cardW} height={opt.cardH}>
            {onCardClick ? (
              <button
                type="button"
                class={cls}
                data-person-id={c.id}
                aria-label={label}
                title={hideName ? undefined : fullName}
                onClick={() => onCardClick(c.id)}
              >
                {body}
              </button>
            ) : (
              <div class={cls}>{body}</div>
            )}
          </foreignObject>
        );
      })}
    </>
  );
}
