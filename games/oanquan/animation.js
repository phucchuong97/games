// animation.js — replays RuleEngine events onto the live state with delays,
// re-rendering after each step. Also handles the "captured stones fly to the
// score panel" effect.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Animator {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.stepDelay = 200; // ms between stone placements (spec: 150–250ms)
  }

  setEnabled(on) { this.enabled = on; }

  /**
   * Apply a single event to the live state.
   * Returns the points scored if it was a capture, else 0.
   */
  applyEvent(state, ev) {
    const cell = state.cells[ev.index];
    if (ev.type === 'pickup') {
      cell.citizens = 0;
    } else if (ev.type === 'drop') {
      cell.citizens += 1;
    } else if (ev.type === 'capture') {
      cell.citizens = 0;
      if (cell.isQuan) cell.hasQuan = false;
      state.scores[state.currentPlayer] += ev.points;
      return ev.points;
    }
    return 0;
  }

  /**
   * Play events in order. hooks:
   *   onCapture(ev) – called when a capture lands (for fly effect / panel)
   *   onTick()      – called after each applied event (e.g. refresh panels)
   */
  async playEvents(state, events, hooks = {}) {
    for (const ev of events) {
      const pts = this.applyEvent(state, ev);
      this.renderer.render(state, { active: ev.index });
      if (ev.type === 'capture' && hooks.onCapture) hooks.onCapture(ev);
      if (hooks.onTick) hooks.onTick();
      if (this.enabled) await sleep(this.stepDelay);
    }
    this.renderer.render(state, {});
  }

  /** Fly a "+points" badge from a pit to a target element (score panel). */
  flyCapture(fromIndex, points, targetEl) {
    if (!this.enabled || !targetEl) return;
    const from = this.renderer.centerOf(fromIndex);
    const tr = targetEl.getBoundingClientRect();
    const to = { x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };

    const badge = document.createElement('div');
    badge.className = 'fly-capture';
    badge.textContent = `+${points}`;
    badge.style.left = `${from.x}px`;
    badge.style.top = `${from.y}px`;
    document.body.appendChild(badge);

    requestAnimationFrame(() => {
      badge.style.transform =
        `translate(${to.x - from.x}px, ${to.y - from.y}px) scale(0.6)`;
      badge.style.opacity = '0';
    });
    badge.addEventListener('transitionend', () => badge.remove(), { once: true });
    setTimeout(() => badge.remove(), 900); // safety cleanup
  }
}
