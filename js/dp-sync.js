/**
 * dp-sync.js — Diamond Pulse Surface Panel Sync
 * Supabase Realtime Broadcast — zéro installation
 *
 * INTÉGRATION dans index.html (après js/config.js) :
 *   <script src="js/dp-sync.js"></script>
 */

(function () {
  'use strict';

  function genCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  // ─── Badge — coin inférieur gauche ─────────────────────────────────────────

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
    dot.id = 'dp-sync-dot'; dot.textContent = '◉'; dot.style.color = '#888780';
    const lbl = document.createElement('span');
    lbl.id = 'dp-sync-label'; lbl.textContent = 'SYNC · ' + code;
    badge.appendChild(dot); badge.appendChild(lbl);
    document.body.appendChild(badge);
    return { dot, lbl };
  }

  function setBadge(dot, lbl, state, code) {
    const s = {
      waiting:   { c: '#888780', t: 'SYNC · ' + code },
      connected: { c: '#1D9E75', t: 'Surface · connectée' },
      error:     { c: '#E24B4A', t: 'SYNC · erreur' },
    }[state] || { c: '#888780', t: 'SYNC · ' + code };
    dot.style.color = s.c;
    lbl.textContent = s.t;
  }

  // ─── Lecture de l'état via matchState (source de vérité) ───────────────────
  // matchState = { balls, strikes, outs, inning, inningTop, scoreHome, scoreAway,
  //                runners: {first,second,third}, pitchCount, batterIdx, ... }

  function ms() {
    return (typeof matchState !== 'undefined') ? matchState : null;
  }

  function getState() {
    const m = ms();
    if (m) {
      // Lecture directe depuis matchState — fiable à 100%
      return {
        score: {
          home: m.scoreHome || 0,
          away: m.scoreAway || 0,
        },
        inning: {
          number: m.inning || 1,
          half:   m.inningTop ? 'top' : 'bottom',
        },
        count: {
          balls:   m.balls   || 0,
          strikes: m.strikes || 0,
          outs:    m.outs    || 0,
          pitches: m.pitchCount || 0,
        },
        runners: {
          first:  !!(m.runners && m.runners.first),
          second: !!(m.runners && m.runners.second),
          third:  !!(m.runners && m.runners.third),
        },
        atBat:  readText('#matchBatterDisplay'),
        onDeck: readText('#matchOnDeckDisplay'),
      };
    }
    // Fallback DOM si matchState pas encore disponible
    return {
      score:   { home: readInt('#matchScoreHome'), away: readInt('#matchScoreAway') },
      inning:  { number: readInt('#matchInningNum'), half: readHalfDom() },
      count:   { balls: 0, strikes: 0, outs: 0, pitches: 0 },
      runners: { first: false, second: false, third: false },
      atBat:   readText('#matchBatterDisplay'),
      onDeck:  readText('#matchOnDeckDisplay'),
    };
  }

  function readInt(sel) {
    const e = document.querySelector(sel);
    return e ? (parseInt(e.textContent) || 0) : 0;
  }
  function readText(sel) {
    const e = document.querySelector(sel);
    return e ? e.textContent.trim() : '';
  }
  function readHalfDom() {
    const e = document.getElementById('matchInningArrow');
    return e && e.textContent.trim() === '▼' ? 'bottom' : 'top';
  }

  // ─── Commandes reçues depuis la Surface ────────────────────────────────────

  function handleCmd(payload) {
    const { action } = payload;
    console.log('[dp-sync] commande:', action);

    switch (action) {
      case 'score_home_inc': callFn('matchScoreAdj', 'home',  1); break;
      case 'score_home_dec': callFn('matchScoreAdj', 'home', -1); break;
      case 'score_away_inc': callFn('matchScoreAdj', 'away',  1); break;
      case 'score_away_dec': callFn('matchScoreAdj', 'away', -1); break;

      case 'inning_next':  callFn('matchInningAdj',  1); break;
      case 'inning_prev':  callFn('matchInningAdj', -1); break;
      case 'toggle_half':  callFn('matchInningToggle');  break;
      case 'change_field': callFn('matchChangeField');   break;

      // count_inc : incrémente via matchSetCount avec la valeur courante de matchState
      // matchSetCount(type, idx) où idx = valeur actuelle (0-based du prochain dot)
      // Exemple : balls=1 → matchSetCount('balls', 1) → balls devient 2, pitchCount++
      case 'count_inc': {
        const m = ms();
        if (!m) { console.warn('[dp-sync] matchState non disponible'); break; }
        const maxes = { balls: 3, strikes: 2, outs: 2 };
        const current = m[payload.type] || 0;
        const max = maxes[payload.type] || 3;
        if (current >= max) {
          callFn('matchResetCount');
        } else {
          // current est la valeur actuelle, donc l'index 0-based du prochain dot
          callFn('matchSetCount', payload.type, current);
        }
        break;
      }

      case 'count_reset': callFn('matchResetCount'); break;
      case 'walk':        callFn('matchWalk');        break;
      case 'strikeout':   callFn('matchStrikeout');   break;

      case 'toggle_runner_first':  callFn('matchToggleRunner', 'first');  break;
      case 'toggle_runner_second': callFn('matchToggleRunner', 'second'); break;
      case 'toggle_runner_third':  callFn('matchToggleRunner', 'third');  break;
      case 'runners_clear':        callFn('matchClearRunners');            break;

      case 'batter_next': callFn('matchBatterAdj',  1); break;
      case 'batter_prev': callFn('matchBatterAdj', -1); break;

      case 'broadcast_silver':   callFn('broadcastSilverBlock'); break;
      case 'broadcast_ballgame': callFn('broadcastBallGame');    break;

      case 'stop_all':     if (typeof liveSoundStopAll === 'function') liveSoundStopAll(); break;
      case 'play_sound':   if (typeof liveSoundPlay    === 'function') liveSoundPlay(payload.soundId); break;
      case 'copy_obs_url': callFn('matchCopyOverlayUrl'); break;

      default: console.warn('[dp-sync] commande inconnue:', action);
    }
  }

  function callFn(name, ...args) {
    if (typeof window[name] === 'function') {
      window[name](...args);
    } else {
      console.warn('[dp-sync] fonction non trouvée:', name);
    }
  }

  // ─── Observation des changements ───────────────────────────────────────────
  // On observe à la fois le DOM et matchState via polling léger

  function watchState(onChange) {
    let last = JSON.stringify(getState()), timer = null;

    // MutationObserver pour les changements DOM
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(check, 80);
    });
    obs.observe(document.body, {
      childList: true, subtree: true,
      attributes: true,
      attributeFilter: ['fill', 'stroke', 'style', 'class'],
      characterData: true,
    });

    // Polling léger (200ms) pour capturer les changements de matchState
    // qui ne déclenchent pas forcément le DOM (ex: pitchCount)
    const poll = setInterval(check, 200);

    function check() {
      const next = JSON.stringify(getState());
      if (next !== last) { last = next; onChange(JSON.parse(next)); }
    }

    return { obs, poll };
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    if (!window.supabase) {
      console.error('[dp-sync] window.supabase non disponible.');
      return;
    }

    const code = genCode();
    const { dot, lbl } = createBadge(code);
    const channelName = 'dp-panel-' + code;
    console.log('[dp-sync] démarrage · code:', code);

    let watcher = null;

    const channel = window.supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'join' }, () => {
        setBadge(dot, lbl, 'connected', code);
        console.log('[dp-sync] Surface connectée');
        channel.send({ type: 'broadcast', event: 'state', payload: getState() });
        if (!watcher) {
          watcher = watchState(state => {
            channel.send({ type: 'broadcast', event: 'state', payload: state });
          });
        }
      })
      .on('broadcast', { event: 'leave' }, () => {
        setBadge(dot, lbl, 'waiting', code);
        if (watcher) {
          watcher.obs.disconnect();
          clearInterval(watcher.poll);
          watcher = null;
        }
        console.log('[dp-sync] Surface déconnectée');
      })
      .on('broadcast', { event: 'cmd' }, ({ payload }) => {
        handleCmd(payload);
        setTimeout(() => {
          channel.send({ type: 'broadcast', event: 'state', payload: getState() });
        }, 300);
      })
      .subscribe(status => {
        console.log('[dp-sync] Supabase:', status);
        if (status === 'SUBSCRIBED') console.log('[dp-sync] prêt · code:', code);
      });

    window.dpSync = { getCode: () => code, getState, channel };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
