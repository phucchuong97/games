const CACHE_NAME = "minigames-v1";

const PRECACHE_URLS = [
  "index.html",
  "manifest.json",
  "favicon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-512-maskable.png",
  "games/2048.html",
  "games/asteroids.html",
  "games/battleship.html",
  "games/blackjack.html",
  "games/boggle.html",
  "games/breakout.html",
  "games/caro.html",
  "games/checkers.html",
  "games/connectfour.html",
  "games/dotsandboxes.html",
  "games/flappy.html",
  "games/floodit.html",
  "games/hangman.html",
  "games/lightsout.html",
  "games/mahjong.html",
  "games/mastermind.html",
  "games/match3.html",
  "games/memory.html",
  "games/minesweeper.html",
  "games/nonogram.html",
  "games/oanquan.html",
  "games/pacman.html",
  "games/poker.html",
  "games/pong.html",
  "games/reversi.html",
  "games/simon.html",
  "games/sliding.html",
  "games/snake.html",
  "games/sokoban.html",
  "games/solitaire.html",
  "games/spaceinvaders.html",
  "games/sudoku.html",
  "games/tetris.html",
  "games/tictactoe.html",
  "games/war.html",
  "games/whackamole.html",
  "games/wordle.html",
  "games/yahtzee.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS.map((url) => new URL(url, self.registration.scope))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// stale-while-revalidate for same-origin GET requests
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
