/* ============================================================
   Diamond Pulse — js/soundboard.js
   Soundboard live, field songs, live lineup, match overlay, init

   Fonctions :
   - liveSoundPlay(key), liveSoundStop(key), liveSoundStopAll()
   - liveCustomSoundPlay(id), liveCustomSoundStop(id)
   - liveCustomSoundDelete(id), liveCustomSoundToggleFav(id)
   - liveAddCustomSound(input), liveSoundClear(key)
   - liveSoundEdit(key), liveSoundEditClose()
   - liveSoundEditFileChosen(input), liveSoundEditSave()
   - liveSoundUploadFile(key, file)
   - saveCustomSoundsToConfig(), renderCustomSounds()
   - renderFieldSongs(), liveAddFieldSong(input)
   - liveFieldSongPlay(id), liveFieldSongStop(id)
   - liveFieldSongUpload(id, input), liveFieldSongEdit(id)
   - liveFieldSongDelete(id)
   - liveResizerStart(e, resizerIndex)
   - renderLiveLineup(), liveTogglePlay(liveIndex)
   - loadLicense(), applyFeatures()
   - matchSave(), matchRenderPanel(), matchScoreAdj()
   - matchInningAdj(), matchInningToggle(), matchSetCount()
   - matchResetCount(), matchBatterAdj(), matchCopyOverlayUrl()
   - initLiveMobileTabs()
   - init()

   Dépend de (globals) :
   - allPlayers, teams, currentTeamId, appSettings, clubSettings
   - currentAudio, currentPid, isEditMode, PLAY_DURATION
   - saveConfig(), render(), togglePlay(), ttsUnlock(), ttsSpeak()
   - ttsBuildIntroText(), startTeamIntro()
   ============================================================ */

// ── LIVE MODE — SOUNDBOARD ──

const LIVE_SOUNDS = {
  // Baseball
  anthem:      { label: 'National Anthem', icon: '🎺', url: null, cat: 'baseball' },
  homerun:     { label: 'Home Run!',        icon: '💥', url: null, cat: 'baseball' },
  strikeout:   { label: 'Strike Out',       icon: '⚡', url: null, cat: 'baseball' },
  walkoff:     { label: 'Walk Off',         icon: '🏆', url: null, cat: 'baseball' },
  // Ambiance
  applause:    { label: 'Applause',         icon: '👏', url: null, cat: 'ambiance' },
  letsgo:      { label: "Let's Go!",        icon: '📣', url: null, cat: 'ambiance' },
  charge:      { label: 'Charge!',          icon: '🥁', url: null, cat: 'ambiance' },
  drumroll:    { label: 'Drumroll',         icon: '🪘', url: null, cat: 'ambiance' },
  airhorn:     { label: 'Air Horn',         icon: '📯', url: null, cat: 'ambiance' },
  sadtrombone: { label: 'Sad Trombone',     icon: '😢', url: null, cat: 'ambiance' },
};

const liveSoundAudios = {}; // key → Audio instance
let liveCustomSounds = []; // sera chargé depuis appSettings.soundboard.customSounds après loadConfig()
// [{id, label, url}]

// ── VISITORS LINEUP ──
// [{name, jersey, pronunciation}] — persisté en localStorage
let visitorsLineup = JSON.parse(localStorage.getItem('visitorsLineup') || '[]');
function saveVisitors() { localStorage.setItem('visitorsLineup', JSON.stringify(visitorsLineup)); }

let currentOpponentId = localStorage.getItem('currentOpponentId') || '';
function saveCurrentOpponent() { localStorage.setItem('currentOpponentId', currentOpponentId); }

// ── VISITORS LINEUP — CRUD ──

function visitorOpponentChanged(val) {
  currentOpponentId = val;
  saveCurrentOpponent();
}

function switchLiveTab(tab) {
  const isMobile = window.innerWidth <= 700;
  if (!isMobile) return;
  const cols = {
    sounds:   'liveColSounds',
    field:    'liveColField',
    walkup:   'liveColWalkup',
    visitors: 'liveColVisitors',
  };
  const tabs = {
    sounds:   'liveTabSounds',
    field:    'liveTabField',
    walkup:   'liveTabWalkup',
    visitors: 'liveTabVisitors',
  };
  Object.keys(cols).forEach(key => {
    const col = document.getElementById(cols[key]);
    const btn = document.getElementById(tabs[key]);
    if (!col) return;
    // Skip visitors if not available
    if (key === 'visitors' && col.dataset.hasVisitors !== '1') return;
    // Use style.display directly to override any inline flex styles
    col.style.display = key === tab ? 'flex' : 'none';
    col.style.flex = key === tab ? '1 1 auto' : '';
    col.style.width = key === tab ? '100%' : '';
    btn?.classList.toggle('active', key === tab);
  });
}

function switchWalkupSubtab(tab) {
  const homeList     = document.getElementById('liveLineupList');
  const visitorsList = document.getElementById('liveVisitorsListMobile');
  const btnHome      = document.getElementById('walkupSubHome');
  const btnVisitors  = document.getElementById('walkupSubVisitors');
  const introBtn     = document.querySelector('#liveColWalkup .live-col-header button');
  if (!homeList || !visitorsList) return;

  if (tab === 'home') {
    homeList.style.display = '';
    visitorsList.style.display = 'none';
    btnHome?.classList.add('active');
    btnVisitors?.classList.remove('active');
    if (introBtn) { introBtn.style.display = ''; introBtn.textContent = ''; introBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5v14l11-7z"/><path d="M14 5v14l7-4.5V9.5z"/></svg> Team Intro'; introBtn.onclick = startTeamIntro; }
  } else {
    homeList.style.display = 'none';
    visitorsList.style.display = '';
    btnVisitors?.classList.add('active');
    btnHome?.classList.remove('active');
    // Sync visitors list content
    const desktopList = document.getElementById('liveVisitorsList');
    if (desktopList) visitorsList.innerHTML = desktopList.innerHTML;
    if (introBtn) { introBtn.style.display = ''; introBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5v14l11-7z"/><path d="M14 5v14l7-4.5V9.5z"/></svg> Visitor Intro'; introBtn.onclick = startVisitorIntro; }
  }
}

function initLiveMobileTabs() {
  if (window.innerWidth > 700) return;
  // Show/hide visitors subtab based on visitors data
  const hasVisitors = visitorsLineup.length > 0;
  const subtabs = document.getElementById('walkupSubtabs');
  const subVisitorsBtn = document.getElementById('walkupSubVisitors');
  if (subtabs) subtabs.style.display = hasVisitors ? 'flex' : 'none';
  if (subVisitorsBtn) subVisitorsBtn.style.display = hasVisitors ? '' : 'none';
  switchLiveTab('walkup');
  switchWalkupSubtab('home');
}

function switchBattingTab(tab) {
  const home = document.querySelector('.batting-col-home');
  const visitors = document.querySelector('.batting-col-visitors');
  const tabHome = document.getElementById('battingTabHome');
  const tabVisitors = document.getElementById('battingTabVisitors');
  if (!home || !visitors) return;
  if (tab === 'home') {
    home.classList.remove('tab-hidden');
    visitors.classList.add('tab-hidden');
    tabHome?.classList.add('active');
    tabVisitors?.classList.remove('active');
  } else {
    visitors.classList.remove('tab-hidden');
    home.classList.add('tab-hidden');
    tabVisitors?.classList.add('active');
    tabHome?.classList.remove('active');
  }
}

function populateVisitorOpponentSelect() {
  const sel = document.getElementById('visitorOpponentSelect');
  if (!sel) return;
  const opponents = appSettings.opponents || [];
  sel.innerHTML = '<option value="">— Select opponent —</option>' +
    opponents.map(o => `<option value="${o.id}" ${o.id === currentOpponentId ? 'selected' : ''}>${o.name}</option>`).join('');
}

function toggleVisitorForm() {
  const f = document.getElementById('addVisitorForm');
  f.style.display = f.style.display === 'block' ? 'none' : 'block';
}

function addVisitor() {
  const name  = document.getElementById('visitorName').value.trim();
  const pron  = document.getElementById('visitorPronunciation').value.trim();
  const jersey = document.getElementById('visitorJersey').value.trim();
  if (!name) return;
  visitorsLineup.push({ name, pronunciation: pron, jersey });
  saveVisitors();
  renderVisitorsLineup();
  renderLiveVisitors();
  document.getElementById('visitorName').value = '';
  document.getElementById('visitorPronunciation').value = '';
  document.getElementById('visitorJersey').value = '';
}

function removeVisitor(idx) {
  visitorsLineup.splice(idx, 1);
  saveVisitors();
  renderVisitorsLineup();
  renderLiveVisitors();
}

function visitorsClear() {
  if (!visitorsLineup.length) return;
  if (!confirm('Clear all visitors?')) return;
  visitorsLineup = [];
  saveVisitors();
  renderVisitorsLineup();
  renderLiveVisitors();
}

function renderVisitorsLineup() {
  populateVisitorOpponentSelect();
  const el = document.getElementById('visitorsLineupList');
  if (!el) return;
  if (!visitorsLineup.length) {
    el.innerHTML = '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;letter-spacing:1px;color:var(--muted);padding:8px 0">No visitors added yet.</div>';
    return;
  }
  el.innerHTML = visitorsLineup.map((v, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--darkgray);border:1px solid var(--border);border-left:3px solid var(--border);border-radius:2px;margin-bottom:3px">
      <span style="font-family:'Oswald',sans-serif;font-size:16px;font-weight:700;color:var(--border);width:22px;text-align:center;flex-shrink:0">${i+1}</span>
      ${v.jersey ? `<span style="font-family:'Oswald',sans-serif;font-size:13px;color:var(--orange);flex-shrink:0">#${v.jersey}</span>` : ''}
      <span style="font-family:'Oswald',sans-serif;font-size:14px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--white);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.name}</span>
      ${v.pronunciation ? `<span style="font-family:'Barlow Condensed',sans-serif;font-size:10px;color:var(--muted);letter-spacing:1px;flex-shrink:0">"${v.pronunciation}"</span>` : ''}
      <button onclick="editVisitor(${i})" style="width:24px;height:24px;border-radius:3px;border:1px solid var(--border);background:none;color:var(--muted);cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0"
        onmouseover="this.style.borderColor='var(--orange)';this.style.color='var(--orange)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">✏</button>
      <button onclick="removeVisitor(${i})" style="width:24px;height:24px;border-radius:3px;border:1px solid rgba(200,30,0,0.3);background:none;color:#ff6655;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center;flex-shrink:0"
        onmouseover="this.style.background='rgba(200,30,0,0.1)'" onmouseout="this.style.background='none'">✕</button>
    </div>`).join('');
}

function editVisitor(idx) {
  const v = visitorsLineup[idx];
  const name  = prompt('Name:', v.name);
  if (name === null) return;
  const pron  = prompt('Pronunciation (optional):', v.pronunciation || '');
  if (pron === null) return;
  const jersey = prompt('Jersey # (optional):', v.jersey || '');
  if (jersey === null) return;
  visitorsLineup[idx] = { name: name.trim(), pronunciation: pron.trim(), jersey: jersey.trim() };
  saveVisitors();
  renderVisitorsLineup();
  renderLiveVisitors();
}

// ── VISITORS — LIVE MODE ──

function renderLiveVisitors() {
  const col = document.getElementById('liveColVisitors');
  const el  = document.getElementById('liveVisitorsList');
  if (!col || !el) return;

  const hasVisitors = visitorsLineup.length > 0;
  col.dataset.hasVisitors = hasVisitors ? '1' : '0';

  // Desktop: show/hide column + resizer
  if (window.innerWidth > 700) {
    col.style.display = hasVisitors ? '' : 'none';
    const resizer = document.getElementById('liveResizer3');
    if (resizer) resizer.style.display = hasVisitors ? '' : 'none';
  }

  // Mobile: show/hide subtab
  const subtabs = document.getElementById('walkupSubtabs');
  const subVisitorsBtn = document.getElementById('walkupSubVisitors');
  if (subtabs) subtabs.style.display = (window.innerWidth <= 700 && hasVisitors) ? 'flex' : (window.innerWidth <= 700 ? 'none' : subtabs.style.display);
  if (subVisitorsBtn) subVisitorsBtn.style.display = hasVisitors ? '' : 'none';

  // Mobile tab button
  const tabBtn = document.getElementById('liveTabVisitors');
  if (tabBtn) tabBtn.style.display = hasVisitors ? '' : 'none';

  if (!hasVisitors) { el.innerHTML = ''; return; }

  el.innerHTML = visitorsLineup.map((v, i) => `
    <div class="live-player-card" onclick="liveAnnounceVisitor(${i})">
      <div class="live-order">${i+1}</div>
      <div class="live-player-info">
        <div class="live-player-name">${v.jersey ? '#'+v.jersey+' · ' : ''}${v.name}</div>
        ${v.pronunciation ? `<div class="live-player-meta">"${v.pronunciation}"</div>` : ''}
      </div>
      <button style="width:32px;height:32px;border-radius:50%;border:1px solid var(--border);background:var(--gray);color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.15s;font-size:14px"
        onmouseover="this.style.borderColor='var(--orange)';this.style.color='var(--orange)'" onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'"
        onclick="event.stopPropagation();liveAnnounceVisitor(${i})" title="Announce">🎙️</button>
    </div>`).join('');
}

async function liveAnnounceVisitor(idx) {
  const v = visitorsLineup[idx];
  if (!v || !appSettings.tts?.enabled) return;
  const t = appSettings.tts || {};
  const lang = t.lang || 'en';
  const jerseySpelled = v.jersey ? spellJersey(v.jersey, lang) : '';
  const text = (t.template || 'Now batting, number {jersey}, {name}!')
    .replace('{name}',     v.pronunciation || v.name || '')
    .replace('{jersey}',   jerseySpelled)
    .replace('{position}', '')
    .replace('{team}',     '');
  try { await ttsSpeak(text.replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').trim()); } catch(e) {}
}

async function startVisitorIntro() {
  ttsUnlock();
  if (!visitorsLineup.length) return;
  stopPlayback();
  const entries = visitorsLineup.map((v, i) => ({
    _visitor: true,
    pid: `visitor_${i}`,
    jersey: v.jersey,
    _name: v.name,
    _pronunciation: v.pronunciation || v.name,
    pos: '',
  }));
  introState = { entries, index: 0, paused: false, timer: null, elapsed: 0 };
  const overlay = document.getElementById('introOverlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  introBuildDots();

  // Use visitorIntro settings
  const vi = appSettings.visitorIntro || {};
  mixerState.ttsVol = (vi.volTTS !== undefined ? vi.volTTS : 100) / 100;
  mixerState.bgVol  = (vi.volBG  !== undefined ? vi.volBG  : 40)  / 100;
  mixerOpen();

  const bgUrl = vi.bgMusic;
  if (bgUrl) {
    const bgAudio = new Audio(bgUrl);
    bgAudio.loop = true;
    bgAudio.volume = mixerState.bgMuted ? 0 : mixerState.bgVol;
    bgAudio.play().catch(() => {});
    introState._bgAudio = bgAudio;
  }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    introState._audioCtx = ctx;
    introState._audioOsc = osc;
  } catch(e) {}

  // Opening text
  const openingText = vi.openingText;
  if (openingText) {
    // Resolve {opponent} variable
    const opp = (appSettings.opponents || []).find(o => o.id === currentOpponentId);
    const oppName = opp?.name || '';
    const resolvedText = openingText.replace(/\{opponent\}/gi, oppName).trim();
    document.getElementById('introOrderNum').textContent  = '';
    document.getElementById('introName').textContent      = '';
    document.getElementById('introJersey').textContent    = '';
    document.getElementById('introPosBadge').style.display = 'none';
    document.getElementById('introPlayingLabel').textContent = resolvedText;
    document.getElementById('introCounter').textContent   = '';
    document.getElementById('introAvatar').innerHTML = `<svg width="60" height="60" viewBox="0 0 60 60"><text x="30" y="42" text-anchor="middle" font-size="40">🎤</text></svg>`;
    if (appSettings.tts?.enabled) {
      try { await ttsSpeak(resolvedText); } catch(e) {}
    } else {
      const words = resolvedText.trim().split(/\s+/).length;
      await new Promise(r => setTimeout(r, Math.max(2000, Math.round(words / 130 * 60 * 1000))));
    }
  }

  introShowPlayer(0);
}

function liveSoundPlay(key) {
  const def = LIVE_SOUNDS[key];
  if (!def?.url) return; // greyed out — no file uploaded

  // Toggle stop if already playing
  if (liveSoundAudios[key]) {
    liveSoundAudios[key].pause();
    liveSoundAudios[key] = null;
    document.getElementById('sbtn' + key.charAt(0).toUpperCase() + key.slice(1))?.classList.remove('playing');
    return;
  }
  const audio = new Audio(def.url);
  liveSoundAudios[key] = audio;
  const btn = document.getElementById('sbtn' + key.charAt(0).toUpperCase() + key.slice(1));
  btn?.classList.add('playing');
  audio.play().catch(() => {});
  audio.onended = () => {
    liveSoundAudios[key] = null;
    btn?.classList.remove('playing');
  };
}

function liveSoundStop(key) {
  if (liveSoundAudios[key]) {
    liveSoundAudios[key].pause();
    liveSoundAudios[key] = null;
  }
  const btn = document.getElementById('sbtn' + key.charAt(0).toUpperCase() + key.slice(1));
  btn?.classList.remove('playing');
}

function liveSoundStopAll() {
  // Stop all preset sounds
  Object.keys(LIVE_SOUNDS).forEach(key => liveSoundStop(key));
  // Stop all custom sounds
  liveCustomSounds.forEach(s => liveCustomSoundStop(s.id));
  // Stop all field songs
  liveFieldSongs.forEach(s => liveFieldSongStop(s.id));
}

function liveCustomSoundPlay(id) {
  const s = liveCustomSounds.find(s => s.id === id);
  if (!s) return;
  const btnId = 'lcsBtn_' + id;
  if (liveSoundAudios['custom_' + id]) {
    liveSoundAudios['custom_' + id].pause();
    liveSoundAudios['custom_' + id] = null;
    document.getElementById(btnId)?.classList.remove('playing');
    return;
  }
  const audio = new Audio(s.url);
  liveSoundAudios['custom_' + id] = audio;
  document.getElementById(btnId)?.classList.add('playing');
  audio.play().catch(() => {});
  audio.onended = () => {
    liveSoundAudios['custom_' + id] = null;
    document.getElementById(btnId)?.classList.remove('playing');
  };
}

function liveCustomSoundStop(id) {
  if (liveSoundAudios['custom_' + id]) {
    liveSoundAudios['custom_' + id].pause();
    liveSoundAudios['custom_' + id] = null;
  }
  document.getElementById('lcsBtn_' + id)?.classList.remove('playing');
}

function liveCustomSoundDelete(id) {
  liveCustomSounds = liveCustomSounds.filter(s => s.id !== id);
  saveCustomSoundsToConfig();
  renderCustomSounds();
}

async function liveAddCustomSound(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const label = file.name.replace(/\.[^.]+$/, '');
  const id = 'cs_' + Date.now();
  const s = { id, label, url: null };
  liveCustomSounds.push(s);
  renderCustomSounds();
  try {
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `soundboard/custom_${id}.${ext}`;
    let res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file,
    });
    if (!res.ok && res.status === 409) {
      res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'PUT', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file,
      });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    s.url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    saveCustomSoundsToConfig();
    renderCustomSounds();
  } catch(err) {
    alert('Upload error: ' + err.message);
    liveCustomSounds = liveCustomSounds.filter(x => x.id !== id);
    renderCustomSounds();
  }
}

function liveSoundClear(key) {
  if (!confirm('Remove audio file from this button?')) return;
  LIVE_SOUNDS[key].url = null;
  if (appSettings.soundboard) appSettings.soundboard[key] = null;
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  const btn = document.getElementById('sbtn' + cap);
  btn?.classList.remove('has-file');
  btn?.classList.add('empty');
  const sulbl = document.getElementById('sulbl' + cap);
  if (sulbl) { const txt = sulbl.childNodes[0]; if (txt) txt.textContent = '📂 Upload MP3\n'; }
  saveConfig();
}

function liveFieldSongDelete(id) {
  if (!confirm('Delete this song?')) return;
  liveFieldSongStop(id);
  liveFieldSongs = liveFieldSongs.filter(s => s.id !== id);
  localStorage.setItem('liveFieldSongs', JSON.stringify(liveFieldSongs));
  renderFieldSongs();
}

// ── LIVE MODE — RESIZABLE COLUMNS ──
let liveFieldSongs = JSON.parse(localStorage.getItem('liveFieldSongs') || '[]');

(function initLiveColumns() {
  if (window.innerWidth <= 700) return; // mobile uses tab switching instead
  const saved = JSON.parse(localStorage.getItem('liveColWidths') || 'null');
  const cols = ['liveColSounds','liveColField','liveColWalkup','liveColVisitors'];
  if (saved && saved.length === cols.length) {
    cols.forEach((id, i) => { const el = document.getElementById(id); if (el && el.style.display !== 'none') el.style.flex = `0 0 ${saved[i]}px`; });
  } else {
    cols.forEach(id => { const el = document.getElementById(id); if (el) el.style.flex = '1 1 0'; });
  }
})();

function liveResizerStart(e, resizerIndex) {
  e.preventDefault();
  const resizer = e.currentTarget;
  resizer.classList.add('dragging');
  const allCols = ['liveColSounds','liveColField','liveColWalkup','liveColVisitors'];
  const visibleCols = allCols.filter(id => { const el = document.getElementById(id); return el && el.style.display !== 'none'; });
  const leftCol  = document.getElementById(visibleCols[resizerIndex]);
  const rightCol = document.getElementById(visibleCols[resizerIndex + 1]);
  if (!leftCol || !rightCol) return;
  const startX     = e.clientX;
  const startLeft  = leftCol.getBoundingClientRect().width;
  const startRight = rightCol.getBoundingClientRect().width;
  function onMove(ev) {
    const dx = ev.clientX - startX;
    leftCol.style.flex  = `0 0 ${Math.max(140, startLeft + dx)}px`;
    rightCol.style.flex = `0 0 ${Math.max(140, startRight - dx)}px`;
  }
  function onUp() {
    resizer.classList.remove('dragging');
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    const widths = allCols.map(id => document.getElementById(id)?.getBoundingClientRect().width || 0);
    localStorage.setItem('liveColWidths', JSON.stringify(widths));
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// ── CHANGE FIELD SONGS ──
const liveFieldAudios = {};

function renderFieldSongs() {
  const grid = document.getElementById('liveFieldSongsGrid');
  if (!grid) return;
  if (liveFieldSongs.length === 0) {
    grid.innerHTML = '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:1px;color:var(--muted);padding:4px 0">No songs yet.</div>';
    return;
  }
  grid.innerHTML = liveFieldSongs.map(s => {
    const hasFile = !!s.url;
    const cls = hasFile ? 'has-file custom-active' : 'empty';
    return `
      <div class="sound-btn ${cls}" id="lfsBtn_${s.id}" onclick="${hasFile ? `liveFieldSongPlay('${s.id}')` : ''}">
        <span class="sound-btn-icon">${hasFile ? '🎸' : '➕'}</span>
        <span class="sound-btn-label">${s.label}</span>
        <div class="sound-btn-actions">
          <span class="sound-action play" onclick="event.stopPropagation();liveFieldSongPlay('${s.id}')" title="Play">▶</span>
          <span class="sound-action stop" onclick="event.stopPropagation();liveFieldSongStop('${s.id}')" title="Stop">■</span>
          <span class="sound-action edit" onclick="event.stopPropagation();liveFieldSongEdit('${s.id}')" title="Edit">✏</span>
          <span class="sound-action del" onclick="event.stopPropagation();liveFieldSongDelete('${s.id}')" title="Delete">✕</span>
        </div>
        <label class="sound-upload-lbl" onclick="event.stopPropagation()">${hasFile ? '📂 replace' : '📂 upload mp3'}<input type="file" accept="audio/*" style="display:none" onchange="liveFieldSongUpload('${s.id}',this)"/></label>
      </div>`;
  }).join('');
}

function liveFieldSongPlay(id) {
  const s = liveFieldSongs.find(s => s.id === id);
  if (!s?.url) return;
  if (liveFieldAudios[id]) { liveFieldAudios[id].pause(); liveFieldAudios[id] = null; document.getElementById('lfsBtn_' + id)?.classList.remove('playing'); return; }
  const audio = new Audio(s.url);
  liveFieldAudios[id] = audio;
  document.getElementById('lfsBtn_' + id)?.classList.add('playing');
  audio.play().catch(() => {});
  audio.onended = () => { liveFieldAudios[id] = null; document.getElementById('lfsBtn_' + id)?.classList.remove('playing'); };
}

function liveFieldSongStop(id) {
  if (liveFieldAudios[id]) { liveFieldAudios[id].pause(); liveFieldAudios[id] = null; }
  document.getElementById('lfsBtn_' + id)?.classList.remove('playing');
}

async function liveAddFieldSong(input) {
  const file = input.files[0]; if (!file) return; input.value = '';
  const label = file.name.replace(/\.[^.]+$/, '');
  const id = 'fs_' + Date.now();
  const s = { id, label, url: null };
  liveFieldSongs.push(s);
  renderFieldSongs();
  try {
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `soundboard/field_${id}.${ext}`;
    let res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file });
    if (!res.ok && res.status === 409) res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    s.url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    localStorage.setItem('liveFieldSongs', JSON.stringify(liveFieldSongs));
    renderFieldSongs();
  } catch(err) { alert('Upload error: ' + err.message); }
}

async function liveFieldSongUpload(id, input) {
  const file = input.files[0]; if (!file) return; input.value = '';
  const s = liveFieldSongs.find(s => s.id === id); if (!s) return;
  try {
    const ext = file.name.split('.').pop().toLowerCase();
    const path = `soundboard/field_${id}.${ext}`;
    let res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file });
    if (!res.ok && res.status === 409) res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, { method: 'PUT', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    s.url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    localStorage.setItem('liveFieldSongs', JSON.stringify(liveFieldSongs));
    renderFieldSongs();
  } catch(err) { alert('Upload error: ' + err.message); }
}

function liveFieldSongEdit(id) {
  const s = liveFieldSongs.find(s => s.id === id); if (!s) return;
  soundEditKey = '__field__'; customEditId = id; soundEditPendingFile = null;
  document.getElementById('soundEditName').value = s.label;
  document.getElementById('soundEditFileName').textContent = s.url ? '✅ File loaded' : 'Choose MP3…';
  document.getElementById('soundEditFileInput').value = '';
  document.getElementById('soundEditModal').style.display = 'flex';
  document.getElementById('soundEditName').focus();
}

// ── LIVE MODE — SOUND EDIT MODAL ──
let soundEditKey = null;
let soundEditPendingFile = null;

function liveSoundEdit(key) {
  soundEditKey = key;
  soundEditPendingFile = null;
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  document.getElementById('soundEditName').value = document.getElementById('slbl' + cap)?.textContent || LIVE_SOUNDS[key]?.label || '';
  document.getElementById('soundEditFileName').textContent = LIVE_SOUNDS[key]?.url ? '✅ File loaded — choose to replace' : 'Choose MP3…';
  document.getElementById('soundEditFileInput').value = '';
  document.getElementById('soundEditModal').style.display = 'flex';
  document.getElementById('soundEditName').focus();
}

function liveSoundEditClose() {
  soundEditKey = null;
  soundEditPendingFile = null;
  document.getElementById('soundEditModal').style.display = 'none';
}

function liveSoundEditFileChosen(input) {
  const file = input.files[0];
  if (!file) return;
  soundEditPendingFile = file;
  document.getElementById('soundEditFileName').textContent = '📎 ' + file.name;
}

async function liveSoundEditSave() {
  const key = soundEditKey;
  if (!key) return;
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  const saveBtn = document.getElementById('soundEditSaveBtn');
  const newName = document.getElementById('soundEditName').value.trim();

  // Update label
  if (newName) {
    LIVE_SOUNDS[key].label = newName;
    const lbl = document.getElementById('slbl' + cap);
    if (lbl) lbl.textContent = newName;
    if (!appSettings.soundboard) appSettings.soundboard = {};
    appSettings.soundboard[key + '_label'] = newName;
  }

  // Upload file if chosen
  if (soundEditPendingFile) {
    saveBtn.textContent = '⏳ Uploading…';
    saveBtn.disabled = true;
    try {
      await liveSoundUploadFile(key, soundEditPendingFile);
    } catch(e) {
      saveBtn.textContent = 'Save';
      saveBtn.disabled = false;
      alert('Upload error: ' + e.message);
      return;
    }
    saveBtn.textContent = 'Save';
    saveBtn.disabled = false;
  }

  saveConfig();
  liveSoundEditClose();
}

// Shared upload logic (used by inline label and modal)
async function liveSoundUploadFile(key, file) {
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  const ext = file.name.split('.').pop().toLowerCase();
  const path = `soundboard/${key}.${ext}`;
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
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.message || `HTTP ${res.status}`); }
  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  LIVE_SOUNDS[key].url = publicUrl;
  if (!appSettings.soundboard) appSettings.soundboard = {};
  appSettings.soundboard[key] = publicUrl;
  const btn = document.getElementById('sbtn' + cap);
  btn?.classList.add('has-file');
  btn?.classList.remove('empty');
  const sulbl = document.getElementById('sulbl' + cap);
  if (sulbl) { const txt = sulbl.childNodes[0]; if (txt) txt.textContent = '📂 Replace MP3\n'; }
}

function liveCustomSoundToggleFav(id) {
  const s = liveCustomSounds.find(s => s.id === id);
  if (!s) return;
  s.favorite = !s.favorite;
  saveCustomSoundsToConfig();
  renderCustomSounds();
}

function saveCustomSoundsToConfig() {
  if (!appSettings.soundboard) appSettings.soundboard = {};
  appSettings.soundboard.customSounds = liveCustomSounds;
  saveConfig();
}

function renderCustomSounds() {
  const grid = document.getElementById('liveCustomSoundsGrid');
  if (!grid) return;
  if (liveCustomSounds.length === 0) { grid.innerHTML = ''; return; }
  // Favoris en premier
  const sorted = [...liveCustomSounds].sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));
  grid.innerHTML = sorted.map(s => {
    const hasFile = !!s.url;
    const cls = hasFile ? 'has-file custom-active' : 'empty';
    const favIcon = s.favorite ? '⭐' : '☆';
    const favStyle = s.favorite
      ? 'position:absolute;top:3px;right:4px;font-size:10px;cursor:pointer;opacity:1;line-height:1'
      : 'position:absolute;top:3px;right:4px;font-size:10px;cursor:pointer;opacity:0.3;line-height:1';
    return `
      <div class="sound-btn ${cls}" id="lcsBtn_${s.id}" onclick="${hasFile ? `liveCustomSoundPlay('${s.id}')` : ''}" style="position:relative">
        <span onclick="event.stopPropagation();liveCustomSoundToggleFav('${s.id}')" style="${favStyle}" title="Favori">${favIcon}</span>
        <span class="sound-btn-icon">${hasFile ? '🎵' : '➕'}</span>
        <span class="sound-btn-label">${s.label}</span>
        <div class="sound-btn-actions">
          <span class="sound-action play" onclick="event.stopPropagation();liveCustomSoundPlay('${s.id}')" title="Play">▶</span>
          <span class="sound-action stop" onclick="event.stopPropagation();liveCustomSoundStop('${s.id}')" title="Stop">■</span>
          <span class="sound-action edit" onclick="event.stopPropagation();liveCustomSoundEdit('${s.id}')" title="Edit">✏</span>
          <span class="sound-action del" onclick="event.stopPropagation();liveCustomSoundDelete('${s.id}')" title="Delete">✕</span>
        </div>
        <label class="sound-upload-lbl" onclick="event.stopPropagation()">${hasFile ? '📂 replace' : '📂 upload mp3'}<input type="file" accept="audio/*" style="display:none" onchange="liveCustomSoundUpload('${s.id}',this)"/></label>
      </div>`;
  }).join('');
}

// ── LIVE MODE — LINEUP ──

function renderLiveLineup() {
  const container = document.getElementById('liveLineupList');
  if (!container) return;
  const entries = currentLineup().filter(e => e.present !== false);
  if (entries.length === 0) {
    container.innerHTML = '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;letter-spacing:1px;color:var(--muted);padding:8px 0">No players available in the lineup.</div>';
    return;
  }
  container.innerHTML = entries.map((entry, i) => {
    const player = allPlayers[entry.pid];
    if (!player) return '';
    const isPlaying = currentPid === entry.pid;
    const pos = entry.pos || '?';
    const jersey = entry.jersey ? '#' + entry.jersey : '';
    const song = entry.song ? `${entry.song}${entry.artist ? ' — ' + entry.artist : ''}` : 'No song';
    return `
      <div class="live-player-card${isPlaying ? ' playing' : ''}" onclick="liveTogglePlay(${i})">
        <div class="live-order">${i + 1}</div>
        <div class="live-player-info">
          <div class="live-player-name">${jersey ? jersey + ' · ' : ''}${player.name.toUpperCase()}</div>
          <div class="live-player-meta">${pos} · ${song}</div>
        </div>
        <button class="live-play-btn" onclick="event.stopPropagation();liveTogglePlay(${i})">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            ${isPlaying
              ? '<rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/>'
              : '<path d="M8 5v14l11-7z"/>'}
          </svg>
        </button>
      </div>`;
  }).join('');
}

function liveTogglePlay(liveIndex) {
  ttsUnlock();
  const entries = currentLineup().filter(e => e.present !== false);
  const entry = entries[liveIndex];
  if (!entry) return;
  // Find real index in full lineup
  const realIndex = currentLineup().indexOf(entry);
  togglePlay(realIndex, { stopPropagation: () => {} });
  // Refresh live view after short delay
  setTimeout(renderLiveLineup, 100);
}

// ── INIT ──
// ═══════════════════════════════════════════
// LICENCE & FEATURES
// SQL requis dans Supabase :
//   create table if not exists licenses (
//     key        uuid primary key default gen_random_uuid(),
//     club_name  text not null,
//     features   jsonb not null default '{}',
//     active     boolean not null default true
//   );
//   alter table licenses enable row level security;
//   create policy "Public read" on licenses for select using (true);
// ═══════════════════════════════════════════
let FEATURES = { overlay: false };

async function loadLicense() {
  try {
    // 1. Lire la clé de licence depuis app_settings
    const res = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.app&select=value`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const data = await res.json();
    const licenseKey = data?.[0]?.value?.appSettings?.licenseKey;
    if (!licenseKey) return;

    // 2. Vérifier la clé dans la table licenses
    const res2 = await fetch(
      `${SUPABASE_URL}/rest/v1/licenses?key=eq.${licenseKey}&active=eq.true&select=features`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await res2.json();
    if (rows?.[0]?.features) {
      FEATURES = { ...FEATURES, ...rows[0].features };
    }
  } catch (err) {
    console.warn('License check failed:', err);
  } finally {
    applyFeatures();
  }
}

function applyFeatures() {
  const btnMatch   = document.getElementById('mainNavMatch');
  const panelMatch = document.getElementById('mainPanelMatch');
  if (btnMatch)   btnMatch.style.display   = FEATURES.overlay ? '' : 'none';
  if (panelMatch) panelMatch.style.display  = FEATURES.overlay ? '' : 'none';
}

// ═══════════════════════════════════════════
// MATCH OVERLAY — état & fonctions opérateur
// ═══════════════════════════════════════════
let matchState = {
  scoreHome: 0, scoreAway: 0,
  inning: 1, inningTop: true,
  balls: 0, strikes: 0, outs: 0,
  batterIdx: 0
};

async function matchSave() {
  try {
    // Lire la valeur actuelle pour ne pas écraser les autres clés
    const res = await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.app&select=value`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    const rows = await res.json();
    const current = rows?.[0]?.value || {};
    await fetch(`${SUPABASE_URL}/rest/v1/config?key=eq.app`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ value: { ...current, matchState } })
    });
  } catch(e) { console.warn('matchSave failed', e); }
}

function matchRenderPanel() {
  document.getElementById('matchScoreHome').textContent = matchState.scoreHome;
  document.getElementById('matchScoreAway').textContent = matchState.scoreAway;
  document.getElementById('matchInningNum').textContent = matchState.inning;
  document.getElementById('matchInningArrow').textContent = matchState.inningTop ? '▲' : '▼';

  ['balls','strikes','outs'].forEach(type => {
    const max = type === 'balls' ? 3 : 2;
    const val = matchState[type];
    const colors = { balls: '#4CAF50', strikes: '#FF9800', outs: '#f44336' };
    document.getElementById('match' + type.charAt(0).toUpperCase() + type.slice(1))
      .querySelectorAll('.match-dot').forEach((dot, i) => {
        dot.style.background = i < val ? colors[type] : 'transparent';
        dot.style.borderColor = i < val ? colors[type] : 'var(--border)';
      });
  });

  const team = teams[currentTeamId];
  const players = team
    ? (team.order || []).map(id => allPlayers[id]).filter(Boolean).filter(p => !p.absent)
    : [];
  const batter = players[matchState.batterIdx % Math.max(players.length, 1)];
  document.getElementById('matchBatterDisplay').textContent = batter
    ? `#${batter.jersey || '—'} ${batter.name} (${batter.position || '—'})`
    : '—';

  const overlayUrl = window.location.origin + window.location.pathname.replace('index.html','') + 'overlay.html';
  document.getElementById('matchOverlayUrl').textContent = overlayUrl;
}

function matchScoreAdj(side, delta) {
  const key = side === 'home' ? 'scoreHome' : 'scoreAway';
  matchState[key] = Math.max(0, matchState[key] + delta);
  matchRenderPanel(); matchSave();
}

function matchInningAdj(delta) {
  matchState.inning = Math.max(1, matchState.inning + delta);
  matchRenderPanel(); matchSave();
}

function matchInningToggle() {
  matchState.inningTop = !matchState.inningTop;
  matchRenderPanel(); matchSave();
}

function matchSetCount(type, idx) {
  matchState[type] = idx + 1 === matchState[type] ? idx : idx + 1;
  matchRenderPanel(); matchSave();
}

function matchResetCount() {
  matchState.balls = 0; matchState.strikes = 0; matchState.outs = 0;
  matchRenderPanel(); matchSave();
}

function matchBatterAdj(delta) {
  const team = teams[currentTeamId];
  const players = team
    ? (team.order || []).map(id => allPlayers[id]).filter(Boolean).filter(p => !p.absent)
    : [];
  if (!players.length) return;
  matchState.batterIdx = (matchState.batterIdx + delta + players.length) % players.length;
  matchRenderPanel(); matchSave();
}

function matchCopyOverlayUrl() {
  const url = document.getElementById('matchOverlayUrl').textContent;
  navigator.clipboard.writeText(url).then(() => showSaveIndicator());
}

async function init() {
  document.getElementById('saveIndicator').textContent = '⏳ Loading...';
  document.getElementById('saveIndicator').classList.add('visible');

  await loadConfig();
  await loadLicense();

  // Restaurer la dernière équipe sélectionnée
  const lastTeamId = localStorage.getItem('lastTeamId');
  if (lastTeamId && teams[lastTeamId]) {
    currentTeamId = lastTeamId;
  }

  updateTeamSelector();
  refreshOpponentSelects();

  // ✅ Reset mode édition au chargement
  document.body.classList.remove('edit-mode');
  const eb = document.getElementById('editModeBtn');
  if (eb) { eb.textContent = '✏️'; eb.title = 'Edit mode'; }
  isEditMode = false;

  document.getElementById('saveIndicator').classList.remove('visible');
  render();
  renderCustomSounds();
  renderLiveLineup();
  renderLiveVisitors();
  renderFieldSongs();
  initLiveMobileTabs();

  const sb = appSettings.soundboard || {};

  // Charger les custom sounds depuis Supabase (fallback localStorage)
  if (sb.customSounds && Array.isArray(sb.customSounds)) {
    liveCustomSounds = sb.customSounds;
  } else {
    // Migration one-shot depuis localStorage
    const local = JSON.parse(localStorage.getItem('liveCustomSounds') || '[]');
    if (local.length > 0) {
      liveCustomSounds = local;
      saveCustomSoundsToConfig(); // migrer vers Supabase
      localStorage.removeItem('liveCustomSounds');
    }
  }
  renderCustomSounds();

  // Charger les sons prédéfinis
  Object.keys(LIVE_SOUNDS).forEach(key => {
    const url = sb[key];
    const label = sb[key + '_label'];
    const cap = key.charAt(0).toUpperCase() + key.slice(1);
    if (label) {
      LIVE_SOUNDS[key].label = label;
      const lbl = document.getElementById('slbl' + cap);
      if (lbl) lbl.textContent = label;
    }
    const btn = document.getElementById('sbtn' + cap);
    const sulbl = document.getElementById('sulbl' + cap);
    if (url) {
      LIVE_SOUNDS[key].url = url;
      btn?.classList.add('has-file');
      btn?.classList.remove('empty');
      if (sulbl) sulbl.childNodes[0].textContent = '📂 replace';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Service worker désactivé temporairement
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js')
//       .then(() => console.log('✅ SW actif'))
//       .catch(err => console.log('SW error:', err));
//   });
// }

// Désenregistre tout SW existant
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => reg.unregister());
  });
}
