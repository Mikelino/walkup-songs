/**
 * dp-sync.js — Diamond Pulse Surface Panel Sync
 * Zero install — PeerJS via CDN (WebRTC peer-to-peer)
 *
 * INTÉGRATION dans Diamond Pulse :
 *   <script src="https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js"></script>
 *   <script src="dp-sync.js"></script>
 *
 * Un badge "◉ SYNC · XXXX" apparaît en bas de l'écran.
 * La Surface Go ouvre panel.html et tape le code à 4 chiffres.
 */

(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────

  const PEER_HOST  = '0.peerjs.com';   // serveur de signaling public PeerJS
  const PEER_PORT  = 443;
  const PEER_PATH  = '/';
  const PEER_SECURE = true;

  // ─── Génère un code session 4 chiffres ─────────────────────────────────────

  function genCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  // ─── Badge UI ───────────────────────────────────────────────────────────────

  function createBadge(code) {
    const badge = document.createElement('div');
    badge.id = 'dp-sync-badge';
    Object.assign(badge.style, {
      position:     'fixed',
      bottom:       '14px',
      right:        '14px',
      zIndex:       '99999',
      background:   '#0d0d14',
      color:        'rgba(255,255,255,0.55)',
      border:       '0.5px solid rgba(255,255,255,0.12)',
      borderRadius: '10px',
      padding:      '8px 14px',
      fontFamily:   'monospace',
      fontSize:     '12px',
      cursor:       'default',
      userSelect:   'none',
      display:      'flex',
      alignItems:   'center',
      gap:          '8px',
      transition:   'all 0.3s',
    });

    const dot = document.createElement('span');
    dot.id = 'dp-sync-dot';
    dot.textContent = '◉';
    dot.style.color = '#888780';

    const label = document.createElement('span');
    label.id = 'dp-sync-label';
    label.textContent = `SYNC · ${code}`;

    badge.appendChild(dot);
    badge.appendChild(label);
    document.body.appendChild(badge);
    return { badge, dot, label };
  }

  function setBadgeState(dot, label, state, code) {
    if (state === 'waiting') {
      dot.style.color = '#888780';
      label.textContent = `SYNC · ${code}`;
    } else if (state === 'connected') {
      dot.style.color = '#1D9E75';
      label.textContent = 'Surface · connectée';
    } else if (state === 'error') {
      dot.style.color = '#E24B4A';
      label.textContent = 'SYNC · erreur';
    }
  }

  // ─── Lecture de l'état courant de Diamond Pulse ────────────────────────────

  function getCurrentState() {
    const state = {
      mode:    detectMode(),
      score:   { home: 0, away: 0 },
      inning:  { number: 1, half: 'top' },
      count:   { balls: 0, strikes: 0, outs: 0 },
      runners: { first: false, second: false, third: false },
      atBat:   '',
      onDeck:  '',
    };

    // Score
    const scoreNums = document.querySelectorAll('.score-value, [data-score], .score-number');
    if (scoreNums.length >= 2) {
      state.score.home = parseInt(scoreNums[0].textContent) || 0;
      state.score.away = parseInt(scoreNums[1].textContent) || 0;
    }

    // Batter at bat
    const atBatEl = document.querySelector('#at-bat-name, .at-bat-player, [data-at-bat]');
    if (atBatEl) state.atBat = atBatEl.textContent.trim();

    // On deck
    const onDeckEl = document.querySelector('#on-deck-name, .on-deck-player, [data-on-deck]');
    if (onDeckEl) state.onDeck = onDeckEl.textContent.trim();

    return state;
  }

  function detectMode() {
    // Cherche l'onglet/bouton actif parmi les 4 modes
    const activeTab = document.querySelector(
      '.tab-active, [aria-selected="true"], .mode-btn.active, .nav-link.active'
    );
    if (!activeTab) return 'live';
    const text = activeTab.textContent.toLowerCase();
    if (text.includes('lineup'))    return 'lineup';
    if (text.includes('social'))    return 'social';
    if (text.includes('broadcast')) return 'broadcast';
    return 'live';
  }

  // ─── Actions reçues depuis la Surface ──────────────────────────────────────

  function handleCommand(cmd) {
    console.log('[dp-sync] commande reçue:', cmd);

    switch (cmd.action) {

      // Navigation entre modes
      case 'set_mode':
        activateMode(cmd.mode);
        break;

      // Batter suivant / précédent
      case 'batter_next':
        clickButton('[data-batter-next], .batter-next, button.next-batter');
        break;
      case 'batter_prev':
        clickButton('[data-batter-prev], .batter-prev, button.prev-batter');
        break;

      // Score +1 / -1
      case 'score_home_inc':
        clickButton('[data-score-home-inc], .home-score-up, button[data-team="home"][data-action="inc"]');
        break;
      case 'score_home_dec':
        clickButton('[data-score-home-dec], .home-score-down, button[data-team="home"][data-action="dec"]');
        break;
      case 'score_away_inc':
        clickButton('[data-score-away-inc], .away-score-up, button[data-team="away"][data-action="inc"]');
        break;
      case 'score_away_dec':
        clickButton('[data-score-away-dec], .away-score-down, button[data-team="away"][data-action="dec"]');
        break;

      // Count
      case 'count_reset':
        clickButton('[data-count-reset], .reset-count, button.count-reset');
        break;
      case 'inning_next':
        clickButton('[data-inning-inc], .inning-up, button[data-action="inning-inc"]');
        break;
      case 'inning_prev':
        clickButton('[data-inning-dec], .inning-down, button[data-action="inning-dec"]');
        break;
      case 'toggle_half':
        clickButton('[data-toggle-half], .toggle-half, button.inning-half');
        break;

      // Coureurs
      case 'runner_first':
        clickButton('[data-runner="1"], .runner-first, button[data-base="1"]');
        break;
      case 'runner_second':
        clickButton('[data-runner="2"], .runner-second, button[data-base="2"]');
        break;
      case 'runner_third':
        clickButton('[data-runner="3"], .runner-third, button[data-base="3"]');
        break;
      case 'runners_clear':
        clickButton('[data-runners-clear], .clear-runners, button.runners-clear');
        break;

      // Sons
      case 'play_sound':
        playSound(cmd.soundId);
        break;
      case 'stop_all':
        clickButton('[data-stop-all], .stop-all, button.stop-sounds');
        break;

      // OBS
      case 'copy_obs_url':
        clickButton('[data-copy-obs], .copy-obs, button.obs-copy');
        break;

      // Lineup
      case 'lineup_next':
        clickButton('[data-lineup-next], .lineup-next');
        break;
      case 'lineup_prev':
        clickButton('[data-lineup-prev], .lineup-prev');
        break;
    }
  }

  function clickButton(selector) {
    const btn = document.querySelector(selector);
    if (btn) {
      btn.click();
    } else {
      console.warn('[dp-sync] élément non trouvé:', selector);
    }
  }

  function activateMode(mode) {
    // Cherche les onglets de navigation et clique sur le bon
    const tabs = document.querySelectorAll('.tab-btn, .mode-tab, nav button, .nav-link, [role="tab"]');
    tabs.forEach(tab => {
      const text = tab.textContent.toLowerCase();
      if (text.includes(mode)) tab.click();
    });
  }

  function playSound(soundId) {
    // Cherche le bouton play du son par son ID ou label
    const btn = document.querySelector(
      `[data-sound-id="${soundId}"] .play-btn, [data-sound="${soundId}"] button.play`
    );
    if (btn) btn.click();
  }

  // ─── Observation des changements dans Diamond Pulse ────────────────────────

  function watchState(onStateChange) {
    let lastState = JSON.stringify(getCurrentState());

    // MutationObserver sur le body entier (léger car on throttle)
    const observer = new MutationObserver(() => {
      const newState = JSON.stringify(getCurrentState());
      if (newState !== lastState) {
        lastState = newState;
        onStateChange(JSON.parse(newState));
      }
    });

    observer.observe(document.body, {
      childList:  true,
      subtree:    true,
      attributes: true,
      characterData: true,
    });

    return observer;
  }

  // ─── Initialisation PeerJS ─────────────────────────────────────────────────

  function init() {
    if (typeof Peer === 'undefined') {
      console.error('[dp-sync] PeerJS non chargé. Ajoute le script avant dp-sync.js');
      return;
    }

    const code = genCode();
    const { badge, dot, label } = createBadge(code);

    // L'ID PeerJS = "dp-" + code pour éviter les collisions
    const peer = new Peer('dp-' + code, {
      host:   PEER_HOST,
      port:   PEER_PORT,
      path:   PEER_PATH,
      secure: PEER_SECURE,
    });

    let conn = null;
    let stateObserver = null;

    peer.on('open', () => {
      console.log('[dp-sync] en attente sur le code:', code);
    });

    peer.on('connection', (connection) => {
      conn = connection;
      setBadgeState(dot, label, 'connected', code);
      console.log('[dp-sync] Surface Go connectée');

      // Envoie l'état initial dès la connexion
      conn.on('open', () => {
        conn.send({ type: 'state', payload: getCurrentState() });
      });

      // Écoute les commandes de la Surface
      conn.on('data', (data) => {
        if (data.type === 'command') {
          handleCommand(data.payload);
          // Renvoie l'état mis à jour après un court délai
          setTimeout(() => {
            if (conn && conn.open) {
              conn.send({ type: 'state', payload: getCurrentState() });
            }
          }, 150);
        }
      });

      // Surveille les changements dans Diamond Pulse et les pousse vers la Surface
      stateObserver = watchState((state) => {
        if (conn && conn.open) {
          conn.send({ type: 'state', payload: state });
        }
      });

      conn.on('close', () => {
        setBadgeState(dot, label, 'waiting', code);
        if (stateObserver) { stateObserver.disconnect(); stateObserver = null; }
        conn = null;
        console.log('[dp-sync] Surface Go déconnectée');
      });
    });

    peer.on('error', (err) => {
      console.error('[dp-sync] erreur PeerJS:', err);
      setBadgeState(dot, label, 'error', code);
    });

    // Expose l'API globale pour Diamond Pulse
    window.dpSync = {
      getCode:  () => code,
      getState: getCurrentState,
      send:     (msg) => { if (conn && conn.open) conn.send(msg); },
      peer,
    };
  }

  // Lance au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
