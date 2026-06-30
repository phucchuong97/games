// renderer.js — builds the board DOM once, then updates it from GameState.

import {
  TOTAL_CELLS, LEFT_QUAN, RIGHT_QUAN, pitToIndex, PLAYER_PITS,
} from './game.js';

const MAX_DOTS = 24; // cap rendered stone icons; the number is always exact

// Which player owns each ring index (for colour cues). 0 = neutral (Quan).
const OWNER_OF = (() => {
  const m = {};
  for (const i of PLAYER_PITS[1]) m[i] = 1;
  for (const i of PLAYER_PITS[2]) m[i] = 2;
  return m;
})();

export class Renderer {
  constructor(boardEl) {
    this.boardEl = boardEl;
    this.cellEls = new Array(TOTAL_CELLS);
    this.build();
  }

  build() {
    this.boardEl.innerHTML = '';

    const layout = [];
    // Quan pits span both rows at the far ends.
    layout.push({ index: LEFT_QUAN, type: 'quan', col: 1, rowSpan: true });
    layout.push({ index: RIGHT_QUAN, type: 'quan', col: 7, rowSpan: true });
    // Bottom row: pits 0..4 (Player 1), left → right.
    [0, 1, 2, 3, 4].forEach((pit, k) =>
      layout.push({ index: pitToIndex(pit), type: 'pit', pit, col: 2 + k, row: 2 }));
    // Top row: pits 9,8,7,6,5 (Player 2), left → right.
    [9, 8, 7, 6, 5].forEach((pit, k) =>
      layout.push({ index: pitToIndex(pit), type: 'pit', pit, col: 2 + k, row: 1 }));

    for (const spec of layout) {
      const el = document.createElement('div');
      el.className = `cell ${spec.type}`;
      if (OWNER_OF[spec.index]) el.classList.add(`owner-${OWNER_OF[spec.index]}`);
      el.dataset.index = spec.index;
      el.style.gridColumn = String(spec.col);
      el.style.gridRow = spec.rowSpan ? '1 / span 2' : String(spec.row);

      const dots = document.createElement('div');
      dots.className = 'dots';

      const count = document.createElement('div');
      count.className = 'count';

      const label = document.createElement('div');
      label.className = 'cell-label';
      label.textContent = spec.type === 'quan' ? 'Quan' : `Pit ${spec.pit}`;

      el.append(label, dots, count);
      this.boardEl.appendChild(el);
      this.cellEls[spec.index] = el;
    }
  }

  /**
   * Update every cell from state.
   * opts: { active, selectable: Set<index>, selected }
   */
  render(state, opts = {}) {
    const selectable = opts.selectable || new Set();
    for (let i = 0; i < TOTAL_CELLS; i++) {
      const cell = state.cells[i];
      const el = this.cellEls[i];
      const dots = el.querySelector('.dots');
      const count = el.querySelector('.count');

      const total = cell.citizens + (cell.isQuan && cell.hasQuan ? 1 : 0);
      count.textContent = cell.isQuan && cell.hasQuan
        ? `${cell.citizens} +Q`
        : String(cell.citizens);

      // rebuild stone icons
      dots.innerHTML = '';
      if (cell.isQuan && cell.hasQuan) {
        const q = document.createElement('span');
        q.className = 'stone quan-stone';
        dots.appendChild(q);
      }
      const shown = Math.min(cell.citizens, MAX_DOTS);
      for (let d = 0; d < shown; d++) {
        const s = document.createElement('span');
        s.className = 'stone';
        dots.appendChild(s);
      }

      el.classList.toggle('active', opts.active === i);
      el.classList.toggle('selectable', selectable.has(i));
      el.classList.toggle('selected', opts.selected === i);
      el.classList.toggle('empty', total === 0);
    }
  }

  centerOf(index) {
    const el = this.cellEls[index];
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
}
