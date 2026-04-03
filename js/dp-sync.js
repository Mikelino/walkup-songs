/**
 * dp-sync.js — Diamond Pulse Surface Panel Sync
 * Utilise Trystero (BitTorrent DHT) — zéro serveur, zéro installation
 *
 * INTÉGRATION dans index.html avant </body> :
 *   <script type="module" src="js/dp-sync.js"></script>
 *
 * NOTE : type="module" est requis pour l'import Trystero
 */

import { joinRoom } from 'https://cdn.jsdelivr.net/npm/trystero@0.21.0/torrent';

// ─── Config ────────────────────────────────────────────────────────────────

const APP_ID = 'diamond-pulse-sync-v1'; // identifiant unique de l'app

// ─── Génère un code session à 4 chiffres ──────────────────────────────────

function genCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ─── Badge UI — coin inférieur gauche ─────────────────────────────────────

function createBadge(code) {
  const badge = document.createElement('div');
  badge.id = 'dp-sync-badge';
  Object.assign(badge.style, {
    position: 'fixed', bottom: '14px', left: '14px', zIndex: '99999',
    background: '#0d0d14', color: 'rgba(255,255,255,0.55)',
    border: '0.5px solid rgba(255,255,255,0.15)', borderRadius: '10px',
    padding: '8px 14px', fontFamily: 'monospace', fontSize: '12px',
    userSelect: 'none', display: 'flex', alignItems: 'center', gap: '8px',
  });

  const dot = document.createElement('span');
  dot.id = 'dp-sync-dot';
  dot.textContent = '◉';
  dot.style.color = '#888780';

  const lbl = document.createElement('span');
  lbl.id = 'dp-sync-label';
  lbl.textContent = 'SYNC · ' + code;

  badge.appendChild(dot);
  badge.appendChild(lbl);
  document.body.appendChild(badge);
  return { dot, lbl };
}

function setBadge(dot, lbl, state, code) {
  const states = {
    waiting:   { color: '#888780', text: 'SYNC · ' + code },
    connected: { color: '#1D9E75', text: 'Surface · connectée' },
    error:     { color: '#E24B4A', text: 'SYNC · erreur' },
  };
  const s = states[state] || states.waiting;
  dot.style.color = s.color;
  lbl.textContent = s.text;
}

// ─── Lecture de l'état courant de Diamond Pulse ───────────────────────────

function getState() {
  return {
    mode:    detectMode(),
    score:   { home: readInt('.score-home, [data-score-home]'), away: readInt('.score-away, [data-score-away]') },
    inning:  { number: readInt('[data-inning], .inning-number'), half: readHalf() },
    count:   { balls: readInt('[data-balls]'), strikes: readInt('[data-strikes]'), outs: readInt('[data-outs]') },
    atBat:   readText('[data-at-bat], .at-bat-name, #at-bat-name'),
    onDeck:  readText('[data-on-deck], .on-deck-name, #on-deck-name'),
  };
}

function detectMode() {
  const el = document.querySelector('.tab-active, [aria-selected="true"], .mode-btn.active, .nav-link.active');
  if (!el) return 'live';
  const t = el.textContent.toLowerCase();
  if (t.includes('lineup'))    return 'lineup';
  if (t.includes('social'))    return 'social';
  if (t.includes('broadcast')) return 'broadcast';
  return 'live';
}

function readInt(sel) { const e = document.querySelector(sel); return e ? (parseInt(e.textContent) || 0) : 0; }
function readText(sel) { const e = document.querySelector(sel); return e ? e.textContent.trim() : ''; }
function readHalf() {
  const e = document.querySelector('[data-inning-half], .inning-half');
  return e && e.textContent.includes('▼') ? 'bottom' : 'top';
}

// ─── Exécution des commandes reçues depuis la Surface ─────────────────────

function handleCommand(cmd) {
  console.log('[dp-sync] commande:', cmd.action);
  ({
    set_mode:       () => activateMode(cmd.mode),
    batter_next:    () => tap('[data-batter-next], .batter-next'),
    batter_prev:    () => tap('[data-batter-prev], .batter-prev'),
    score_home_inc: () => tap('button[data-team="home"][data-action="inc"], [data-score-home-inc]'),
    score_home_dec: () => tap('button[data-team="home"][data-action="dec"], [data-score-home-dec]'),
    score_away_inc: () => tap('button[data-team="away"][data-action="inc"], [data-score-away-inc]'),
    score_away_dec: () => tap('button[data-team="away"][data-action="dec"], [data-score-away-dec]'),
    count_reset:    () => tap('[data-count-reset], .reset-count'),
    inning_next:    () => tap('[data-inning-inc], .inning-up'),
    inning_prev:    () => tap('[data-inning-dec], .inning-down'),
    toggle_half:    () => tap('[data-toggle-half], .toggle-half'),
    runner_first:   () => tap('[data-runner="1"], .runner-first'),
    runner_second:  () => tap('[data-runner="2"], .runner-second'),
    runner_third:   () => tap('[data-runner="3"], .runner-third'),
    runners_clear:  () => tap('[data-runners-clear], .clear-runners'),
    stop_all:       () => tap('[data-stop-all], .stop-all'),
    copy_obs_url:   () => tap('[data-copy-obs], .copy-obs'),
    lineup_next:    () => tap('[data-lineup-next], .lineup-next'),
    lineup_prev:    () => tap('[data-lineup-prev], .lineup-prev'),
    play_sound:     () => tapSound(cmd.soundId),
  }[cmd.action] || (() => console.warn('[dp-sync] commande inconnue:', cmd.action)))();
}

function tap(sel) {
  const el = document.querySelector(sel);
  if (el) el.click();
  else console.warn('[dp-sync] non trouvé:', sel);
}

function tapSound(id) {
  const el = document.querySelector(`[data-sound-id="${id}"] .play-btn, [data-sound="${id}"] .play`);
  if (el) el.click();
}

function activateMode(mode) {
  document.querySelectorAll('[role="tab"], .tab-btn, nav button, .nav-link, .mode-tab').forEach(t => {
    if (t.textContent.toLowerCase().includes(mode)) t.click();
  });
}

// ─── Observation des changements ──────────────────────────────────────────

function watchState(onChange) {
  let last = JSON.stringify(getState());
  let timer = null;
  const obs = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const next = JSON.stringify(getState());
      if (next !== last) { last = next; onChange(JSON.parse(next)); }
    }, 80);
  });
  obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
  return obs;
}

// ─── Init Trystero ────────────────────────────────────────────────────────

const code = genCode();
const { dot, lbl } = createBadge(code);

console.log('[dp-sync] démarrage · code:', code);

// Chaque session = room unique basée sur le code
const room = joinRoom({ appId: APP_ID }, 'room-' + code);

const [sendState, getStateMsg]     = room.makeAction('state');
const [sendAck, getAck]            = room.makeAction('ack');
const [, getCommand]               = room.makeAction('cmd');

let observer = null;
let peerCount = 0;

room.onPeerJoin(peerId => {
  peerCount++;
  console.log('[dp-sync] Surface connectée:', peerId);
  setBadge(dot, lbl, 'connected', code);

  // Envoie l'état immédiatement
  sendState(getState());

  // Surveille les changements et les pousse
  if (!observer) {
    observer = watchState(state => sendState(state));
  }
});

room.onPeerLeave(peerId => {
  peerCount = Math.max(0, peerCount - 1);
  if (peerCount === 0) {
    setBadge(dot, lbl, 'waiting', code);
    if (observer) { observer.disconnect(); observer = null; }
    console.log('[dp-sync] Surface déconnectée');
  }
});

getCommand((cmd) => {
  handleCommand(cmd);
  // Renvoie l'état mis à jour après l'action
  setTimeout(() => sendState(getState()), 200);
});

// API publique pour debug
window.dpSync = { getCode: () => code, getState, room };
