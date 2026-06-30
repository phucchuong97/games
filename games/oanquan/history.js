// history.js — MoveHistory keeps a log of actions and renders the latest ones.

const DIRECTION_LABEL = { 1: 'Clockwise', '-1': 'Counter-clockwise' };

export class MoveHistory {
  constructor(listEl, max = 15) {
    this.listEl = listEl;
    this.max = max;
    this.items = [];
  }

  clear() {
    this.items = [];
    this.render();
  }

  /** Record a sowing move. pit is the 0..9 pit number. */
  addMove({ player, pit, dir, captured }) {
    const lines = [
      `Player ${player}`,
      `Selected pit ${pit}`,
      `Direction: ${DIRECTION_LABEL[dir]}`,
      captured > 0 ? `Captured ${captured} point${captured === 1 ? '' : 's'}` : 'No capture',
    ];
    this.items.push({ kind: 'move', lines });
    this.render();
  }

  addRedistribute(player) {
    this.items.push({
      kind: 'note',
      lines: [`Player ${player}`, 'Side empty — redistributed 5 stones (−5 points)'],
    });
    this.render();
  }

  addNote(text) {
    this.items.push({ kind: 'note', lines: [text] });
    this.render();
  }

  // snapshot/restore support single-step Undo.
  snapshot() {
    return this.items.map((it) => ({ kind: it.kind, lines: it.lines.slice() }));
  }

  restore(items) {
    this.items = items.map((it) => ({ kind: it.kind, lines: it.lines.slice() }));
    this.render();
  }

  render() {
    this.listEl.innerHTML = '';
    const recent = this.items.slice(-this.max).reverse();
    if (recent.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'No moves yet.';
      this.listEl.appendChild(empty);
      return;
    }
    for (const item of recent) {
      const entry = document.createElement('div');
      entry.className = `history-entry ${item.kind}`;
      for (const line of item.lines) {
        const p = document.createElement('div');
        p.textContent = line;
        entry.appendChild(p);
      }
      this.listEl.appendChild(entry);
    }
  }
}
