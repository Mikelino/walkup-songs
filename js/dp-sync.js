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

  // ─── Lecture de l'état Diamond Pulse ───────────────────────────────────────

  function getState() {
    return {
      score: {
        home: readInt('#matchScoreHome'),
        away: readInt('#matchScoreAway'),
      },
      inning: {
        number: readInt('#matchInningNum'),
        half:   readHalf(),
      },
      count: {
        balls:   countDots('#matchBalls .match-dot'),
        strikes: countDots('#matchStrikes .match-dot'),
        outs:    countDots('#matchOuts .match-dot'),
        pitches: matchState ? (matchState.pitchCount || 0) : 0,
      },
      runners: {
        first:  isBaseOn('matchBase1'),
        second: isBaseOn('matchBase2'),
        third:  isBaseOn('matchBase3'),
      },
      atBat:  readText('#matchBatterDisplay'),
      onDeck: readText('#matchOnDeckDisplay'),
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
  function readHalf() {
    const e = document.getElementById('matchInningArrow');
    return e && e.textContent.trim() === '▼' ? 'bottom' : 'top';
  }
  function countDots(sel) {
    let n = 0;
    document.querySelectorAll(sel).forEach(el => {
      const bg = el.style.background || el.style.backgroundColor || '';
      const computed = window.getComputedStyle(el).backgroundColor;
      if (
        el.classList.contains('active') || el.classList.contains('on') ||
        (bg && bg !== 'transparent') ||
        (computed && computed !== 'rgba(0, 0, 0, 0)' && computed !== 'transparent')
      ) n++;
    });
    return n;
  }
  function isBaseOn(id) {
    const el = document.getElementById(id);
    if (!el) return false;
    if (el.style.fill && el.style.fill !== 'transparent' && el.style.fill !== 'none') return true;
    const attr = el.getAttribute('fill') || 'transparent';
    return attr !== 'transparent' && attr !== 'none' && attr !== '';
  }

  // ─── Commandes reçues depuis la Surface ────────────────────────────────────

  function handleCmd(payload) {
    const { action } = payload;
    console.log('[dp-sync] commande:', action, payload);

    switch (action) {
      case 'score_home_inc': callFn('matchScoreAdj', 'home',  1); break;
      case 'score_home_dec': callFn('matchScoreAdj', 'home', -1); break;
      case 'score_away_inc': callFn('matchScoreAdj', 'away',  1); break;
      case 'score_away_dec': callFn('matchScoreAdj', 'away', -1); break;

      case 'inning_next':  callFn('matchInningAdj',  1); break;
      case 'inning_prev':  callFn('matchInningAdj', -1); break;
      case 'toggle_half':  callFn('matchInningToggle');  break;
      case 'change_field': callFn('matchChangeField');   break;

      // count_inc : incrémente un type (balls/strikes/outs) via matchSetCount
      // matchSetCount(type, idx) avec idx = valeur_courante (0-based)
      // → si balls = 1, on appelle matchSetCount('balls', 1) pour passer à 2
      case 'count_inc':
        countIncrement(payload.type);
        break;

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

  /**
   * Incrémente un compteur via matchSetCount.
   *
   * matchSetCount(type, idx) :
   *   - idx est 0-based (0 = premier dot)
   *   - si matchState[type] === idx+1 → décoche (toggle)
   *   - sinon → met la valeur à idx+1
   *
   * Pour incrémenter de façon sûre :
   *   - on lit la valeur courante dans matchState
   *   - on appelle matchSetCount(type, currentVal) 
   *     → currentVal est l'index du prochain dot (0-based)
   *     → si currentVal est déjà le max, matchResetCount
   */
  function countIncrement(type) {
    if (typeof matchState === 'undefined') {
      console.warn('[dp-sync] matchState non disponible');
      return;
    }
    const maxes = { balls: 3, strikes: 2, outs: 2 };
    const current = matchState[type] || 0;
    const max = maxes[type] || 3;

    if (current >= max) {
      // Déjà au max — reset
      callFn('matchResetCount');
    } else {
      // Appelle matchSetCount avec l'index du prochain dot (= current, 0-based)
      // Exemple : balls = 1 → appelle matchSetCount('balls', 1) → balls devient 2
      callFn('matchSetCount', type, current);
    }
  }

  // ─── Observation des changements ───────────────────────────────────────────

  function watchState(onChange) {
    let last = JSON.stringify(getState()), timer = null;
    const obs = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = JSON.stringify(getState());
        if (next !== last) { last = next; onChange(JSON.parse(next)); }
      }, 100);
    });
    obs.observe(document.body, {
      childList: true, subtree: true,
      attributes: true,
      attributeFilter: ['fill', 'stroke', 'style', 'class'],
      characterData: true,
    });
    return obs;
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

    let observer = null;

    const channel = window.supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'join' }, () => {
        setBadge(dot, lbl, 'connected', code);
        console.log('[dp-sync] Surface connectée');
        channel.send({ type: 'broadcast', event: 'state', payload: getState() });
        if (!observer) {
          observer = watchState(state => {
            channel.send({ type: 'broadcast', event: 'state', payload: state });
          });
        }
      })
      .on('broadcast', { event: 'leave' }, () => {
        setBadge(dot, lbl, 'waiting', code);
        if (observer) { observer.disconnect(); observer = null; }
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
