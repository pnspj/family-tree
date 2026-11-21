// "Hide names / kinship" play in view mode: masked cards are revealed one tap at a time.
// Pure functions shared by the main screen and the about-page demo.
import * as ops from '../core/ops';
import type { FamilyFile, Person } from '../core/types';
import type { ViewPrefs } from '../prefs';
import type { CardHidden } from './TreeDrawing';

/** What is masked; null when masking is off. */
export type Masks = { name: boolean; kinship: boolean } | null;

/** Cards whose masked parts were tapped open. */
export interface Reveal {
  names: ReadonlySet<string>;
  kinship: ReadonlySet<string>;
}

export const NO_REVEAL: Reveal = { names: new Set(), kinship: new Set() };

/** The masks in effect for these preferences (kinship can only be hidden while it is shown). */
export const masksFor = (prefs: Pick<ViewPrefs, 'maskName' | 'maskKinship' | 'showKinship'>): Masks =>
  prefs.maskName || prefs.maskKinship ? { name: prefs.maskName, kinship: prefs.maskKinship && prefs.showKinship } : null;

/** Hidden parts of one card. The viewpoint person (ego) is never masked. */
export function hiddenParts(masks: Masks, reveal: Reveal, egoId: string | undefined, id: string): CardHidden {
  const masked = !!masks && id !== egoId;
  return {
    name: masked && masks.name && !reveal.names.has(id),
    kinship: masked && masks.kinship && !reveal.kinship.has(id),
  };
}

const isHidden = (h: CardHidden) => h.name || h.kinship;

/** How many cards still have something hidden. */
export const countHidden = (persons: Person[], masks: Masks, reveal: Reveal, egoId: string | undefined) =>
  persons.filter((p) => isHidden(hiddenParts(masks, reveal, egoId, p.id))).length;

/** The family on screen together with what has been revealed. */
export interface View {
  file: FamilyFile;
  reveal: Reveal;
}

/**
 * A tap on a card in view mode: the first tap reveals a masked card, the next one makes that
 * person the viewpoint. A new viewpoint changes every kinship label, so they are hidden again.
 */
export function tapCard(view: View, masks: Masks, id: string): View {
  const egoId = view.file.settings.egoId;
  if (isHidden(hiddenParts(masks, view.reveal, egoId, id)))
    return { ...view, reveal: { names: new Set(view.reveal.names).add(id), kinship: new Set(view.reveal.kinship).add(id) } };
  if (id === egoId) return view;
  const r = ops.setEgo(view.file, id);
  return r.ok ? { file: r.file, reveal: { ...view.reveal, kinship: new Set() } } : view;
}
