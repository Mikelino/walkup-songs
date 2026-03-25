/* ============================================================
   Diamond Pulse — js/settings.js
   Page de configuration : équipes, interface, couleurs, fonts,
   positions, adversaires, mixer, intro, mot de passe

   Fonctions :
   - cfgSwitchTab(tab)
   - cfgRenderPositions(), cfgAddCustomPos(), cfgEditCustomPos()
   - cfgSavePosPron(), cfgDeleteCustomPos(), refreshNewPosSelect()
   - cfgHandleOppLogo(), cfgAddOpponent(), cfgRenderOpponents()
   - cfgUpdateOppLogo(), cfgDeleteOpponent(), refreshOpponentSelects()
   - getOpponentInfo(), openConfig(), closeConfig()
   - cfgRenderTeamList(), cfgAddTeam()
   - cfgOpenRenameModal(), cfgConfirmRename()
   - cfgOpenDeleteModal(), cfgConfirmDelete()
   - showCfgSaveIndicator()
   - ifLoadFontPair(), ifRenderFontGrid(), ifApplyFontPair(), ifSaveFonts()
   - ifInitPanel(), ifPreviewColor(), ifSaveIdentity(), ifSaveColors()
   - ifSaveDuration(), ifSaveIntro(), ifSaveVisitorIntro()
   - ifUploadIntroBg(), ifClearIntroBg(), ifHandleLogo()
   - mixerSetVol(), mixerToggleMute(), mixerOpen(), mixerClose()
   - ifSavePassword(), ifInitStoryBgs(), drawStoryBg()
   - shiftColor(), rgbToHex()

   Dépend de (globals) :
   - appSettings, clubSettings, teams, currentTeamId
   - saveConfig(), render(), updateTeamSelector()
   - ttsInitPanel(), ttsLoadElevenLabsVoices()
   ============================================================ */

function cfgSwitchTab(tab) {
  const tabs = { teams: 'Teams', interface: 'Interface', positions: 'Positions', opponents: 'Opponents', securite: 'Security' };
  document.querySelectorAll('.cfg-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('cfgNav' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.querySelectorAll('.config-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('cfgPanel' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.getElementById('cfgSubtitle').textContent = tabs[tab] || '';
  if (tab === 'interface') ifInitPanel();
  if (tab === 'positions') cfgRenderPositions();
  if (tab === 'opponents') cfgRenderOpponents();
}

// ── POSITIONS MANAGEMENT ──
const BASE_POSITIONS = [
  { code: 'P',  label: 'Pitcher' },
  { code: 'C',  label: 'Catcher' },
  { code: '1B', label: 'First Base' },
  { code: '2B', label: 'Second Base' },
  { code: '3B', label: 'Third Base' },
  { code: 'SS', label: 'Shortstop' },
  { code: 'LF', label: 'Left Field' },
  { code: 'CF', label: 'Center Field' },
  { code: 'RF', label: 'Right Field' },
];

function cfgRenderPositions() {
  // Base positions badges
  const baseList = document.getElementById('cfgBasePosList');
  if (baseList) {
    baseList.innerHTML = BASE_POSITIONS.map(p =>
      `<div style="display:inline-flex;align-items:center;gap:6px;background:var(--gray);border:1px solid var(--border);border-radius:3px;padding:6px 12px;">
        <span style="font-family:'Oswald',sans-serif;font-weight:700;font-size:14px;letter-spacing:1px;color:var(--orange)">${p.code}</span>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:1px;color:var(--muted);text-transform:uppercase">${p.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="color:#3a3a3a;flex-shrink:0"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
      </div>`
    ).join('');
  }

  // TTS Pronunciation list — all positions (base + custom)
  const pronList = document.getElementById('cfgPosPronList');
  if (pronList) {
    const allPos = [
      ...BASE_POSITIONS,
      ...(appSettings.extraPositions || [])
    ];
    const pron = appSettings.posPronunciations || {};
    pronList.innerHTML = allPos.map(p => `
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-family:'Oswald',sans-serif;font-weight:700;font-size:13px;letter-spacing:1px;color:var(--orange);min-width:36px;flex-shrink:0">${p.code}</span>
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;min-width:110px;flex-shrink:0">${p.label}</span>
        <input class="form-input" style="flex:1;padding:5px 10px;font-size:13px"
          placeholder="${p.label}"
          value="${pron[p.code] || ''}"
          oninput="cfgSavePosPron('${p.code}', this.value)"
          title="TTS pronunciation for ${p.code}" />
      </div>`
    ).join('');
  }

  // Custom positions list
  const customList = document.getElementById('cfgCustomPosList');
  if (!customList) return;
  customList.innerHTML = '';
  const extra = appSettings.extraPositions || [];
  if (extra.length === 0) {
    customList.innerHTML = `<div style="color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:2px;padding:20px;text-align:center;text-transform:uppercase;background:var(--darkgray);border:1px dashed var(--border)">No custom positions</div>`;
    return;
  }
  extra.forEach((pos, idx) => {
    const row = document.createElement('div');
    row.className = 'cfg-team-row';
    row.innerHTML = `
      <div class="cfg-team-info">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-family:'Oswald',sans-serif;font-weight:700;font-size:18px;letter-spacing:2px;color:var(--orange);min-width:36px">${pos.code}</span>
          <span id="cfgPosLabelDisplay_${idx}" style="font-family:'Barlow',sans-serif;font-size:14px;color:var(--offwhite)">${pos.label || '—'}</span>
        </div>
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:2px;color:var(--muted);margin-top:3px;text-transform:uppercase">${pos.multi ? 'Plusieurs players autorisés' : 'Unique position'}</div>
      </div>
      <div></div>
      <button class="cfg-team-action" title="Modifier" onclick="cfgEditCustomPos(${idx})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </button>
      <button class="cfg-team-action delete-action" title="Delete" onclick="cfgDeleteCustomPos(${idx})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    `;
    customList.appendChild(row);
  });
}

function cfgAddCustomPos() {
  const code = document.getElementById('cfgNewPosCode').value.trim().toUpperCase();
  const label = document.getElementById('cfgNewPosLabel').value.trim();
  const multi = document.getElementById('cfgNewPosMulti').checked;
  if (!code) { alert('Position code is required!'); return; }
  if (code.length > 4) { alert('Code must be 4 characters maximum.'); return; }
  const allCodes = [...BASE_POSITIONS.map(p => p.code), ...(appSettings.extraPositions || []).map(p => p.code)];
  if (allCodes.includes(code)) { alert(`Position "${code}" already exists.`); return; }
  if (!appSettings.extraPositions) appSettings.extraPositions = [];
  appSettings.extraPositions.push({ code, label, multi });
  document.getElementById('cfgNewPosCode').value = '';
  document.getElementById('cfgNewPosLabel').value = '';
  document.getElementById('cfgNewPosMulti').checked = false;
  cfgRenderPositions();
  refreshNewPosSelect();
  saveConfig();
}

function cfgEditCustomPos(idx) {
  const pos = (appSettings.extraPositions || [])[idx];
  if (!pos) return;
  const newLabel = prompt('New label for ' + pos.code + ' :', pos.label || '');
  if (newLabel === null) return;
  appSettings.extraPositions[idx].label = newLabel.trim();
  cfgRenderPositions();
  saveConfig();
}

function cfgSavePosPron(code, value) {
  if (!appSettings.posPronunciations) appSettings.posPronunciations = {};
  if (value.trim()) {
    appSettings.posPronunciations[code] = value.trim();
  } else {
    delete appSettings.posPronunciations[code];
  }
  saveConfig();
}

function cfgDeleteCustomPos(idx) {
  const pos = (appSettings.extraPositions || [])[idx];
  if (!pos) return;
  if (!confirm(`Delete position "${pos.code} — ${pos.label}"?`)) return;
  appSettings.extraPositions.splice(idx, 1);
  cfgRenderPositions();
  refreshNewPosSelect();
  render();
  saveConfig();
}

function refreshNewPosSelect() {
  const sel = document.getElementById('newPos');
  if (!sel) return;
  // Keep base options, remove any previously added extras, re-add current extras
  while (sel.options.length > 10) sel.remove(10); // 1 empty + 9 base
  const extra = appSettings.extraPositions || [];
  extra.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.code;
    opt.textContent = `${p.code}${p.label ? ' — ' + p.label : ''}`;
    sel.appendChild(opt);
  });
}

// ── OPPONENTS MANAGEMENT ──
let _cfgNewOppLogoDataURL = null;

function cfgHandleOppLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _cfgNewOppLogoDataURL = e.target.result;
    document.getElementById('cfgNewOppLogoImg').src = _cfgNewOppLogoDataURL;
    document.getElementById('cfgNewOppLogoPreview').style.display = 'block';
    document.getElementById('cfgNewOppLogoText').textContent = '🖼️ ' + file.name;
    document.getElementById('cfgNewOppLogoLabel').classList.add('has-file');
  };
  reader.readAsDataURL(file);
}

function cfgAddOpponent() {
  const name = document.getElementById('cfgNewOppName').value.trim();
  if (!name) { alert('Club name is required!'); return; }
  if (!appSettings.opponents) appSettings.opponents = [];
  const id = 'opp_' + Date.now();
  appSettings.opponents.push({ id, name, logo: _cfgNewOppLogoDataURL || null });
  // Reset form
  document.getElementById('cfgNewOppName').value = '';
  document.getElementById('cfgNewOppLogoFile').value = '';
  document.getElementById('cfgNewOppLogoText').textContent = '📂 Choose image…';
  document.getElementById('cfgNewOppLogoPreview').style.display = 'none';
  document.getElementById('cfgNewOppLogoLabel').classList.remove('has-file');
  _cfgNewOppLogoDataURL = null;
  cfgRenderOpponents();
  refreshOpponentSelects();
  saveConfig();
  showCfgSaveIndicator();
}

function cfgRenderOpponents() {
  const container = document.getElementById('cfgOpponentList');
  if (!container) return;
  const opponents = appSettings.opponents || [];
  if (opponents.length === 0) {
    container.innerHTML = `<div style="color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:13px;letter-spacing:2px;padding:20px;text-align:center;text-transform:uppercase;background:var(--darkgray);border:1px dashed var(--border)">No opponents added yet</div>`;
    return;
  }
  container.innerHTML = '';
  opponents.forEach((opp, idx) => {
    const row = document.createElement('div');
    row.className = 'cfg-team-row';
    row.innerHTML = `
      <div class="cfg-team-info" style="display:flex;align-items:center;gap:14px">
        <div style="width:44px;height:44px;border-radius:4px;border:1px solid var(--border);background:var(--gray);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          ${opp.logo
            ? `<img src="${opp.logo}" style="width:100%;height:100%;object-fit:contain;padding:4px" />`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="color:var(--border)"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`
          }
        </div>
        <div>
          <div class="cfg-team-name">${opp.name}</div>
          <div class="cfg-team-key">${opp.logo ? 'Logo uploaded' : 'No logo'}</div>
        </div>
      </div>
      <div></div>
      <label class="cfg-team-action" title="Change logo" style="cursor:pointer">
        📷
        <input type="file" accept="image/*" style="display:none" onchange="cfgUpdateOppLogo(this, '${opp.id}')" />
      </label>
      <button class="cfg-team-action delete-action" title="Delete" onclick="cfgDeleteOpponent('${opp.id}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    `;
    container.appendChild(row);
  });
}

function cfgUpdateOppLogo(input, id) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const opp = (appSettings.opponents || []).find(o => o.id === id);
    if (!opp) return;
    opp.logo = e.target.result;
    cfgRenderOpponents();
    refreshOpponentSelects();
    saveConfig();
    showCfgSaveIndicator();
  };
  reader.readAsDataURL(file);
}

function cfgDeleteOpponent(id) {
  const opp = (appSettings.opponents || []).find(o => o.id === id);
  if (!opp) return;
  if (!confirm(`Delete opponent "${opp.name}"?`)) return;
  appSettings.opponents = appSettings.opponents.filter(o => o.id !== id);
  cfgRenderOpponents();
  refreshOpponentSelects();
  saveConfig();
  showCfgSaveIndicator();
}

function refreshOpponentSelects() {
  ['storyOpponentSelect', 'scoreOpponentSelect'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = '<option value="">— Manual entry —</option>';
    (appSettings.opponents || []).forEach(opp => {
      const opt = document.createElement('option');
      opt.value = opp.id;
      opt.textContent = opp.name;
      sel.appendChild(opt);
    });
    sel.value = current;
    // Trigger UI update
    sel.dispatchEvent(new Event('change'));
  });
}

function getOpponentInfo(selectId, inputId) {
  const sel = document.getElementById(selectId);
  const inp = document.getElementById(inputId);
  if (sel && sel.value) {
    const opp = (appSettings.opponents || []).find(o => o.id === sel.value);
    return opp || { name: inp?.value?.trim() || 'Opponent', logo: null };
  }
  return { name: inp?.value?.trim() || 'Opponent', logo: null };
}

function openConfig() {
  // Demander le mot de passe si pas encore déverrouillé
  if (!cfgAdminUnlocked) {
    const pwd = prompt('Admin password:');
    if (pwd !== appSettings.adminPassword) {
      alert('Incorrect password.');
      return;
    }
    cfgAdminUnlocked = true;
  }
  // Stopper la lecture
  stopPlayback();
  // Afficher la page config
  document.getElementById('configPage').style.display = 'flex';
  document.getElementById('configPage').style.flexDirection = 'column';
  // Reset champs ajout
  document.getElementById('cfgNewTeamName').value = '';
  document.getElementById('cfgNewTeamKey').value = '';
  // Auto-remplir la clé depuis le nom
  document.getElementById('cfgNewTeamName').oninput = function() {
    const k = this.value.trim().replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
    document.getElementById('cfgNewTeamKey').value = k;
  };
  cfgRenderTeamList();
  refreshOpponentSelects();
  cfgSwitchTab('teams');
}

function closeConfig() {
  document.getElementById('configPage').style.display = 'none';
}

function cfgRenderTeamList() {
  const container = document.getElementById('cfgTeamList');
  container.innerHTML = '';

  const entries = Object.entries(teams);
  if (entries.length === 0) {
    container.innerHTML = '<div style="color:var(--muted);font-family:Barlow Condensed,sans-serif;font-size:13px;letter-spacing:2px;padding:20px;text-align:center;text-transform:uppercase;">No team</div>';
    return;
  }

  entries.forEach(([key, team]) => {
    const isCurrent = key === currentTeamId;
    const playerCount = team.lineup ? team.lineup.length : 0;
    const row = document.createElement('div');
    row.className = 'cfg-team-row' + (isCurrent ? ' current-team' : '');

    row.innerHTML = `
      <div class="cfg-team-info">
        <div class="cfg-team-name">${team.label}</div>
        <div class="cfg-team-key">ID: ${key}</div>
        <div class="cfg-team-count">${playerCount} player${playerCount !== 1 ? 's' : ''}</div>
      </div>
      ${isCurrent ? '<div class="cfg-current-badge">Active</div>' : '<div></div>'}
      <button class="cfg-team-action" title="Rename" onclick="cfgOpenRenameModal('${key}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
      </button>
      <button class="cfg-team-action delete-action" title="Delete" ${entries.length <= 1 ? 'disabled style="opacity:0.3;cursor:not-allowed"' : ''} onclick="cfgOpenDeleteModal('${key}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
      </button>
    `;

    container.appendChild(row);
  });
}

function cfgAddTeam() {
  const name = document.getElementById('cfgNewTeamName').value.trim();
  let key = document.getElementById('cfgNewTeamKey').value.trim().replace(/[^a-zA-Z0-9]/g, '');

  if (!name) { alert('Team name is required.'); return; }
  if (!key) { key = name.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, ''); }
  if (!key) { alert('L\'identifiant court est invalide.'); return; }
  if (teams[key]) { alert(`A team with ID "${key}" already exists!`); return; }

  teams[key] = { label: name, lineup: [] };
  updateTeamSelector();
  switchTeam(key);
  saveConfig();

  document.getElementById('cfgNewTeamName').value = '';
  document.getElementById('cfgNewTeamKey').value = '';
  cfgRenderTeamList();

  // Flash success
  const btn = document.querySelector('#configPage .add-btn');
  const orig = btn.textContent;
  btn.textContent = '✓ Créée !';
  btn.style.background = '#1a5c1a';
  setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1800);
}

// ── MODAL RENAME ──
function cfgOpenRenameModal(key) {
  cfgRenameTargetKey = key;
  document.getElementById('renameInput').value = teams[key].label;
  document.getElementById('renameModal').style.display = 'flex';
  setTimeout(() => document.getElementById('renameInput').focus(), 50);
}

function cfgCloseRenameModal(e) {
  if (e && e.target !== document.getElementById('renameModal')) return;
  document.getElementById('renameModal').style.display = 'none';
  cfgRenameTargetKey = null;
}

function cfgConfirmRename() {
  const key = cfgRenameTargetKey;
  if (!key || !teams[key]) return;
  const newName = document.getElementById('renameInput').value.trim();
  if (!newName) { alert('Le nom ne peut pas être vide.'); return; }

  teams[key].label = newName;
  updateTeamSelector();
  if (key === currentTeamId) {
    document.getElementById('sectionLabel').textContent = '⚾ Batting Order — ' + newName;
  }
  saveConfig();
  cfgRenderTeamList();
  document.getElementById('renameModal').style.display = 'none';
  cfgRenameTargetKey = null;
  showCfgSaveIndicator();
}

// ── MODAL DELETE ──
function cfgOpenDeleteModal(key) {
  const allKeys = Object.keys(teams);
  if (allKeys.length <= 1) {
    alert('Cannot delete the last team.');
    return;
  }
  cfgDeleteTargetKey = key;
  document.getElementById('deleteModalBody').textContent =
    `Are you sure you want to delete the team "${teams[key].label}"?`;
  document.getElementById('deleteModal').style.display = 'flex';
}

function cfgCloseDeleteModal(e) {
  if (e && e.target !== document.getElementById('deleteModal')) return;
  document.getElementById('deleteModal').style.display = 'none';
  cfgDeleteTargetKey = null;
}

function cfgConfirmDelete() {
  const key = cfgDeleteTargetKey;
  if (!key || !teams[key]) return;

  delete teams[key];
  const nextKey = Object.keys(teams)[0];
  updateTeamSelector();
  switchTeam(nextKey);
  saveConfig();
  cfgRenderTeamList();
  document.getElementById('deleteModal').style.display = 'none';
  cfgDeleteTargetKey = null;
  showCfgSaveIndicator();
}

function showCfgSaveIndicator() {
  const el = document.getElementById('configSaveIndicator');
  el.textContent = '✓ Saved';
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2000);
}

// ═══════════════════════════════════════════
// ONGLET INTERFACE — JS
// ═══════════════════════════════════════════
let ifLogoDataURL = null;

// Appelé à l'ouverture de l'onglet Interface pour pré-remplir les champs
// ── FONTS ──
const FONT_PAIRS = [
  {
    id: 'default',
    name: 'Sport Classic',
    desc: 'Oswald + Barlow',
    fontTitle: 'Oswald',
    fontBody: 'Barlow',
    googleUrl: null, // déjà chargées
  },
  {
    id: 'bebas',
    name: 'Impact Modern',
    desc: 'Bebas Neue + Inter',
    fontTitle: 'Bebas Neue',
    fontBody: 'Inter',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap',
  },
  {
    id: 'rajdhani',
    name: 'Tech Arena',
    desc: 'Rajdhani + Roboto',
    fontTitle: 'Rajdhani',
    fontBody: 'Roboto',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Roboto:wght@400;500&display=swap',
  },
  {
    id: 'blackops',
    name: 'Military Draft',
    desc: 'Black Ops One + Source Sans Pro',
    fontTitle: 'Black Ops One',
    fontBody: 'Source Sans Pro',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Source+Sans+Pro:wght@400;600&display=swap',
  },
  {
    id: 'anton',
    name: 'Press Box',
    desc: 'Anton + Lato',
    fontTitle: 'Anton',
    fontBody: 'Lato',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Anton&family=Lato:wght@400;700&display=swap',
  },
  {
    id: 'teko',
    name: 'Stadium',
    desc: 'Teko + Open Sans',
    fontTitle: 'Teko',
    fontBody: 'Open Sans',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Teko:wght@600;700&family=Open+Sans:wght@400;600&display=swap',
  },
  {
    id: 'graduate',
    name: 'College',
    desc: 'Graduate + Nunito',
    fontTitle: 'Graduate',
    fontBody: 'Nunito',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Graduate&family=Nunito:wght@400;600&display=swap',
  },
  {
    id: 'exo',
    name: 'Cyber League',
    desc: 'Exo 2 + DM Sans',
    fontTitle: 'Exo 2',
    fontBody: 'DM Sans',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Exo+2:wght@600;700;800&family=DM+Sans:wght@400;500&display=swap',
  },
];

let selectedFontId = 'default';

function ifLoadFontPair(pair) {
  if (!pair.googleUrl) return Promise.resolve();
  if (document.querySelector(`link[data-font-id="${pair.id}"]`)) return Promise.resolve();
  return new Promise(resolve => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = pair.googleUrl;
    link.dataset.fontId = pair.id;
    link.onload = resolve;
    link.onerror = resolve;
    document.head.appendChild(link);
  });
}

async function ifRenderFontGrid() {
  const grid = document.getElementById('ifFontGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (const pair of FONT_PAIRS) {
    await ifLoadFontPair(pair);
    const card = document.createElement('div');
    const isSelected = selectedFontId === pair.id;
    card.style.cssText = `
      background:var(--gray);border:2px solid ${isSelected ? 'var(--orange)' : 'var(--border)'};
      border-radius:4px;padding:14px 16px;cursor:pointer;transition:all 0.15s;
      ${isSelected ? 'background:accentAlpha(0.08)' : ''}
    `;
    card.innerHTML = `
      <div style="font-family:'${pair.fontTitle}',sans-serif;font-size:18px;font-weight:700;letter-spacing:2px;color:${isSelected ? 'var(--orange)' : '#fff'};text-transform:uppercase;line-height:1.1">${pair.name}</div>
      <div style="font-family:'${pair.fontBody}',sans-serif;font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px;letter-spacing:1px">${pair.desc}</div>
      <div style="font-family:'${pair.fontBody}',sans-serif;font-size:12px;color:rgba(255,255,255,0.55);margin-top:8px">John Smith · #7</div>
    `;
    card.addEventListener('click', async () => {
      selectedFontId = pair.id;
      ifUpdateFontPreview(pair);
      await ifRenderFontGrid();
    });
    grid.appendChild(card);
  }
}

function ifUpdateFontPreview(pair) {
  const title = document.getElementById('ifFontPreviewTitle');
  const sub   = document.getElementById('ifFontPreviewSub');
  const body  = document.getElementById('ifFontPreviewBody');
  if (title) title.style.fontFamily = `'${pair.fontTitle}', sans-serif`;
  if (sub)   sub.style.fontFamily   = `'${pair.fontTitle}', sans-serif`;
  if (body)  body.style.fontFamily  = `'${pair.fontBody}', sans-serif`;
}

function ifApplyFontPair(pair) {
  document.documentElement.style.setProperty('--font-title', `'${pair.fontTitle}', sans-serif`);
  document.documentElement.style.setProperty('--font-body',  `'${pair.fontBody}', sans-serif`);
  // Appliquer directement aux éléments ciblés
  document.querySelectorAll('.header-club,.order-num,.player-name,.jersey-num,.now-name,.song-title,.cfg-team-name,.config-title-main,.main-nav-label,.cfg-nav-label,.player-avatar,.pos-select').forEach(el => {
    el.style.fontFamily = `'${pair.fontTitle}', sans-serif`;
  });
  document.querySelectorAll('.header-sub,.now-label,.now-song,.song-artist,.form-label,.section-label,.player-pos,.barlow,.cfg-team-key,.cfg-team-count,.config-title-sub').forEach(el => {
    el.style.fontFamily = `'${pair.fontBody}', sans-serif`;
  });
}

async function ifSaveFonts() {
  const pair = FONT_PAIRS.find(p => p.id === selectedFontId);
  if (!pair) return;
  await ifLoadFontPair(pair);
  ifApplyFontPair(pair);
  appSettings.fontPairId = pair.id;
  saveConfig();
  showCfgSaveIndicator();
}

function ifResetFonts() {
  selectedFontId = 'default';
  const pair = FONT_PAIRS[0];
  ifApplyFontPair(pair);
  ifUpdateFontPreview(pair);
  ifRenderFontGrid();
  delete appSettings.fontPairId;
  saveConfig();
  showCfgSaveIndicator();
}

function ifSwitchSub(sub) {
  document.querySelectorAll('.if-sub-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.if-sub-panel').forEach(p => p.classList.remove('active'));
  const cap = sub.charAt(0).toUpperCase() + sub.slice(1);
  document.getElementById('ifSubBtn'   + cap)?.classList.add('active');
  document.getElementById('ifSubPanel' + cap)?.classList.add('active');
  if (sub === 'appearance') {
    selectedFontId = appSettings.fontPairId || 'default';
    const activePair = FONT_PAIRS.find(p => p.id === selectedFontId) || FONT_PAIRS[0];
    ifUpdateFontPreview(activePair);
    ifRenderFontGrid();
  }
}

function ifInitPanel() {
  // Reset to first sub-tab
  ifSwitchSub('identity');

  // Identity
  document.getElementById('ifClubName').value    = clubSettings.name    || '';
  document.getElementById('ifClubSub').value     = clubSettings.sub     || '';
  document.getElementById('ifClubWebsite').value = clubSettings.website || '';
  ifInitStoryBgs();
  if (clubSettings.logo) {
    document.getElementById('ifLogoImg').src = clubSettings.logo;
    document.getElementById('ifLogoPreview').style.display = 'block';
    document.getElementById('ifLogoText').textContent = '🖼️ Logo saved';
    document.getElementById('ifLogoLabel').classList.add('has-file');
  }

  // Colors
  const style = getComputedStyle(document.documentElement);
  const accentVal = rgbToHex(style.getPropertyValue('--orange').trim()) || '#FF4500';
  const bg        = rgbToHex(style.getPropertyValue('--black').trim())  || '#0a0a0a';
  document.getElementById('ifColorAccent').value = accentVal;
  document.getElementById('ifColorBg').value = bg;
  document.getElementById('ifColorAccentHex').textContent = accentVal;
  document.getElementById('ifColorBgHex').textContent = bg;
  ifPreviewColor();

  // Playback duration
  document.getElementById('ifDuration').value = PLAY_DURATION;
  document.getElementById('ifDurationVal').textContent = PLAY_DURATION;

  // Team Intro
  const intro = appSettings.intro || {};
  document.getElementById('ifIntroText').value = intro.openingText || '';
  ifIntroRestSetUI(intro.showRestOfTeam !== false);
  // Volumes
  const ttsVol = intro.volTTS !== undefined ? intro.volTTS : 100;
  const bgVol  = intro.volBG  !== undefined ? intro.volBG  : 40;
  document.getElementById('ifIntroVolTTS').value = ttsVol;
  document.getElementById('ifIntroVolTTSVal').textContent = ttsVol + '%';
  document.getElementById('ifIntroVolBG').value  = bgVol;
  document.getElementById('ifIntroVolBGVal').textContent  = bgVol + '%';
  // BG music status
  if (intro.bgMusic) {
    document.getElementById('ifIntroBgLabel').textContent = '📂 Replace MP3';
    document.getElementById('ifIntroBgStatus').textContent = '✅ File loaded';
    document.getElementById('ifIntroBgClear').style.display = '';
  }

  // Visitor Intro
  const vi = appSettings.visitorIntro || {};
  document.getElementById('ifVisitorText').value = vi.openingText || '';
  const viTtsVol = vi.volTTS !== undefined ? vi.volTTS : 100;
  const viBgVol  = vi.volBG  !== undefined ? vi.volBG  : 40;
  document.getElementById('ifVisitorVolTTS').value = viTtsVol;
  document.getElementById('ifVisitorVolTTSVal').textContent = viTtsVol + '%';
  document.getElementById('ifVisitorVolBG').value  = viBgVol;
  document.getElementById('ifVisitorVolBGVal').textContent  = viBgVol + '%';
  if (vi.bgMusic) {
    document.getElementById('ifVisitorBgLabel').textContent = '📂 Replace MP3';
    document.getElementById('ifVisitorBgStatus').textContent = '✅ File loaded';
    document.getElementById('ifVisitorBgClear').style.display = '';
  }

  // TTS
  ttsInitPanel();
}

// Convertit "rgb(r,g,b)" ou "#hex" en "#rrggbb"
function rgbToHex(color) {
  if (!color) return null;
  if (color.startsWith('#')) return color.length === 4
    ? '#' + [...color.slice(1)].map(c => c+c).join('') : color;
  const m = color.match(/\d+/g);
  if (!m || m.length < 3) return null;
  return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
}

function ifPreviewColor() {
  const accent = document.getElementById('ifColorAccent').value;
  const bg     = document.getElementById('ifColorBg').value;
  document.getElementById('ifColorAccentHex').textContent = accent;
  document.getElementById('ifColorBgHex').textContent = bg;
  document.getElementById('ifPreviewBar').style.background = accent;
  document.getElementById('ifPreviewLabel').style.color = '#ffffff';
  document.getElementById('ifColorPreview').style.background = bg;
  document.getElementById('ifColorPreview').style.borderColor = accent + '55';
}

function ifHandleStoryBg(input, type) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const key = 'bg' + type.charAt(0).toUpperCase() + type.slice(1);
    clubSettings[key] = dataUrl;

    // Miniature preview
    const preview = document.getElementById('bgPreview' + type.charAt(0).toUpperCase() + type.slice(1));
    preview.innerHTML = `<img src="${dataUrl}" alt="bg" />`;

    // Sub-label
    document.getElementById('bgSub' + type.charAt(0).toUpperCase() + type.slice(1)).textContent = file.name;

    // Bouton clear
    document.getElementById('bgClear' + type.charAt(0).toUpperCase() + type.slice(1)).style.display = 'flex';

    saveConfig();
    showCfgSaveIndicator();
  };
  reader.readAsDataURL(file);
}

function ifClearStoryBg(type) {
  const key = 'bg' + type.charAt(0).toUpperCase() + type.slice(1);
  clubSettings[key] = null;

  const capType = type.charAt(0).toUpperCase() + type.slice(1);
  const preview = document.getElementById('bgPreview' + capType);
  preview.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;
  document.getElementById('bgSub' + capType).textContent = 'No background loaded';
  document.getElementById('bgClear' + capType).style.display = 'none';

  saveConfig();
  showCfgSaveIndicator();
}

function ifInitStoryBgs() {
  ['lineup','score','mvp'].forEach(type => {
    const key = 'bg' + type.charAt(0).toUpperCase() + type.slice(1);
    const capType = type.charAt(0).toUpperCase() + type.slice(1);
    if (clubSettings[key]) {
      const preview = document.getElementById('bgPreview' + capType);
      if (preview) preview.innerHTML = `<img src="${clubSettings[key]}" alt="bg" />`;
      const sub = document.getElementById('bgSub' + capType);
      if (sub) sub.textContent = 'Background loaded ✓';
      const clearBtn = document.getElementById('bgClear' + capType);
      if (clearBtn) clearBtn.style.display = 'flex';
    }
  });
}

// Utilitaire : dessine un background custom sur le canvas
async function drawStoryBg(ctx, W, H, bgDataUrl, overlayOpacity = 0.55) {
  if (bgDataUrl) {
    const bgImg = new Image();
    await new Promise(r => { bgImg.onload = r; bgImg.onerror = r; bgImg.src = bgDataUrl; });
    if (bgImg.naturalWidth > 0) {
      // Cover : remplir le canvas en gardant les proportions
      const scale = Math.max(W / bgImg.naturalWidth, H / bgImg.naturalHeight);
      const sw = bgImg.naturalWidth * scale;
      const sh = bgImg.naturalHeight * scale;
      ctx.drawImage(bgImg, (W - sw) / 2, (H - sh) / 2, sw, sh);
      // Overlay semi-transparent pour lisibilité
      ctx.fillStyle = `rgba(0,0,0,${overlayOpacity})`;
      ctx.fillRect(0, 0, W, H);
      return true;
    }
  }
  return false;
}

function ifHandleLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    ifLogoDataURL = e.target.result;
    document.getElementById('ifLogoImg').src = ifLogoDataURL;
    document.getElementById('ifLogoPreview').style.display = 'block';
    document.getElementById('ifLogoText').textContent = '🖼️ ' + file.name;
    document.getElementById('ifLogoLabel').classList.add('has-file');
    // Aperçu live dans le header
    const img = document.getElementById('headerLogoImg');
    const svg = document.getElementById('headerLogoSvg');
    if (img && svg) { img.src = ifLogoDataURL; img.style.display = 'block'; svg.style.display = 'none'; }
  };
  reader.readAsDataURL(file);
}

function ifSaveIdentity() {
  const name    = document.getElementById('ifClubName').value.trim();
  const sub     = document.getElementById('ifClubSub').value.trim();
  const website = document.getElementById('ifClubWebsite').value.trim();

  if (name)    clubSettings.name    = name;
  if (sub)     clubSettings.sub     = sub;
  if (website) clubSettings.website = website;
  if (ifLogoDataURL) clubSettings.logo = ifLogoDataURL;

  applyClubSettings();
  saveConfig();
  showCfgSaveIndicator();
}

function ifSaveColors() {
  const accent = document.getElementById('ifColorAccent').value;
  const bg     = document.getElementById('ifColorBg').value;

  // Calcul dérivés
  const darken = (hex, amt) => {
    let [r,g,b] = hex.match(/\w\w/g).map(x=>parseInt(x,16));
    return '#'+[r,g,b].map(c=>Math.max(0,c-amt).toString(16).padStart(2,'0')).join('');
  };

  document.documentElement.style.setProperty('--orange', accent);
  document.documentElement.style.setProperty('--orange-dark', darken(accent, 50));
  document.documentElement.style.setProperty('--orange-glow',
    `rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)},0.25)`);
  document.documentElement.style.setProperty('--orange-avatar',
    `rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)},0.5)`);
  document.documentElement.style.setProperty('--black', bg);
  document.documentElement.style.setProperty('--darkgray', shiftColor(bg, 10));

  // Persister dans appSettings
  appSettings.colorAccent = accent;
  appSettings.colorBg     = bg;
  saveConfig();

  showCfgSaveIndicator();
}

function shiftColor(hex, amt) {
  let [r,g,b] = hex.match(/\w\w/g).map(x=>parseInt(x,16));
  return '#'+[r,g,b].map(c=>Math.min(255,c+amt).toString(16).padStart(2,'0')).join('');
}

function ifResetColors() {
  document.documentElement.style.removeProperty('--orange');
  document.documentElement.style.removeProperty('--orange-dark');
  document.documentElement.style.removeProperty('--orange-glow');
  document.documentElement.style.removeProperty('--orange-avatar');
  document.documentElement.style.removeProperty('--black');
  document.documentElement.style.removeProperty('--darkgray');
  document.getElementById('ifColorAccent').value = accent;
  document.getElementById('ifColorBg').value = '#0a0a0a';
  ifPreviewColor();

  delete appSettings.colorAccent;
  delete appSettings.colorBg;
  saveConfig();

  showCfgSaveIndicator();
}

function ifSaveDuration() {
  const val = parseInt(document.getElementById('ifDuration').value);
  if (val >= 5 && val <= 60) {
    PLAY_DURATION = val;
    appSettings.playDuration = val;
    saveConfig();
    showCfgSaveIndicator();
  }
}

function ifIntroRestSetUI(on) {
  const toggle = document.getElementById('ifIntroRestToggle');
  const knob   = document.getElementById('ifIntroRestKnob');
  if (!toggle || !knob) return;
  toggle.style.background = on ? 'var(--orange)' : 'var(--border)';
  knob.style.left = on ? '22px' : '2px';
  toggle.dataset.on = on ? '1' : '0';
}

function ifIntroRestToggleClick() {
  const on = document.getElementById('ifIntroRestToggle').dataset.on !== '1';
  ifIntroRestSetUI(on);
}

async function ifUploadIntroBg(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const statusEl = document.getElementById('ifIntroBgStatus');
  const labelEl  = document.getElementById('ifIntroBgLabel');
  statusEl.textContent = '⏳ Uploading…';
  try {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `intro/bg.${ext}`;
    let res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' },
      body: file,
    });
    if (!res.ok && res.status === 409) {
      res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' },
        body: file,
      });
    }
    if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error(e?.message || `HTTP ${res.status}`); }
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    if (!appSettings.intro) appSettings.intro = {};
    appSettings.intro.bgMusic = url;
    saveConfig();
    labelEl.textContent = '📂 Replace MP3';
    statusEl.textContent = '✅ ' + file.name;
    document.getElementById('ifIntroBgClear').style.display = '';
  } catch(e) {
    statusEl.textContent = '❌ Error: ' + e.message;
  }
}

function ifClearIntroBg() {
  if (!appSettings.intro) appSettings.intro = {};
  appSettings.intro.bgMusic = null;
  saveConfig();
  document.getElementById('ifIntroBgLabel').textContent = 'Upload MP3';
  document.getElementById('ifIntroBgStatus').textContent = '';
  document.getElementById('ifIntroBgClear').style.display = 'none';
}

// ── MIXER ──
const mixerState = { ttsMuted: false, bgMuted: false, ttsVol: 1, bgVol: 0.4 };

function mixerSetVol(chan, val) {
  const v = parseInt(val) / 100;
  document.getElementById(`mixerVol${chan === 'tts' ? 'TTS' : 'BG'}Val`).textContent = val + '%';
  if (chan === 'tts') {
    mixerState.ttsVol = v;
    mixerState.ttsMuted = false;
    document.getElementById('mixerMuteTTS').style.opacity = '1';
    // Apply to current speech (WebSpeech doesn't allow volume change mid-utterance,
    // but store for next utterance)
  } else {
    mixerState.bgVol = v;
    mixerState.bgMuted = false;
    document.getElementById('mixerMuteBG').style.opacity = '1';
    if (introState._bgAudio) introState._bgAudio.volume = v;
  }
}

function mixerToggleMute(chan) {
  if (chan === 'tts') {
    mixerState.ttsMuted = !mixerState.ttsMuted;
    document.getElementById('mixerMuteTTS').style.opacity = mixerState.ttsMuted ? '0.3' : '1';
  } else {
    mixerState.bgMuted = !mixerState.bgMuted;
    document.getElementById('mixerMuteBG').style.opacity = mixerState.bgMuted ? '0.3' : '1';
    if (introState._bgAudio) introState._bgAudio.volume = mixerState.bgMuted ? 0 : mixerState.bgVol;
  }
}

function mixerOpen() {
  const intro = appSettings.intro || {};
  const ttsVol = intro.volTTS !== undefined ? intro.volTTS : 100;
  const bgVol  = intro.volBG  !== undefined ? intro.volBG  : 40;
  mixerState.ttsVol = ttsVol / 100;
  mixerState.bgVol  = bgVol  / 100;
  mixerState.ttsMuted = false;
  mixerState.bgMuted  = false;
  document.getElementById('mixerVolTTS').value    = ttsVol;
  document.getElementById('mixerVolTTSVal').textContent = ttsVol + '%';
  document.getElementById('mixerVolBG').value     = bgVol;
  document.getElementById('mixerVolBGVal').textContent  = bgVol + '%';
  document.getElementById('mixerMuteTTS').style.opacity = '1';
  document.getElementById('mixerMuteBG').style.opacity  = '1';
  const hasBg = !!(appSettings.intro || {}).bgMusic;
  document.getElementById('mixerMuteBG').closest('div').style.opacity = hasBg ? '1' : '0.3';
  document.getElementById('mixerVolBG').disabled = !hasBg;
  document.getElementById('introMixer').style.display = 'block';
}

function mixerClose() {
  document.getElementById('introMixer').style.display = 'none';
}

function ifSaveIntro() {
  if (!appSettings.intro) appSettings.intro = {};
  appSettings.intro.openingText    = document.getElementById('ifIntroText').value.trim();
  appSettings.intro.showRestOfTeam = document.getElementById('ifIntroRestToggle').dataset.on === '1';
  appSettings.intro.volTTS         = parseInt(document.getElementById('ifIntroVolTTS').value);
  appSettings.intro.volBG          = parseInt(document.getElementById('ifIntroVolBG').value);
  saveConfig();
  showCfgSaveIndicator();
}

function ifSaveVisitorIntro() {
  if (!appSettings.visitorIntro) appSettings.visitorIntro = {};
  appSettings.visitorIntro.openingText = document.getElementById('ifVisitorText').value.trim();
  appSettings.visitorIntro.volTTS      = parseInt(document.getElementById('ifVisitorVolTTS').value);
  appSettings.visitorIntro.volBG       = parseInt(document.getElementById('ifVisitorVolBG').value);
  saveConfig();
  showCfgSaveIndicator();
}

async function ifUploadVisitorBg(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const statusEl = document.getElementById('ifVisitorBgStatus');
  const labelEl  = document.getElementById('ifVisitorBgLabel');
  statusEl.textContent = '⏳ Uploading…';
  try {
    const ext  = file.name.split('.').pop().toLowerCase();
    const path = `intro/visitor-bg.${ext}`;
    let res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' },
      body: file,
    });
    if (!res.ok && res.status === 409) {
      res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' },
        body: file,
      });
    }
    if (!res.ok) { const e = await res.json().catch(()=>{}); throw new Error(e?.message || `HTTP ${res.status}`); }
    const url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    if (!appSettings.visitorIntro) appSettings.visitorIntro = {};
    appSettings.visitorIntro.bgMusic = url;
    saveConfig();
    labelEl.textContent = '📂 Replace MP3';
    statusEl.textContent = '✅ ' + file.name;
    document.getElementById('ifVisitorBgClear').style.display = '';
  } catch(e) {
    statusEl.textContent = '❌ Error: ' + e.message;
  }
}

function ifClearVisitorBg() {
  if (!appSettings.visitorIntro) appSettings.visitorIntro = {};
  appSettings.visitorIntro.bgMusic = null;
  saveConfig();
  document.getElementById('ifVisitorBgLabel').textContent = 'Upload MP3';
  document.getElementById('ifVisitorBgStatus').textContent = '';
  document.getElementById('ifVisitorBgClear').style.display = 'none';
}

async function ifTestVisitorTTS(btn) {
  const text = document.getElementById('ifVisitorText').value.trim();
  if (!text) return;
  if (btn.dataset.playing) {
    if (window.speechSynthesis) speechSynthesis.cancel();
    btn.dataset.playing = '';
    btn.textContent = '▶ Test TTS';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--muted)';
    return;
  }
  btn.dataset.playing = '1';
  btn.textContent = '■ Stop';
  btn.style.borderColor = 'var(--orange)';
  btn.style.color = 'var(--orange)';
  try { await ttsSpeak(text); } catch(e) {}
  btn.dataset.playing = '';
  btn.textContent = '▶ Test TTS';
  btn.style.borderColor = 'var(--border)';
  btn.style.color = 'var(--muted)';
}

async function ifTestIntroTTS(btn) {
  const text = document.getElementById('ifIntroText').value.trim();
  if (!text) return;
  if (btn.dataset.playing) {
    if (window.speechSynthesis) speechSynthesis.cancel();
    btn.dataset.playing = '';
    btn.textContent = '▶ Test TTS';
    btn.style.borderColor = 'var(--border)';
    btn.style.color = 'var(--muted)';
    return;
  }
  btn.dataset.playing = '1';
  btn.textContent = '■ Stop';
  btn.style.borderColor = 'var(--orange)';
  btn.style.color = 'var(--orange)';
  try { await ttsSpeak(text); } catch(e) {}
  btn.dataset.playing = '';
  btn.textContent = '▶ Test TTS';
  btn.style.borderColor = 'var(--border)';
  btn.style.color = 'var(--muted)';
}

// ── TTS — ANNOUNCEMENTS ──

function ttsInitPanel() {
  const t = appSettings.tts || {};
  ttsSetToggleUI(!!t.enabled);
  ttsSetGroupsVisible(!!t.enabled);
  const tmpl = document.getElementById('ttsTemplate');
  if (tmpl) tmpl.value = t.template || TTS_TEMPLATES['en'];
  const eng = document.getElementById('ttsEngine');
  if (eng) { eng.value = t.engine || 'webspeech'; ttsEngineChanged(); }
  const langSel = document.getElementById('ttsLang');
  if (langSel) langSel.value = t.lang || 'en';
  const fade = document.getElementById('ttsFade');
  if (fade) { fade.value = t.fadeDelay ?? 1.5; document.getElementById('ttsFadeVal').textContent = fade.value; }
  const key = document.getElementById('ttsOpenAIKey');
  if (key) key.value = t.openAIKey || '';
  const oVoice = document.getElementById('ttsOpenAIVoice');
  if (oVoice) oVoice.value = t.openAIVoice || 'onyx';
  const elKey = document.getElementById('ttsElevenLabsKey');
  if (elKey) elKey.value = t.elevenLabsKey || '';
  const elVoice = document.getElementById('ttsElevenLabsVoice');
  if (elVoice && t.elevenLabsVoice) elVoice.value = t.elevenLabsVoice;
  const elLang = document.getElementById('ttsElevenLabsLang');
  if (elLang) elLang.value = t.elevenLabsLang || '';
  ttsPopulateVoices();
}

function ttsSetToggleUI(on) {
  const toggle = document.getElementById('ttsToggle');
  const knob   = document.getElementById('ttsToggleKnob');
  if (!toggle || !knob) return;
  toggle.style.background = on ? 'var(--orange)' : 'var(--border)';
  knob.style.left = on ? '22px' : '2px';
}

function ttsSetGroupsVisible(on) {
  ['ttsSettingsGroup','ttsEngineGroup','ttsVoiceGroup','ttsFadeGroup','ttsTestGroup','ttsOpenAIGroup'].forEach(id => {
    const el = document.getElementById(id);
    if (el && id !== 'ttsOpenAIGroup') el.style.opacity = on ? '1' : '0.35';
    if (el && id !== 'ttsOpenAIGroup') el.style.pointerEvents = on ? '' : 'none';
  });
  if (on) ttsEngineChanged();
}

function ttsToggleEnabled() {
  const t = appSettings.tts = appSettings.tts || {};
  t.enabled = !t.enabled;
  ttsSetToggleUI(t.enabled);
  ttsSetGroupsVisible(t.enabled);
}

function ttsEngineChanged() {
  const val = document.getElementById('ttsEngine')?.value;
  const wsGroup  = document.getElementById('ttsVoiceGroup');
  const oaiGroup = document.getElementById('ttsOpenAIGroup');
  const elGroup  = document.getElementById('ttsElevenLabsGroup');
  if (wsGroup)  wsGroup.style.display  = (val === 'webspeech')   ? '' : 'none';
  if (oaiGroup) oaiGroup.style.display = (val === 'openai')      ? '' : 'none';
  if (elGroup)  elGroup.style.display  = (val === 'elevenlabs')  ? '' : 'none';
  if (val === 'webspeech') ttsPopulateVoices();
}

function ttsPopulateVoices() {
  const sel = document.getElementById('ttsVoiceSelect');
  if (!sel || !window.speechSynthesis) return;
  const fill = () => {
    const lang = appSettings.tts?.lang || 'en';
    const langPrefix = lang.startsWith('fr') ? 'fr' : lang;
    const voices = speechSynthesis.getVoices().filter(v => v.lang.startsWith(langPrefix));
    sel.innerHTML = voices.map(v =>
      `<option value="${v.name}" ${v.name === (appSettings.tts?.voiceName || '') ? 'selected' : ''}>${v.name} (${v.lang})</option>`
    ).join('') || '<option value="">Default</option>';
  };
  fill();
  speechSynthesis.onvoiceschanged = fill;
}

// ORDINALS_FR and ORDINALS_EN are declared in audio.js

function spellJersey(num, lang) {
  const fr = lang.startsWith('fr');
  const be = lang === 'fr-be';
  const ch = lang === 'fr-ch';
  if (!fr) return String(num);
  const n = parseInt(num);
  if (isNaN(n) || n < 0 || n > 99) return String(num);
  const units = ['','un','deux','trois','quatre','cinq','six','sept','huit','neuf',
                 'dix','onze','douze','treize','quatorze','quinze','seize',
                 'dix-sept','dix-huit','dix-neuf'];
  if (n < 20) return units[n] || String(n);
  const tens_fr = ['','','vingt','trente','quarante','cinquante','soixante','soixante','quatre-vingt','quatre-vingt'];
  const tens_be = ['','','vingt','trente','quarante','cinquante','soixante','septante','quatre-vingt','nonante'];
  const tens_ch = ['','','vingt','trente','quarante','cinquante','soixante','septante','huitante','nonante'];
  const tens = ch ? tens_ch : (be ? tens_be : tens_fr);
  const t = Math.floor(n / 10);
  const u = n % 10;
  if (ch) {
    if (u === 0) return tens[t];
    if (u === 1) return tens[t] + '-et-un';
    return tens[t] + '-' + units[u];
  } else if (be) {
    if (t === 8) { return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + units[u]; }
    if (u === 0) return tens[t];
    if (u === 1) return tens[t] + '-et-un';
    return tens[t] + '-' + units[u];
  } else {
    if (t === 7) return 'soixante-' + units[10 + u];
    if (t === 8) { return u === 0 ? 'quatre-vingts' : 'quatre-vingt-' + units[u]; }
    if (t === 9) return 'quatre-vingt-' + units[10 + u];
    if (u === 0) return tens[t];
    if (u === 1) return tens[t] + '-et-un';
    return tens[t] + '-' + units[u];
  }
}

function ttsBuildText(entry) {
  const player = allPlayers[entry.pid] || {};
  const t = appSettings.tts || {};
  const lang = t.lang || 'en';
  const pron = appSettings.posPronunciations || {};
  const posLabel = pron[entry.pos] || entry.pos || '';
  const jerseySpelled = entry.jersey ? spellJersey(entry.jersey, lang) : '';
  return (t.template || 'Now batting, number {jersey}, {name}!')
    .replace('{name}',     player.pronunciation || player.name || '')
    .replace('{jersey}',   jerseySpelled)
    .replace('{position}', posLabel)
    .replace('{team}',     teams[currentTeamId]?.label || '');
}

function ttsBuildIntroText(entry, orderIndex) {
  const player  = allPlayers[entry.pid] || {};
  const t       = appSettings.tts || {};
  const lang   = t.lang || 'en';
  const useFr  = lang.startsWith('fr');
  const isBe   = lang === 'fr-be';
  const isCh   = lang === 'fr-ch';

  const name   = entry._visitor
    ? (entry._pronunciation || entry._name || '')
    : (player.pronunciation || player.name || '');

  // Visitor entry: ordinal for 1-9, jersey + name for bench (10+)
  if (entry._visitor) {
    const jersey = entry.jersey ? (useFr ? `numéro ${spellJersey(entry.jersey, lang)}` : `number ${entry.jersey}`) : '';
    const isBench = orderIndex >= 9;
    if (isBench) {
      return useFr ? `${jersey ? jersey + ', ' : ''}${name} !` : `${jersey ? jersey + ', ' : ''}${name}!`;
    }
    const ordinals = useFr ? ORDINALS_FR : ORDINALS_EN;
    const ordinal  = ordinals[orderIndex] || (orderIndex + 1).toString();
    if (useFr) {
      return `${ordinal} batteur${jersey ? ', ' + jersey : ''}, ${name} !`;
    } else {
      return `${ordinal} batter${jersey ? ', ' + jersey : ''}, ${name}!`;
    }
  }

  const isBench = orderIndex >= 9;
  const jersey = entry.jersey ? (useFr ? `numéro ${spellJersey(entry.jersey, lang)}` : `number ${entry.jersey}`) : '';

  // Bench players (10+): jersey + name only
  if (isBench) {
    if (jersey) {
      return useFr ? `${jersey}, ${name} !` : `${jersey}, ${name}!`;
    }
    return useFr ? `${name} !` : `${name}!`;
  }

  // Lineup players (1–9): full announcement with ordinal + position
  const ordinals = useFr ? ORDINALS_FR : ORDINALS_EN;
  const ordinal  = ordinals[orderIndex] || (orderIndex + 1).toString();

  const posCode  = entry.pos || '';
  const pron     = appSettings.posPronunciations || {};
  const posLabels_fr = {
    'P':'Pitcher','C':'Catcher','1B':'Première base','2B':'Deuxième base',
    '3B':'Troisième base','SS':'Shortstop','LF':'Champ gauche','CF':'Champ centre','RF':'Champ droit',
  };
  const posLabels_en = {
    'P':'Pitcher','C':'Catcher','1B':'First Base','2B':'Second Base',
    '3B':'Third Base','SS':'Shortstop','LF':'Left Field','CF':'Center Field','RF':'Right Field',
  };
  const extraPos   = (appSettings.extraPositions || []).find(p => p.code === posCode);
  const posDisplay = pron[posCode] || (useFr
    ? (posLabels_fr[posCode] || extraPos?.label || posCode)
    : (posLabels_en[posCode] || extraPos?.label || posCode));

  if (useFr) {
    return `${ordinal} batteur, ${posDisplay}${jersey ? ', ' + jersey : ''}, ${name} !`;
  } else {
    return `${ordinal} batter, ${posDisplay}${jersey ? ', ' + jersey : ''}, ${name}!`;
  }
}

// ── iOS Web Speech unlock ──
// iOS requires speechSynthesis.speak() to be called synchronously from a user gesture.
// We unlock once on first user interaction so subsequent async calls work.
// ── Pre-load TTS voices at startup to avoid delay on first use ──
// _cachedVoices is declared in audio.js
function ttsPreloadVoices() {
  if (!window.speechSynthesis) return;
  const v = speechSynthesis.getVoices();
  if (v.length > 0) { _cachedVoices = v; return; }
  speechSynthesis.onvoiceschanged = () => {
    _cachedVoices = speechSynthesis.getVoices();
  };
}
ttsPreloadVoices();

// _ttsUnlocked and _sharedAudioCtx are declared in audio.js
function ttsUnlock() {
  if (!window.speechSynthesis) return;
  // speechSynthesis unlock
  if (!_ttsUnlocked) {
    _ttsUnlocked = true;
    const utt = new SpeechSynthesisUtterance('');
    utt.volume = 0;
    speechSynthesis.speak(utt);
    speechSynthesis.cancel();
  }
  // AudioContext unlock — keeps audio channel open on Chrome iOS
  if (!_sharedAudioCtx) {
    try {
      _sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = _sharedAudioCtx.createOscillator();
      const gain = _sharedAudioCtx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(_sharedAudioCtx.destination);
      osc.start();
    } catch(e) {}
  } else if (_sharedAudioCtx.state === 'suspended') {
    _sharedAudioCtx.resume().catch(() => {});
  }
}
// Unlock on first touch anywhere on the page
document.addEventListener('touchstart', ttsUnlock, { once: true, passive: true });

async function ttsSpeak(text) {
  const t = appSettings.tts || {};
  if (t.engine === 'openai' && t.openAIKey) {
    return ttsOpenAI(text, t.openAIKey, t.openAIVoice || 'onyx');
  }
  if (t.engine === 'elevenlabs' && t.elevenLabsKey) {
    return ttsElevenLabs(text, t.elevenLabsKey, t.elevenLabsVoice, t.elevenLabsLang);
  }
  return ttsWebSpeech(text, t.voiceName);
}

function ttsWebSpeech(text, voiceName) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    let resolved = false;
    const done = () => { if (!resolved) { resolved = true; clearInterval(keepAlive); resolve(); } };

    // iOS/Chrome iOS: speechSynthesis stalls without periodic resume()
    const keepAlive = setInterval(() => {
      if (speechSynthesis.speaking) {
        speechSynthesis.pause();
        speechSynthesis.resume();
      }
    }, 5000);

    // Safety timeout based on text length
    const words = text.trim().split(/\s+/).length;
    const estimatedMs = Math.round(words / (130 * 0.92) * 60 * 1000);
    const timeout = setTimeout(done, Math.max(6000, estimatedMs + 3000));

    function doSpeak() {
      // Prefix with soft hyphen (invisible pause) to prime the TTS engine
      const primed = '\u00ad ' + text;
      const utt = new SpeechSynthesisUtterance(primed);
      utt.rate   = 0.92;
      utt.pitch  = 0.95;
      utt.volume = 1;
      // Use cached voices to avoid async delay
      const voices = _cachedVoices.length > 0 ? _cachedVoices : speechSynthesis.getVoices();
      if (voices.length > 0) {
        if (voiceName) {
          const v = voices.find(v => v.name === voiceName);
          if (v) utt.voice = v;
        }
        if (!utt.voice) utt.voice = voices[0];
      }
      utt.onend   = () => { clearTimeout(timeout); done(); };
      utt.onerror = (e) => { console.warn('TTS error:', e); clearTimeout(timeout); done(); };
      speechSynthesis.cancel();
      setTimeout(() => speechSynthesis.speak(utt), 200);
    }

    // Use cached voices if available, otherwise wait
    if (_cachedVoices.length > 0) {
      doSpeak();
    } else {
      const onVoices = () => {
        speechSynthesis.onvoiceschanged = null;
        _cachedVoices = speechSynthesis.getVoices();
        doSpeak();
      };
      speechSynthesis.onvoiceschanged = onVoices;
      setTimeout(() => { if (!resolved) { speechSynthesis.onvoiceschanged = null; doSpeak(); } }, 500);
    }
  });
}

async function ttsOpenAI(text, apiKey, voice) {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'tts-1', input: text, voice, speed: 0.95 }),
  });
  if (!res.ok) throw new Error(`OpenAI TTS error: ${res.status}`);
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = reject;
    audio.play().catch(reject);
  });
}

async function ttsElevenLabs(text, apiKey, voiceId, langCode) {
  const vid = voiceId || 'onwK4e9ZLuTAKqWW03F9'; // Daniel by default
  const body = {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
  };
  if (langCode) body.language_code = langCode;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`ElevenLabs error ${res.status}: ${err.detail?.message || res.statusText}`);
  }
  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
    audio.onerror = reject;
    audio.play().catch(reject);
  });
}

async function ttsLoadElevenLabsVoices() {
  const key = document.getElementById('ttsElevenLabsKey')?.value?.trim();
  if (!key) { alert('Please enter your ElevenLabs API key first.'); return; }
  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const sel = document.getElementById('ttsElevenLabsVoice');
    if (!sel) return;
    sel.innerHTML = data.voices.map(v =>
      `<option value="${v.voice_id}">${v.name} (${v.labels?.accent || v.labels?.language || 'custom'})</option>`
    ).join('');
    alert(`✓ ${data.voices.length} voices loaded from your ElevenLabs account.`);
  } catch(e) {
    alert('Failed to load voices: ' + e.message);
  }
}

// TTS_TEMPLATES is declared in audio.js

function ttsSetTemplate(key) {
  const tmpl = document.getElementById('ttsTemplate');
  if (tmpl && TTS_TEMPLATES[key]) tmpl.value = TTS_TEMPLATES[key];
}

async function ttsTest() {
  const fakeEntry = { pid: Object.keys(allPlayers)[0] || 0, jersey: '7', pos: 'CF' };
  if (!allPlayers[fakeEntry.pid]) {
    fakeEntry.pid = 0;
    allPlayers[0] = { name: 'John Smith' };
  }
  const text = ttsBuildText(fakeEntry);
  try { await ttsSpeak(text); } catch(e) { alert('TTS error: ' + e.message); }
}

function ttsSave() {
  const t = appSettings.tts = appSettings.tts || {};
  t.template         = document.getElementById('ttsTemplate')?.value         || t.template;
  t.engine           = document.getElementById('ttsEngine')?.value           || t.engine;
  t.lang             = document.getElementById('ttsLang')?.value             || 'en';
  t.voiceName        = document.getElementById('ttsVoiceSelect')?.value      || '';
  t.openAIKey        = document.getElementById('ttsOpenAIKey')?.value        || '';
  t.openAIVoice      = document.getElementById('ttsOpenAIVoice')?.value      || 'onyx';
  t.elevenLabsKey    = document.getElementById('ttsElevenLabsKey')?.value    || '';
  t.elevenLabsVoice  = document.getElementById('ttsElevenLabsVoice')?.value  || '';
  t.elevenLabsLang   = document.getElementById('ttsElevenLabsLang')?.value   || '';
  t.fadeDelay        = parseFloat(document.getElementById('ttsFade')?.value) || 1.5;
  saveConfig();
  showCfgSaveIndicator();
}

function ifSavePassword() {
  const current  = document.getElementById('ifPwdCurrent').value;
  const newPwd   = document.getElementById('ifPwdNew').value;
  const confirm  = document.getElementById('ifPwdConfirm').value;
  const msgEl    = document.getElementById('ifPwdMsg');

  const show = (text, type) => {
    msgEl.textContent = text;
    msgEl.className = 'if-pwd-msg ' + type;
    msgEl.style.display = 'block';
    if (type === 'success') setTimeout(() => { msgEl.style.display = 'none'; }, 3000);
  };

  if (current !== appSettings.adminPassword) { show('Current password is incorrect.', 'error'); return; }
  if (!newPwd || newPwd.length < 4) { show('New password must be at least 4 characters.', 'error'); return; }
  if (newPwd !== confirm) { show('Les deux mots de passe ne correspondent pas.', 'error'); return; }

  appSettings.adminPassword = newPwd;
  saveConfig();
  document.getElementById('ifPwdCurrent').value = '';
  document.getElementById('ifPwdNew').value = '';
  document.getElementById('ifPwdConfirm').value = '';
  show('Mot de passe modifié avec succès !', 'success');
  showCfgSaveIndicator();
}
