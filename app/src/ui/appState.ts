// State of the open family as a pure reducer: the file, the person dialog, revealed (masked)
// cards, one-shot requests to the tree view and the toast message.
import * as ops from '../core/ops';
import type { FamilyFile } from '../core/types';
import { NO_REVEAL, tapCard, type Masks, type Reveal } from './masks';
import type { DialogState } from './PersonDialog';

export interface AppState {
  /** undefined while loading; null when nothing has been stored yet. */
  file: FamilyFile | null | undefined;
  dialog: DialogState | null;
  reveal: Reveal;
  /** Requests to the tree view: each new object moves focus to a card / re-fits the view once. */
  focus: { id: string } | null;
  fit: { whole: boolean };
  /** Short message shown as a toast ('' = none). */
  notice: string;
}

export type Action =
  | { type: 'loaded'; file: FamilyFile | null }
  /** Swap in another family (sample, import, start over). */
  | { type: 'replace'; file: FamilyFile }
  /**
   * Run an editing operation on the current file. Errors become the notice. With `close`, a
   * success closes the person dialog and focuses the affected card (or the viewpoint person).
   */
  | { type: 'edit'; run: (f: FamilyFile) => ops.OpResult; close?: boolean; notice?: string }
  /** Save the person dialog's form: create / update the person it was opened for. */
  | { type: 'save'; fields: ops.PersonFields; fillUnionId?: string }
  | { type: 'openDialog'; dialog: DialogState }
  /** Cancel the person dialog; focus returns to the card it was opened from. */
  | { type: 'closeDialog' }
  | { type: 'tapCard'; id: string; masks: Masks }
  | { type: 'remask' }
  | { type: 'fitAll' }
  | { type: 'notify'; text: string };

export const initialState: AppState = { file: undefined, dialog: null, reveal: NO_REVEAL, focus: null, fit: { whole: false }, notice: '' };

const focusOn = (id: string | undefined) => (id ? { id } : null);

/** The operation that saving the dialog performs. */
export function saveOp(file: FamilyFile, dialog: DialogState, fields: ops.PersonFields, fillUnionId?: string): ops.OpResult {
  if (dialog.kind === 'edit') return ops.updatePerson(file, dialog.id, fields);
  if (dialog.relation === 'first') return ops.createFirstPerson(file, fields);
  const base = dialog.baseId!;
  switch (dialog.relation) {
    case 'parent':
      return ops.addParent(file, base, fields);
    case 'spouse':
      return ops.addSpouse(file, base, fields, 'current', fillUnionId);
    case 'child':
      return ops.addChild(file, base, fields, dialog.unionId);
    case 'sibling':
      return ops.addSibling(file, base, fields);
  }
}

export function appReducer(s: AppState, a: Action): AppState {
  const file = s.file ?? ops.emptyFile();
  switch (a.type) {
    case 'loaded':
      return { ...s, file: a.file };
    case 'replace':
      return { ...s, file: a.file, dialog: null, reveal: NO_REVEAL, fit: { whole: false } };
    case 'edit': {
      const r = a.run(file);
      if (!r.ok) return { ...s, notice: r.error };
      const done = { ...s, file: r.file, notice: a.notice ?? s.notice };
      return a.close ? { ...done, dialog: null, focus: focusOn(r.personId ?? r.file.settings.egoId) } : done;
    }
    case 'save': {
      if (!s.dialog) return s;
      const r = saveOp(file, s.dialog, a.fields, a.fillUnionId);
      if (!r.ok) return { ...s, notice: r.error };
      // The first person starts a new family; otherwise the new / edited person's card gets focus,
      // ready for Enter -> add the next one.
      const next = s.dialog.kind === 'add' && s.dialog.relation === 'first' ? appReducer(s, { type: 'replace', file: r.file }) : { ...s, file: r.file, dialog: null };
      return { ...next, focus: focusOn(r.personId) };
    }
    case 'openDialog':
      return { ...s, dialog: a.dialog };
    case 'closeDialog':
      return s.dialog ? { ...s, dialog: null, focus: focusOn(s.dialog.kind === 'edit' ? s.dialog.id : s.dialog.baseId) ?? s.focus } : s;
    case 'tapCard': {
      if (!s.file) return s;
      const view = tapCard({ file: s.file, reveal: s.reveal }, a.masks, a.id);
      return { ...s, ...view };
    }
    case 'remask':
      return { ...s, reveal: NO_REVEAL };
    case 'fitAll':
      return { ...s, fit: { whole: true } };
    case 'notify':
      return { ...s, notice: a.text };
  }
}
