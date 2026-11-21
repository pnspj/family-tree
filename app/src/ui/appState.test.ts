import { describe, expect, it } from 'vitest';
import * as ops from '../core/ops';
import { sampleFile } from '../core/sample';
import { appReducer, initialState, type Action, type AppState } from './appState';
import { NO_REVEAL } from './masks';

const run = (s: AppState, ...actions: Action[]) => actions.reduce(appReducer, s);
const withSample = () => run(initialState, { type: 'loaded', file: sampleFile() });

describe('appReducer', () => {
  it('creates the first person as a new family and focuses its card', () => {
    const s = run(
      initialState,
      { type: 'loaded', file: null },
      { type: 'openDialog', dialog: { kind: 'add', relation: 'first' } },
      { type: 'save', fields: { familyName: '山田' } },
    );
    const p = s.file!.persons[0];
    expect(s.file!.settings.egoId).toBe(p.id);
    expect(s.dialog).toBeNull();
    expect(s.focus).toEqual({ id: p.id });
  });

  it('adds a relative from the dialog and focuses the new card', () => {
    const s = run(withSample(), { type: 'openDialog', dialog: { kind: 'add', relation: 'child', baseId: 'ren' } }, { type: 'save', fields: { givenName: 'テスト' } });
    const added = s.file!.persons.at(-1)!;
    expect(added.givenName).toBe('テスト');
    expect(s.focus).toEqual({ id: added.id });
    expect(s.dialog).toBeNull();
  });

  it('cancelling the dialog returns focus to the card it was opened from', () => {
    const s = run(withSample(), { type: 'openDialog', dialog: { kind: 'add', relation: 'parent', baseId: 'sho' } }, { type: 'closeDialog' });
    expect(s.focus).toEqual({ id: 'sho' });
    expect(s.dialog).toBeNull();
  });

  it('turns a failed operation into the notice and keeps the file', () => {
    const s0 = withSample();
    const s = run(s0, { type: 'edit', run: (f) => ops.setEgo(f, 'nobody'), close: true });
    expect(s.file).toBe(s0.file);
    expect(s.notice).toBe('人物が見つかりません');
  });

  it('deleting focuses the viewpoint person and shows no notice', () => {
    const s = run(withSample(), { type: 'openDialog', dialog: { kind: 'edit', id: 'aoi' } }, { type: 'edit', run: (f) => ops.deletePerson(f, 'aoi'), close: true });
    expect(s.file!.persons.some((p) => p.id === 'aoi')).toBe(false);
    expect(s.focus).toEqual({ id: 'ren' });
    expect(s.notice).toBe('');
  });

  it('replacing the family resets dialog, reveals and the view', () => {
    const s = run(withSample(), { type: 'tapCard', id: 'sho', masks: { name: true, kinship: true } }, { type: 'fitAll' }, { type: 'replace', file: sampleFile() });
    expect(s.reveal).toBe(NO_REVEAL);
    expect(s.fit).toEqual({ whole: false });
  });
});
