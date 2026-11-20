// Spatial keyboard navigation between cards (arrow keys / Home / End).

export type NavKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End';
export const NAV_KEYS: readonly string[] = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

interface CardPos {
  id: string;
  x: number;
  y: number;
}

/**
 * The card to move to from `id`:
 * ←/→ previous/next card in the same row, Home/End first/last card of the row,
 * ↑/↓ the card in the row above/below whose center is closest horizontally
 * (the left one on a tie). Undefined at the edges.
 */
export function neighborCard(cards: CardPos[], id: string, key: NavKey): string | undefined {
  const rowsY = [...new Set(cards.map((c) => c.y))].sort((a, b) => a - b);
  const row = (y: number) => cards.filter((c) => c.y === y).sort((a, b) => a.x - b.x);
  const cur = cards.find((c) => c.id === id);
  if (!cur) return undefined;
  const same = row(cur.y);
  const i = same.findIndex((c) => c.id === id);
  switch (key) {
    case 'ArrowLeft':
      return same[i - 1]?.id;
    case 'ArrowRight':
      return same[i + 1]?.id;
    case 'Home':
      return same[0].id;
    case 'End':
      return same[same.length - 1].id;
    default: {
      const r = rowsY.indexOf(cur.y) + (key === 'ArrowUp' ? -1 : 1);
      if (r < 0 || r >= rowsY.length) return undefined;
      // All cards share one width, so comparing left edges compares centers.
      let best: CardPos | undefined;
      for (const c of row(rowsY[r])) if (!best || Math.abs(c.x - cur.x) < Math.abs(best.x - cur.x)) best = c;
      return best?.id;
    }
  }
}
