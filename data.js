/* ============================================================
   Diamond Pulse — js/wbsc-stats.js
   Chargement des stats WBSC via la Supabase Edge Function wbsc-proxy
   Ajoute un bouton 📊 sur chaque carte joueur (en mode édition)
   et affiche un modal avec les stats parsées.
   ============================================================ */

// ── MODAL HTML (injecté une seule fois dans le DOM) ──────────
(function injectWbscModal() {
  if (document.getElementById('wbscModal')) return;
  const el = document.createElement('div');
  el.id = 'wbscModal';
  el.innerHTML = `
    <div id="wbscBackdrop"></div>
    <div id="wbscBox">
      <div id="wbscHeader">
        <span id="wbscIcon">📊</span>
        <h2>STATS WBSC</h2>
      </div>
      <div id="wbscPlayerName"></div>

      <label class="wbsc-label">URL MYBALLCLUB DU JOUEUR</label>
      <input id="wbscUrlInput" type="url"
        placeholder="https://www.baseballsoftball.be/en/events/.../players/12345"
        autocomplete="off">

      <div class="wbsc-row">
        <label class="wbsc-label">CATÉGORIE</label>
        <select id="wbscCategory">
          <option value="">Auto</option>
          <option value="BU12">BU12</option>
          <option value="BU15">BU15</option>
          <option value="BU18">BU18</option>
          <option value="BU21">BU21</option>
          <option value="Senior">Senior</option>
          <option value="Women">Women</option>
          <option value="Mixed">Mixed</option>
        </select>
        <button id="wbscLoadBtn" class="wbsc-btn-primary">CHARGER</button>
      </div>

      <div id="wbscMsg"></div>
      <div id="wbscResults" style="display:none">
        <div id="wbscBattingSection">
          <div class="wbsc-section-title">⚾ BATTING</div>
          <div id="wbscBattingGrid" class="wbsc-grid"></div>
        </div>
        <div id="wbscPitchingSection" style="display:none">
          <div class="wbsc-section-title">🎯 PITCHING</div>
          <div id="wbscPitchingGrid" class="wbsc-grid"></div>
        </div>
        <div class="wbsc-actions">
          <button id="wbscSaveBtn" class="wbsc-btn-secondary">💾 Sauvegarder dans le profil</button>
          <a id="wbscSourceLink" href="#" target="_blank" class="wbsc-btn-ghost">
            Voir sur WBSC ↗
          </a>
        </div>
      </div>

      <button id="wbscCloseBtn" class="wbsc-btn-close">FERMER</button>
    </div>
  `;
  document.body.appendChild(el);

  // Styles du modal
  const style = document.createElement('style');
  style.textContent = `
    #wbscModal { display:none; position:fixed; inset:0; z-index:500; align-items:center; justify-content:center; padding:16px; }
    #wbscModal.open { display:flex; }
    #wbscBackdrop { position:absolute; inset:0; background:rgba(0,0,0,.85); }
    #wbscBox {
      position:relative; background:#141414; border:1px solid var(--orange,#FF4500);
      border-radius:8px; width:100%; max-width:480px; padding:20px;
      box-shadow:0 0 30px rgba(255,69,0,.3); display:flex; flex-direction:column; gap:12px;
      max-height:90vh; overflow-y:auto;
    }
    #wbscHeader { display:flex; align-items:center; gap:10px; }
    #wbscIcon { font-size:22px; }
    #wbscHeader h2 { font-family:'Oswald',sans-serif; font-size:20px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:var(--orange,#FF4500); }
    #wbscPlayerName { font-family:'Oswald',sans-serif; font-size:16px; color:var(--orange,#FF4500); }
    .wbsc-label { font-family:'Oswald',sans-serif; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#888; }
    #wbscUrlInput {
      width:100%; background:#1e1e1e; border:1px solid #555; border-radius:6px;
      color:#e8e8e8; padding:10px 12px; font-size:13px; outline:none; font-family:'Barlow',sans-serif;
    }
    #wbscUrlInput:focus { border-color:var(--orange,#FF4500); }
    .wbsc-row { display:flex; align-items:center; gap:10px; }
    .wbsc-row .wbsc-label { white-space:nowrap; }
    #wbscCategory {
      background:#1e1e1e; border:1px solid #555; border-radius:6px;
      color:#e8e8e8; padding:8px 10px; font-size:13px; outline:none;
    }
    .wbsc-btn-primary {
      background:var(--orange,#FF4500); color:white; border:none; border-radius:6px;
      padding:10px 20px; font-family:'Oswald',sans-serif; font-size:14px; font-weight:600;
      text-transform:uppercase; letter-spacing:.5px; cursor:pointer; transition:background .2s;
    }
    .wbsc-btn-primary:hover { background:#ff6030; }
    .wbsc-btn-primary:disabled { opacity:.5; pointer-events:none; }
    #wbscMsg { font-size:13px; color:#888; min-height:18px; }
    #wbscMsg.error { color:#e05555; }
    #wbscMsg.success { color:#4caf50; }
    .wbsc-section-title { font-family:'Oswald',sans-serif; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:8px; }
    .wbsc-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(70px,1fr)); gap:8px; }
    .wbsc-stat { background:#1e1e1e; border-radius:6px; padding:8px; text-align:center; }
    .wbsc-stat-key { font-family:'Oswald',sans-serif; font-size:10px; text-transform:uppercase; color:#888; letter-spacing:.5px; }
    .wbsc-stat-val { font-family:'Oswald',sans-serif; font-size:18px; font-weight:700; color:#e8e8e8; margin-top:2px; }
    .wbsc-stat-val.highlight { color:var(--orange,#FF4500); }
    .wbsc-actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:4px; }
    .wbsc-btn-secondary {
      background:#2a2a2a; color:#e8e8e8; border:1px solid #555; border-radius:6px;
      padding:8px 16px; font-family:'Oswald',sans-serif; font-size:13px; font-weight:500;
      text-transform:uppercase; cursor:pointer; transition:all .2s; text-decoration:none;
    }
    .wbsc-btn-secondary:hover { border-color:var(--orange,#FF4500); color:var(--orange,#FF4500); }
    .wbsc-btn-ghost {
      background:none; color:#888; border:1px solid #2a2a2a; border-radius:6px;
      padding:8px 16px; font-family:'Oswald',sans-serif; font-size:13px;
      text-transform:uppercase; cursor:pointer; transition:all .2s; text-decoration:none; display:inline-flex; align-items:center;
    }
    .wbsc-btn-ghost:hover { color:#e8e8e8; border-color:#555; }
    #wbscCloseBtn {
      background:none; color:#888; border:1px solid #2a2a2a; border-radius:6px;
      padding:8px; font-family:'Oswald',sans-serif; font-size:13px; font-weight:500;
      text-transform:uppercase; cursor:pointer; transition:all .2s; width:100%;
    }
    #wbscCloseBtn:hover { color:#e8e8e8; border-color:#555; }
    #wbscBattingSection, #wbscPitchingSection { display:flex; flex-direction:column; }
  `;
  document.head.appendChild(style);

  // Events
  document.getElementById('wbscCloseBtn').addEventListener('click', closeWbscModal);
  document.getElementById('wbscBackdrop').addEventListener('click', closeWbscModal);
  document.getElementById('wbscLoadBtn').addEventListener('click', loadWbscStats);
  document.getElementById('wbscSaveBtn').addEventListener('click', saveWbscToProfile);
})();

// ── STATE ────────────────────────────────────────────────────
let wbscCurrentPid   = null; // pid du joueur ouvert
let wbscLastStats    = null; // dernières stats chargées

// ── OPEN / CLOSE ─────────────────────────────────────────────
function openWbscModal(pid) {
  wbscCurrentPid = pid;
  const player   = allPlayers[pid] || {};
  const entry    = currentLineup().find(e => e.pid == pid) || {};

  document.getElementById('wbscPlayerName').textContent =
    player.name + (entry.jersey ? ` — #${entry.jersey}` : '');

  // Pré-remplir l'URL si déjà sauvegardée
  document.getElementById('wbscUrlInput').value = player.wbscUrl || '';

  // Pré-sélectionner la catégorie
  if (player.wbscCategory) {
    document.getElementById('wbscCategory').value = player.wbscCategory;
  }

  // Masquer les résultats précédents
  document.getElementById('wbscResults').style.display = 'none';
  document.getElementById('wbscMsg').textContent = '';
  document.getElementById('wbscMsg').className = '';
  wbscLastStats = null;

  document.getElementById('wbscModal').classList.add('open');
}

function closeWbscModal() {
  document.getElementById('wbscModal').classList.remove('open');
  wbscCurrentPid = null;
}

// ── LOAD STATS VIA EDGE FUNCTION ─────────────────────────────
async function loadWbscStats() {
  const url = document.getElementById('wbscUrlInput').value.trim();
  if (!url) {
    setWbscMsg('Colle l\'URL de la page joueur sur baseballsoftball.be', 'error');
    return;
  }
  if (!url.includes('baseballsoftball.be')) {
    setWbscMsg('L\'URL doit provenir de baseballsoftball.be ou myballclub', 'error');
    return;
  }

  const btn = document.getElementById('wbscLoadBtn');
  btn.textContent = '⏳ CHARGEMENT…';
  btn.disabled = true;
  setWbscMsg('Connexion à WBSC…');
  document.getElementById('wbscResults').style.display = 'none';

  try {
    // Appel à la Supabase Edge Function
    const edgeFnUrl = `${SUPABASE_URL}/functions/v1/wbsc-proxy`;
    const res = await fetch(edgeFnUrl, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'apikey':        SUPABASE_KEY,
      },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur HTTP ${res.status}`);
    }

    const stats = await res.json();
    wbscLastStats = stats;

    renderWbscStats(stats);
    setWbscMsg('✓ Stats chargées avec succès', 'success');

  } catch (err) {
    setWbscMsg(err.message || 'Erreur de connexion', 'error');
    console.error('[WBSC]', err);
  } finally {
    btn.textContent = 'CHARGER';
    btn.disabled = false;
  }
}

// ── RENDER STATS ─────────────────────────────────────────────
function renderWbscStats(stats) {
  // Batting
  const battingSection = document.getElementById('wbscBattingSection');
  const battingGrid    = document.getElementById('wbscBattingGrid');
  battingGrid.innerHTML = '';

  if (stats.batting && Object.keys(stats.batting).length > 0) {
    const highlight = ['AVG','OBP','SLG','OPS','HR','RBI'];
    Object.entries(stats.batting).forEach(([key, val]) => {
      const isHL = highlight.includes(key);
      battingGrid.innerHTML += `
        <div class="wbsc-stat">
          <div class="wbsc-stat-key">${key}</div>
          <div class="wbsc-stat-val ${isHL ? 'highlight' : ''}">${val}</div>
        </div>`;
    });
    battingSection.style.display = 'flex';
  } else {
    battingSection.style.display = 'none';
  }

  // Pitching
  const pitchingSection = document.getElementById('wbscPitchingSection');
  const pitchingGrid    = document.getElementById('wbscPitchingGrid');
  pitchingGrid.innerHTML = '';

  if (stats.pitching && Object.keys(stats.pitching).length > 0) {
    const highlight = ['ERA','WHIP','SO','W','L','SV'];
    Object.entries(stats.pitching).forEach(([key, val]) => {
      const isHL = highlight.includes(key);
      pitchingGrid.innerHTML += `
        <div class="wbsc-stat">
          <div class="wbsc-stat-key">${key}</div>
          <div class="wbsc-stat-val ${isHL ? 'highlight' : ''}">${val}</div>
        </div>`;
    });
    pitchingSection.style.display = 'flex';
  } else {
    pitchingSection.style.display = 'none';
  }

  // Lien source
  document.getElementById('wbscSourceLink').href = stats.sourceUrl || '#';

  document.getElementById('wbscResults').style.display = 'block';
}

// ── SAVE TO PLAYER PROFILE ───────────────────────────────────
function saveWbscToProfile() {
  if (!wbscCurrentPid || !wbscLastStats) return;

  const url      = document.getElementById('wbscUrlInput').value.trim();
  const category = document.getElementById('wbscCategory').value;

  // Stocker l'URL et les stats dans le profil joueur
  if (!allPlayers[wbscCurrentPid]) return;
  allPlayers[wbscCurrentPid].wbscUrl      = url;
  allPlayers[wbscCurrentPid].wbscCategory = category;
  allPlayers[wbscCurrentPid].wbscStats    = wbscLastStats;
  allPlayers[wbscCurrentPid].wbscUpdated  = new Date().toISOString();

  saveConfig();
  setWbscMsg('✓ Sauvegardé dans le profil joueur', 'success');
  document.getElementById('wbscSaveBtn').textContent = '✓ Sauvegardé';
  setTimeout(() => {
    document.getElementById('wbscSaveBtn').textContent = '💾 Sauvegarder dans le profil';
  }, 2000);
}

// ── HELPER ───────────────────────────────────────────────────
function setWbscMsg(msg, type = '') {
  const el = document.getElementById('wbscMsg');
  el.textContent = msg;
  el.className   = type;
}
