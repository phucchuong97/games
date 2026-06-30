// main.js — entry point: collect DOM references and start the UI controller.

import { UI } from './ui.js';

const $ = (id) => document.getElementById(id);

const refs = {
  board: $('board'),
  status: $('status'),
  history: $('history-list'),
  turnEl: $('turn-player'),
  scoreEls: { 1: $('score-1'), 2: $('score-2') },
  panelEls: { 1: $('panel-1'), 2: $('panel-2') },
  dirCW: $('dir-cw'),
  dirCCW: $('dir-ccw'),
  newGame: $('btn-new'),
  undo: $('btn-undo'),
  toggleAnim: $('btn-anim'),
  help: $('btn-help'),
  helpModal: $('help-modal'),
  helpClose: $('help-close'),
  overlay: $('overlay'),
  overlayTitle: $('overlay-title'),
  overlayDetail: $('overlay-detail'),
  overlayClose: $('overlay-close'),
};

// eslint-disable-next-line no-new
new UI(refs);
