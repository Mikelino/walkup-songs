/* ============================================================
   Diamond Pulse — js/data.js
   État global de l'application + persistance Supabase

   Contient :
   - Variables globales (allPlayers, teams, appSettings, clubSettings)
   - Supabase : saveConfig(), loadConfig(), uploadToSupabase()
   - Helpers  : showSaveIndicator(), saveAndRender()

   Extrait de index.html :
     - Lignes 3952–4019  : DATA (variables globales)
     - Lignes 4878–4929  : SUPABASE CONFIG + uploadToSupabase()
     - Lignes 5184–5292  : saveConfig(), loadConfig(), showSaveIndicator()

   MIGRATION :
   Dans index.html, remplacer ces trois blocs par :
     <script type="module" src="js/data.js"></script>
   Et ajouter sur les fonctions qui en dépendent :
     import { saveConfig, loadConfig, ... } from './js/data.js'
   ============================================================ */

// ── CONSTANTES ───────────────────────────────────────────────
const EMOJIS = ['⚾','🏃','💥','🎯','⚡','🔥','💪','🌟','🎸','🏆','👊','🦅','🐻','💫','🎺'];

// ── SUPABASE ─────────────────────────────────────────────────
// Lecture différée via getters — APP_CONFIG est lu au moment de l'appel,
// pas au parsing du script. Évite les erreurs si config.js charge légèrement
// après data.js (ex: GitHub Pages, cache navigateur).
Object.defineProperty(window, 'SUPABASE_URL', { get: () => (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.supabaseUrl  : ''), configurable: true });
Object.defineProperty(window, 'SUPABASE_KEY', { get: () => (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.supabaseKey  : ''), configurable: true });
Object.defineProperty(window, 'BUCKET',       { get: () => (typeof APP_CONFIG !== 'undefined' ? APP_CONFIG.bucket       : 'songs'), configurable: true });

// HEADERS est une fonction pour être réévalué à chaque appel
function getHeaders() {
  return {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
    'Prefer':        'resolution=merge-duplicates',
  };
}
// Alias pour compatibilité avec le code existant qui utilise HEADERS directement
const HEADERS = new Proxy({}, { get: (_, k) => getHeaders()[k] });

// ── STATE GLOBAL ─────────────────────────────────────────────
// APP_CONFIG est défini dans config.js (chargé avant data.js dans index.html)
// Le guard ci-dessous évite tout crash si l'ordre de chargement est perturbé
const _cfg = (typeof APP_CONFIG !== 'undefined') ? APP_CONFIG : {};

// Répertoire global des joueurs — chargé depuis Supabase
let allPlayers = {};

// Équipes par défaut depuis config.js — écrasées au chargement par Supabase
let teams = Object.fromEntries(
  Object.entries(_cfg.defaultTeams || { Team1: 'Team 1' })
    .map(([k, label]) => [k, { label, lineup: [] }])
);

let currentTeamId    = Object.keys(teams)[0];
let currentAudio     = null;
let currentPid       = null;
let progressInterval = null;
let sortable         = null;
let isEditMode       = false;
let PLAY_DURATION    = _cfg.playDuration || 15;

let appSettings = {
  adminPassword:   _cfg.adminPassword || 'ChangeMe2024!',
  playDuration:    _cfg.playDuration  || 15,
  extraPositions:  [],
  posPronunciations: {},
  opponents:       [],
  tts: {
    enabled:          false,
    engine:           'webspeech',
    lang:             'en',
    template:         'Now batting, number {jersey}, {name}!',
    voiceName:        '',
    openAIKey:        '',
    openAIVoice:      'onyx',
    elevenLabsKey:    '',
    elevenLabsVoice:  'onwK4e9ZLuTAKqWW03F9',
    elevenLabsLang:   '',
    fadeDelay:        1.5,
  },
  soundboard: {
    anthem:   null,
    applause: null,
    letsgo:   null,
    homerun:  null,
  },
  intro: {
    openingText:    '',
    showRestOfTeam: true,
  },
};

let clubSettings = {
  name:     _cfg.clubName    || 'Your Team',
  sub:      _cfg.clubSub     || 'Walk-Up Songs',
  website:  _cfg.clubWebsite || 'yourclub.com',
  logo:     null,
  bgLineup: null,
  bgScore:  null,
  bgMvp:    null,
};

// ── HELPERS ──────────────────────────────────────────────────

function currentLineup() {
  return teams[currentTeamId].lineup;
}

function showSaveIndicator() {
  const el = document.getElementById('saveIndicator');
  el.textContent = '✓ Saved';
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2000);
}

function saveAndRender() {
  render();
  saveConfig();
}

// ── SUPABASE : UPLOAD AUDIO ───────────────────────────────────

async function uploadToSupabase(file, teamId, playerName) {
  const ext      = file.name.split('.').pop().toLowerCase();
  const safeName = playerName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const path = `${teamId}/${safeName}.${ext}`;

  let res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type':  file.type,
      'x-upsert':      'true',
    },
    body: file,
  });

  if (!res.ok && res.status === 409) {
    res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type':  file.type,
        'x-upsert':      'true',
      },
      body: file,
    });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

// ── SUPABASE : SAVE CONFIG ────────────────────────────────────

async function saveConfig() {
  try {
    // Lire la valeur actuelle pour ne pas écraser matchState / visitorsLineup
    const readRes = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.app&select=value`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await readRes.json();
    const current = rows?.[0]?.value || {};

    // Sync pitcher name avant de sauvegarder (position P dans le lineup)
    if (typeof matchAutoSetPitcher === 'function') matchAutoSetPitcher();

    // Bumper dataVersion pour signaler le changement de lineup à l'overlay
    const newDataVersion = Date.now();
    const newMatchState = typeof matchState !== 'undefined'
      ? { ...matchState, dataVersion: newDataVersion }
      : (current.matchState || {});

    await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.app`, {
      method:  'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body:    JSON.stringify({
        value:      { ...current, allPlayers, teams, clubSettings, appSettings, matchState: newMatchState },
        updated_at: new Date().toISOString(),
      }),
    });
    showSaveIndicator();
    if (typeof matchState !== 'undefined') matchState.dataVersion = newDataVersion;
    if (typeof matchRenderPanel === 'function') matchRenderPanel();
  } catch (err) {
    console.warn('Save failed:', err);
  }
}

// ── SUPABASE : LOAD CONFIG ────────────────────────────────────

async function loadConfig() {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('[loadConfig] SUPABASE_URL ou SUPABASE_KEY manquant — vérifiez config.js');
      return;
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/config?key=eq.app&select=value`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );

    if (!res.ok) {
      console.error(`[loadConfig] HTTP ${res.status} — vérifiez les credentials Supabase et les RLS policies`);
      return;
    }

    const data = await res.json();

    if (!data || !Array.isArray(data)) {
      console.error('[loadConfig] Réponse inattendue de Supabase :', data);
      return;
    }
    if (data.length === 0) {
      console.warn('[loadConfig] Table config vide — aucune donnée à charger');
      return;
    }
    if (!data[0].value) {
      console.warn('[loadConfig] Ligne config trouvée mais value est null/vide');
      return;
    }

    const v = data[0].value;

    // Joueurs
    if (v.allPlayers) allPlayers = v.allPlayers;

    // Équipes
    if (v.teams && Object.keys(v.teams).length > 0) {
      teams = v.teams;
      if (!teams[currentTeamId]) currentTeamId = Object.keys(teams)[0];
    }

    // Identité du club
    if (v.clubSettings) {
      const merged  = { ...v.clubSettings };
      const GENERIC = ['Your Team', 'Mon Club', 'Walk-Up Songs', 'yourclub.com', ''];
      if (APP_CONFIG.clubName    && !GENERIC.includes(APP_CONFIG.clubName))    merged.name    = APP_CONFIG.clubName;
      if (APP_CONFIG.clubSub     && !GENERIC.includes(APP_CONFIG.clubSub))     merged.sub     = APP_CONFIG.clubSub;
      if (APP_CONFIG.clubWebsite && !GENERIC.includes(APP_CONFIG.clubWebsite)) merged.website = APP_CONFIG.clubWebsite;
      clubSettings = { ...clubSettings, ...merged };
      applyClubSettings();
    } else {
      applyClubSettings();
    }

    // Paramètres app
    if (v.appSettings) {
      appSettings   = { ...appSettings, ...v.appSettings };
      PLAY_DURATION = appSettings.playDuration;
      refreshNewPosSelect();

      if (appSettings.fontPairId) {
        const pair = FONT_PAIRS.find(p => p.id === appSettings.fontPairId);
        if (pair) ifLoadFontPair(pair).then(() => ifApplyFontPair(pair));
      }

      if (appSettings.colorAccent) {
        const accent = appSettings.colorAccent;
        const bg     = appSettings.colorBg || '#0a0a0a';
        const darken = (hex, amt) => {
          const [r, g, b] = hex.match(/\w\w/g).map(x => parseInt(x, 16));
          return '#' + [r, g, b].map(c => Math.max(0, c - amt).toString(16).padStart(2, '0')).join('');
        };
        const [rA, gA, bA] = [
          parseInt(accent.slice(1, 3), 16),
          parseInt(accent.slice(3, 5), 16),
          parseInt(accent.slice(5, 7), 16),
        ];
        document.documentElement.style.setProperty('--orange',       accent);
        document.documentElement.style.setProperty('--orange-dark',  darken(accent, 50));
        document.documentElement.style.setProperty('--orange-glow',  `rgba(${rA},${gA},${bA},0.25)`);
        document.documentElement.style.setProperty('--orange-avatar',`rgba(${rA},${gA},${bA},0.5)`);
        document.documentElement.style.setProperty('--black',        bg);
        document.documentElement.style.setProperty('--darkgray',     shiftColor(bg, 10));
      }
    }

  } catch (err) {
    console.error('[loadConfig] Erreur inattendue :', err);
  }
}
