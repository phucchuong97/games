// ui.js — wires the DOM, handles input, and orchestrates the turn flow.

import {
  GameState, RuleEngine, PLAYER_PITS, DIRECTION,
} from './game.js';
import { Renderer } from './renderer.js';
import { Animator } from './animation.js';
import { MoveHistory } from './history.js';

// ring index -> pit number (0..9) for display
function indexToPit(index) {
  return index < 6 ? index - 1 : index - 2;
}

export class UI {
  constructor(refs) {
    this.refs = refs;
    this.state = new GameState();
    this.renderer = new Renderer(refs.board);
    this.animator = new Animator(this.renderer);
    this.history = new MoveHistory(refs.history, 15);

    this.selectedIndex = null;
    this.direction = null;
    this.busy = false;     // true while a move animates
    this.undoSnapshot = null;

    this.bindEvents();
    this.newGame();
  }

  bindEvents() {
    const r = this.refs;
    // pit clicks (event delegation)
    r.board.addEventListener('click', (e) => {
      const cell = e.target.closest('.cell');
      if (!cell || !cell.dataset.index) return;
      this.onCellClick(Number(cell.dataset.index));
    });
    r.dirCW.addEventListener('click', () => this.chooseDirection(DIRECTION.CW));
    r.dirCCW.addEventListener('click', () => this.chooseDirection(DIRECTION.CCW));
    r.newGame.addEventListener('click', () => this.newGame());
    r.undo.addEventListener('click', () => this.undo());
    r.toggleAnim.addEventListener('click', () => this.toggleAnimation());
    r.help.addEventListener('click', () => this.showHelp(true));
    r.helpClose.addEventListener('click', () => this.showHelp(false));
    r.overlayClose.addEventListener('click', () => this.refs.overlay.classList.remove('show'));
  }

  newGame() {
    this.state.reset();
    this.history.clear();
    this.selectedIndex = null;
    this.direction = null;
    this.busy = false;
    this.undoSnapshot = null;
    this.refs.overlay.classList.remove('show');
    this.renderBoard();
    this.updatePanels();
    this.updateButtons();
    this.startTurn();
  }

  // ---- turn flow -------------------------------------------------------

  /** Called at the start of every turn: handles end conditions + redistribution. */
  startTurn() {
    if (this.state.finished) return;

    if (this.state.bothQuansCaptured()) {
      this.endGame({ reason: 'quans' });
      return;
    }

    const player = this.state.currentPlayer;
    if (this.state.sideIsEmpty(player)) {
      if (this.state.scores[player] >= 5) {
        this.redistribute(player);
      } else {
        // Cannot afford to redistribute → opponent wins outright.
        this.endGame({ reason: 'no-redistribute', loser: player });
        return;
      }
    }
    this.setStatus(`Player ${player}, select one of your pits.`);
    this.refreshSelectable();
    this.updateButtons();
  }

  async redistribute(player) {
    this.busy = true;
    this.updateButtons();
    this.state.scores[player] -= 5;
    this.history.addRedistribute(player);
    this.updatePanels();
    await this.animator.playEvents(
      this.state,
      RuleEngine.redistributeEvents(player),
      { onTick: () => this.updatePanels() },
    );
    this.busy = false;
    this.refreshSelectable();
    this.updateButtons();
  }

  onCellClick(index) {
    if (this.busy || this.state.finished) return;
    const player = this.state.currentPlayer;
    // Only the current player's non-empty citizen pits are selectable.
    if (!PLAYER_PITS[player].includes(index)) return;
    if (this.state.cells[index].citizens === 0) return;

    this.selectedIndex = index;
    this.direction = null;
    this.setStatus(`Pit ${indexToPit(index)} selected — choose a direction.`);
    this.renderBoard();
    this.updateButtons();
  }

  chooseDirection(dir) {
    if (this.busy || this.selectedIndex === null) return;
    this.runMove(this.selectedIndex, dir);
  }

  async runMove(index, dir) {
    // snapshot for single-step undo (captures everything before the move)
    this.undoSnapshot = {
      state: this.state.clone(),
      history: this.history.snapshot(),
    };

    const player = this.state.currentPlayer;
    const pit = indexToPit(index);
    const { events, captured } = RuleEngine.play(this.state, index, dir);
    this.history.addMove({ player, pit, dir, captured });

    this.busy = true;
    this.selectedIndex = null;
    this.setStatus(`Player ${player} sowing…`);
    this.renderBoard();
    this.updateButtons();

    await this.animator.playEvents(this.state, events, {
      onCapture: (ev) => {
        this.animator.flyCapture(ev.index, ev.points, this.refs.scoreEls[player]);
        this.updatePanels();
      },
      onTick: () => this.updatePanels(),
    });

    this.busy = false;
    this.updatePanels();

    // hand over to the other player
    this.state.currentPlayer = this.state.opponent(player);
    this.updatePanels();
    this.startTurn();
  }

  endGame({ reason, loser }) {
    this.state.finished = true;
    const fs = this.state.finalScores();

    let title, detail, winner;
    if (reason === 'no-redistribute') {
      winner = loser === 1 ? 2 : 1;
      title = `Player ${winner} wins!`;
      detail = `Player ${loser} has no stones and cannot redistribute.`;
    } else {
      if (fs[1] > fs[2]) winner = 1;
      else if (fs[2] > fs[1]) winner = 2;
      else winner = 'draw';
      title = winner === 'draw' ? "It's a draw!" : `Player ${winner} wins!`;
      detail = 'Both Quan stones have been captured.';
    }
    this.state.winner = winner;

    this.history.addNote(title);
    this.updatePanels(fs);
    this.refs.overlayTitle.textContent = title;
    this.refs.overlayDetail.innerHTML =
      `${detail}<br>Final — Player 1: <b>${fs[1]}</b> · Player 2: <b>${fs[2]}</b>`;
    this.refs.overlay.classList.add('show');
    this.setStatus(title);
    this.renderBoard();
    this.updateButtons();
  }

  // ---- undo / options --------------------------------------------------

  undo() {
    if (this.busy || !this.undoSnapshot) return;
    this.state = this.undoSnapshot.state;
    this.history.restore(this.undoSnapshot.history);
    this.undoSnapshot = null;
    this.selectedIndex = null;
    this.state.finished = false;
    this.refs.overlay.classList.remove('show');
    this.renderBoard();
    this.updatePanels();
    this.startTurn();
  }

  toggleAnimation() {
    this.animator.setEnabled(!this.animator.enabled);
    this.refs.toggleAnim.textContent =
      `Animation: ${this.animator.enabled ? 'On' : 'Off'}`;
  }

  showHelp(show) {
    this.refs.helpModal.classList.toggle('show', show);
  }

  // ---- rendering helpers ----------------------------------------------

  refreshSelectable() {
    if (this.busy || this.state.finished) { this.renderBoard(); return; }
    const player = this.state.currentPlayer;
    const selectable = new Set(
      PLAYER_PITS[player].filter((i) => this.state.cells[i].citizens > 0),
    );
    this.renderer.render(this.state, { selectable, selected: this.selectedIndex });
  }

  renderBoard() {
    this.refreshSelectable();
  }

  updatePanels(finalScores = null) {
    const s = finalScores || this.state.scores;
    this.refs.scoreEls[1].textContent = s[1];
    this.refs.scoreEls[2].textContent = s[2];
    const cur = this.state.currentPlayer;
    this.refs.turnEl.textContent = this.state.finished ? '—' : `Player ${cur}`;
    this.refs.panelEls[1].classList.toggle('current', !this.state.finished && cur === 1);
    this.refs.panelEls[2].classList.toggle('current', !this.state.finished && cur === 2);
  }

  updateButtons() {
    const canPickDir = !this.busy && this.selectedIndex !== null && !this.state.finished;
    this.refs.dirCW.disabled = !canPickDir;
    this.refs.dirCCW.disabled = !canPickDir;
    this.refs.undo.disabled = this.busy || !this.undoSnapshot;
  }

  setStatus(text) {
    this.refs.status.textContent = text;
  }
}
