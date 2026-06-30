// game.js — GameState + RuleEngine for Ô Ăn Quan.
// The board is modelled as a 12-cell ring so distribution is just stepping
// around the ring. Cell indices:
//
//   0  = Left Quan        6  = Right Quan
//   1..5  = citizen pits 0..4   (Player 1)
//   7..11 = citizen pits 5..9   (Player 2)
//
// Clockwise ring order: LeftQuan, 0,1,2,3,4, RightQuan, 5,6,7,8,9, (loop).

export const TOTAL_CELLS = 12;
export const LEFT_QUAN = 0;
export const RIGHT_QUAN = 6;
export const QUAN_VALUE = 10;
export const CITIZEN_START = 5;

// Map a citizen pit number (0..9) to its ring index.
export function pitToIndex(pit) {
  return pit < 5 ? pit + 1 : pit + 2;
}

// Citizen pits owned by each player, as ring indices.
export const PLAYER_PITS = {
  1: [1, 2, 3, 4, 5],   // pits 0..4
  2: [7, 8, 9, 10, 11], // pits 5..9
};

export const QUAN_INDICES = [LEFT_QUAN, RIGHT_QUAN];

export const DIRECTION = { CW: 1, CCW: -1 };

// Step one cell around the ring. dir = +1 clockwise, -1 counter-clockwise.
export function step(index, dir) {
  return (index + dir + TOTAL_CELLS) % TOTAL_CELLS;
}

function createInitialCells() {
  const cells = [];
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (i === LEFT_QUAN || i === RIGHT_QUAN) {
      cells.push({ isQuan: true, citizens: 0, hasQuan: true });
    } else {
      cells.push({ isQuan: false, citizens: CITIZEN_START, hasQuan: false });
    }
  }
  return cells;
}

const hasContent = (c) => c.citizens > 0 || (c.isQuan && c.hasQuan);
const isEmpty = (c) => !hasContent(c);

/** Holds all mutable game data and basic queries. */
export class GameState {
  constructor() {
    this.reset();
  }

  reset() {
    this.cells = createInitialCells();
    this.scores = { 1: 0, 2: 0 };
    this.currentPlayer = 1;
    this.finished = false;
    this.winner = null; // 1, 2, or 'draw'
  }

  clone() {
    const s = Object.create(GameState.prototype);
    s.cells = this.cells.map((c) => ({ ...c }));
    s.scores = { ...this.scores };
    s.currentPlayer = this.currentPlayer;
    s.finished = this.finished;
    s.winner = this.winner;
    return s;
  }

  opponent(player = this.currentPlayer) {
    return player === 1 ? 2 : 1;
  }

  /** True when none of a player's five citizen pits hold a stone. */
  sideIsEmpty(player) {
    return PLAYER_PITS[player].every((i) => this.cells[i].citizens === 0);
  }

  bothQuansCaptured() {
    return !this.cells[LEFT_QUAN].hasQuan && !this.cells[RIGHT_QUAN].hasQuan;
  }

  /** Final score = captured points + citizen stones left on own side. */
  finalScores() {
    const f = { 1: this.scores[1], 2: this.scores[2] };
    for (const p of [1, 2]) {
      for (const i of PLAYER_PITS[p]) f[p] += this.cells[i].citizens;
    }
    return f;
  }
}

/**
 * RuleEngine computes a move as an ordered list of atomic events so the
 * Animator can replay them with delays. It never mutates the passed state.
 *
 * Event types:
 *   { type: 'pickup',  index, count }  – scoop a pit empty into the hand
 *   { type: 'drop',    index }         – drop one stone into a pit
 *   { type: 'capture', index, points } – capture a pit's contents
 */
export const RuleEngine = {
  /** Distribute starting from the selected citizen pit. */
  play(state, startIndex, dir) {
    const cells = state.cells.map((c) => ({ ...c })); // work copy for decisions
    const events = [];
    let captured = 0;

    let pos = startIndex;
    let hand = cells[pos].citizens;
    cells[pos].citizens = 0;
    events.push({ type: 'pickup', index: pos, count: hand });

    let guard = 0;
    while (guard++ < 100000) {
      // 1. sow the stones in hand, one per following cell
      let idx = pos;
      while (hand > 0) {
        idx = step(idx, dir);
        cells[idx].citizens += 1;
        hand -= 1;
        events.push({ type: 'drop', index: idx });
      }

      const next1 = step(idx, dir);
      const c1 = cells[next1];

      // 2. Case 1 — next cell has stones: scoop it and keep sowing
      //    (but a Quan pit can never be scooped, so the turn ends there).
      if (hasContent(c1)) {
        if (c1.isQuan) break;
        hand = c1.citizens;
        cells[next1].citizens = 0;
        pos = next1;
        events.push({ type: 'pickup', index: next1, count: hand });
        continue;
      }

      // 3. next cell empty — try capturing across the gap (Case 2),
      //    repeating while the empty/full pattern continues.
      let gap = next1;
      let cap = step(gap, dir);
      while (isEmpty(cells[gap]) && hasContent(cells[cap])) {
        const cell = cells[cap];
        const pts = cell.citizens + (cell.isQuan && cell.hasQuan ? QUAN_VALUE : 0);
        cell.citizens = 0;
        if (cell.isQuan) cell.hasQuan = false;
        captured += pts;
        events.push({ type: 'capture', index: cap, points: pts });
        gap = step(cap, dir);
        cap = step(gap, dir);
      }
      break; // Case 2 (after captures) or Case 3 (empty/empty) end the turn
    }

    return { events, captured };
  },

  /**
   * Redistribution events when a player's side is empty: one stone back into
   * each of their five pits. Caller is responsible for the −5 score cost and
   * for checking the player can afford it.
   */
  redistributeEvents(player) {
    return PLAYER_PITS[player].map((index) => ({ type: 'drop', index }));
  },
};
