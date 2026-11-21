import { describe, expect, it } from 'vitest';
import { demoFile } from '../core/sample';
import { DEFAULT_PREFS } from '../prefs';
import { countHidden, hiddenParts, masksFor, NO_REVEAL, tapCard, type View } from './masks';

const both = { name: true, kinship: true };
const start = (): View => ({ file: demoFile(), reveal: NO_REVEAL });

describe('masksFor', () => {
  it('is off unless something is masked', () => {
    expect(masksFor(DEFAULT_PREFS)).toBeNull();
    expect(masksFor({ ...DEFAULT_PREFS, maskName: true })).toEqual({ name: true, kinship: false });
  });
  it('cannot hide kinship labels that are not shown', () => {
    expect(masksFor({ ...DEFAULT_PREFS, maskKinship: true, showKinship: false })).toEqual({ name: false, kinship: false });
  });
});

describe('hiddenParts / countHidden', () => {
  it('never masks the ego and nothing when off', () => {
    expect(hiddenParts(both, NO_REVEAL, 'ren', 'ren')).toEqual({ name: false, kinship: false });
    expect(hiddenParts(null, NO_REVEAL, 'ren', 'sho')).toEqual({ name: false, kinship: false });
    expect(hiddenParts(both, NO_REVEAL, 'ren', 'sho')).toEqual({ name: true, kinship: true });
  });
  it('counts every card but the ego', () => {
    const { file } = start();
    expect(countHidden(file.persons, both, NO_REVEAL, 'ren')).toBe(file.persons.length - 1);
    expect(countHidden(file.persons, null, NO_REVEAL, 'ren')).toBe(0);
  });
});

describe('tapCard', () => {
  it('switches the viewpoint when nothing is masked', () => {
    const v = tapCard(start(), null, 'makoto');
    expect(v.file.settings.egoId).toBe('makoto');
  });
  it('first reveals a masked card, then switches the viewpoint and re-hides kinship only', () => {
    const v1 = tapCard(start(), both, 'makoto');
    expect(v1.file.settings.egoId).toBe('ren');
    expect(hiddenParts(both, v1.reveal, 'ren', 'makoto')).toEqual({ name: false, kinship: false });
    const v2 = tapCard(v1, both, 'makoto');
    expect(v2.file.settings.egoId).toBe('makoto');
    expect(v2.reveal.names.has('makoto')).toBe(true);
    expect(v2.reveal.kinship.size).toBe(0);
  });
  it('ignores a tap on the ego and does not mutate the input', () => {
    const v = start();
    expect(tapCard(v, null, 'ren')).toBe(v);
    tapCard(v, both, 'sho');
    expect(v.reveal.names.size).toBe(0);
  });
});
