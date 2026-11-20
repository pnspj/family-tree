import { useEffect, useMemo, useRef } from 'preact/hooks';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { createKinship } from '../core/kinship';
import { isDeceased } from '../core/date';
import type { FamilyFile } from '../core/types';
import { computeLayout, DEFAULT_LAYOUT } from '../layout/layout';
import type { ViewPrefs } from '../storage';
import { fitName, isKana, kinshipText, lifeText, personNameParts, visibleLength } from './display';
import { rubyBase } from '../core/kinshipMaster';
import { Ruby } from './Ruby';

/** What is currently hidden on each card (quiz mode). */
export interface MaskState {
  name: boolean;
  kinship: boolean;
  revealedNames: Set<string>;
  revealedKinship: Set<string>;
}

interface Props {
  file: FamilyFile;
  prefs: ViewPrefs;
  masks: MaskState | null;
  onCardClick: (id: string) => void;
  /** A new object re-fits the view. `whole`: always show everything; otherwise focus the ego when too small. */
  fitRequest: { whole: boolean };
}

const PAD = 40;
const MIN_READABLE_SCALE = 0.55;

export const isNameHidden = (m: MaskState | null, id: string, egoId?: string) => !!m?.name && id !== egoId && !m.revealedNames.has(id);
export const isKinshipHidden = (m: MaskState | null, id: string, egoId?: string) =>
  !!m?.kinship && id !== egoId && !m.revealedKinship.has(id);

export function TreeView({ file, prefs, masks, onCardClick, fitRequest }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const nameFits = useMemo(
    () => new Map(file.persons.map((p) => [p.id, fitName(personNameParts(p, prefs))])),
    [file.persons, prefs.script, prefs.preferNickname],
  );
  const twoLineNames = [...nameFits.values()].some((f) => f.lines.length > 1);
  // Furigana needs taller cards for the reading lines; two-line names need one more line.
  const opt = useMemo(() => {
    const furigana = prefs.script === 'furigana';
    const base = furigana ? 100 : DEFAULT_LAYOUT.cardH;
    return { ...DEFAULT_LAYOUT, cardH: base + (twoLineNames ? (furigana ? 26 : 18) : 0) };
  }, [prefs.script, twoLineNames]);
  const layout = useMemo(() => computeLayout(file, opt), [file.persons, file.unions, opt]);
  const kin = useMemo(() => createKinship(file, file.settings.labelOverrides), [file.persons, file.unions, file.settings.labelOverrides]);
  const persons = useMemo(() => new Map(file.persons.map((p) => [p.id, p])), [file.persons]);
  const ego = file.settings.egoId;
  const today = new Date();

  useEffect(() => {
    const svg = svgRef.current!;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .clickDistance(6)
      .on('zoom', (e) => gRef.current?.setAttribute('transform', e.transform.toString()));
    select(svg).call(z).on('dblclick.zoom', null);
    zoomRef.current = z;
  }, []);

  useEffect(() => {
    const svg = svgRef.current!;
    const z = zoomRef.current;
    if (!z || !layout.width) return;
    const { width, height } = svg.getBoundingClientRect();
    const k = Math.min(width / (layout.width + PAD * 2), height / (layout.height + PAD * 2), 1.2);
    const egoCard = layout.cards.find((c) => c.id === file.settings.egoId);
    let t = zoomIdentity.translate((width - layout.width * k) / 2, (height - layout.height * k) / 2).scale(k);
    if (!fitRequest.whole && k < MIN_READABLE_SCALE && egoCard) {
      // Too small to read (phones): center the ego at a readable scale instead.
      const kk = 0.85;
      t = zoomIdentity.translate(width / 2 - (egoCard.x + opt.cardW / 2) * kk, height / 2 - (egoCard.y + opt.cardH / 2) * kk).scale(kk);
    }
    select(svg).call(z.transform, t);
  }, [fitRequest]);

  return (
    <svg ref={svgRef} class={`tree script-${prefs.script}`} role="img" aria-label="家系図">
      <g ref={gRef}>
        <g class="lines">
          {layout.descents.map((l, i) => (
            <path key={`d${i}`} d={l.d} />
          ))}
          {layout.marriages.map((l, i) => (
            <path key={`m${i}`} d={l.d} class={l.former ? 'former' : ''} />
          ))}
        </g>
        {layout.cards.map((c) => {
          const p = persons.get(c.id)!;
          const k = ego && prefs.showKinship ? kin.resolve(ego, c.id, { pathFallback: prefs.pathFallback }) : undefined;
          const kinText = kinshipText(k, prefs);
          const hideName = isNameHidden(masks, c.id, ego);
          const hideKin = prefs.showKinship && isKinshipHidden(masks, c.id, ego) && !!kinText;
          const fit = nameFits.get(c.id)!;
          const fullName = rubyBase(fit.lines.join(' '));
          const cls = [
            'card',
            fit.lines.length > 1 ? 'two-line-name' : '',
            prefs.genderColor ? `g-${p.gender ?? 'none'}` : 'g-none',
            isDeceased(p) ? 'deceased' : '',
            c.id === ego ? 'is-ego' : '',
            k?.kind === 'path' ? 'path' : '',
            hideName || hideKin ? 'has-mask' : '',
          ].join(' ');
          const label = hideName || hideKin ? 'かくれている カード。おすと みられます' : undefined;
          return (
            <foreignObject key={c.id} x={c.x} y={c.y} width={opt.cardW} height={opt.cardH}>
              <button type="button" class={cls} aria-label={label} title={hideName ? undefined : fullName} onClick={() => onCardClick(c.id)}>
                {hideKin ? (
                  <span class="kin masked">？</span>
                ) : (
                  <span class={visibleLength(kinText) > 9 ? 'kin long' : 'kin'}>
                    <Ruby text={kinText} />
                  </span>
                )}
                {hideName ? (
                  <span class="name masked">？？？</span>
                ) : (
                  <span class={`name size-${fit.size}`}>
                    {fit.lines.length ? (
                      fit.lines.map((line, i) => (
                        <span key={i} class="name-line">
                          <Ruby text={line} />
                        </span>
                      ))
                    ) : (
                      '？'
                    )}
                  </span>
                )}
                {prefs.showLife && !hideName && <span class="life">{lifeText(p, today, isKana(prefs))}</span>}
              </button>
            </foreignObject>
          );
        })}
      </g>
    </svg>
  );
}
