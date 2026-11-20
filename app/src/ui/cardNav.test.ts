import { describe, expect, it } from 'vitest';
import { neighborCard } from './cardNav';

// Row 0:      a(100)        b(400)
// Row 1: c(0)     d(250)        e(500)
// Row 2:              f(300)
const cards = [
  { id: 'a', x: 100, y: 0 },
  { id: 'b', x: 400, y: 0 },
  { id: 'c', x: 0, y: 170 },
  { id: 'd', x: 250, y: 170 },
  { id: 'e', x: 500, y: 170 },
  { id: 'f', x: 300, y: 340 },
];

describe('card keyboard navigation', () => {
  it('moves along the row and stops at the ends', () => {
    expect(neighborCard(cards, 'd', 'ArrowLeft')).toBe('c');
    expect(neighborCard(cards, 'd', 'ArrowRight')).toBe('e');
    expect(neighborCard(cards, 'c', 'ArrowLeft')).toBeUndefined();
    expect(neighborCard(cards, 'e', 'ArrowRight')).toBeUndefined();
  });

  it('jumps to the row ends with Home / End', () => {
    expect(neighborCard(cards, 'd', 'Home')).toBe('c');
    expect(neighborCard(cards, 'd', 'End')).toBe('e');
  });

  it('moves up and down to the horizontally closest card', () => {
    expect(neighborCard(cards, 'd', 'ArrowUp')).toBe('a'); // 150 vs 150 -> tie, left wins
    expect(neighborCard(cards, 'e', 'ArrowUp')).toBe('b');
    expect(neighborCard(cards, 'a', 'ArrowDown')).toBe('c'); // 100 vs 150
    expect(neighborCard(cards, 'f', 'ArrowUp')).toBe('d');
    expect(neighborCard(cards, 'a', 'ArrowUp')).toBeUndefined();
    expect(neighborCard(cards, 'f', 'ArrowDown')).toBeUndefined();
  });

  it('returns undefined for an unknown card', () => {
    expect(neighborCard(cards, 'zzz', 'ArrowLeft')).toBeUndefined();
  });
});
