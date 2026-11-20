// Interactive (pan / zoom / tap) tree view.
import { useEffect, useRef } from 'preact/hooks';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import type { FamilyFile } from '../core/types';
import type { ViewPrefs } from '../storage';
import { TreeContent, useTreeModel, type CardHidden } from './TreeDrawing';

/** What is currently hidden on each card (mask mode). */
export interface MaskState {
  name: boolean;
  kinship: boolean;
  revealedNames: Set<string>;
  revealedKinship: Set<string>;
}

interface Props {
  file: FamilyFile;
  prefs: ViewPrefs;
  hidden?: (id: string) => CardHidden;
  cardClass?: (id: string) => string;
  onCardClick: (id: string) => void;
  /** A new object re-fits the view. `whole`: always show everything; otherwise focus the ego when too small. */
  fitRequest: { whole: boolean };
}

const PAD = 40;
const MIN_READABLE_SCALE = 0.55;

export const isNameHidden = (m: MaskState | null, id: string, egoId?: string) => !!m?.name && id !== egoId && !m.revealedNames.has(id);
export const isKinshipHidden = (m: MaskState | null, id: string, egoId?: string) =>
  !!m?.kinship && id !== egoId && !m.revealedKinship.has(id);

export function TreeView({ file, prefs, hidden, cardClass, onCardClick, fitRequest }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const model = useTreeModel(file, prefs);
  const { layout, opt } = model;

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
        <TreeContent file={file} prefs={prefs} model={model} hidden={hidden} cardClass={cardClass} onCardClick={onCardClick} />
      </g>
    </svg>
  );
}
