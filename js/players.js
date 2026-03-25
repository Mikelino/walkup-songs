/* ============================================================
   Diamond Pulse — js/players.js
   Gestion des joueurs : affichage, ajout, édition, photos

   Fonctions exportées (accessibles globalement) :
   - applyClubSettings()
   - toggleEditMode()
   - render()
   - makeEditable(el, onSave)
   - updateTeamSelector()
   - handleAudioUpload(input)
   - toggleForm()
   - addPlayer()
   - openPhotoMenu(photoDiv, pid)
   - closePhotoMenu()
   - doPhotoUpload(pid, blob)
   - checkAdmin(), addTeam(), renameTeam(), removeTeam()

   Dépend de (globals définis dans data.js ou index.html) :
   - allPlayers, teams, currentTeamId, clubSettings, appSettings
   - isEditMode, sortable, EMOJIS, PLAY_DURATION
   - uploadToSupabase(), saveConfig(), render() (circulaire — OK en global)
   - initSortable(), renderLiveLineup(), renderVisitorsLineup(), renderLiveVisitors()
   - stopPlayback(), openConfig()
   ============================================================ */

async function applyClubSettings() {
  if (clubSettings.name) {
    document.querySelector('.header-club').textContent = clubSettings.name;
    document.querySelector('.cheer-sub').textContent = clubSettings.name;
    document.title = clubSettings.name + (clubSettings.sub ? ' — ' + clubSettings.sub : '');
  }
  if (clubSettings.sub) document.querySelector('.header-sub').textContent = clubSettings.sub;
  if (clubSettings.logo) {
    const img = document.getElementById('headerLogoImg');
    const svg = document.getElementById('headerLogoSvg');
    if (img && svg) {
      img.src = clubSettings.logo;
      img.style.display = 'block';
      svg.style.display = 'none';
    }
    // Mettre à jour le favicon avec le logo du club
    try {
      const res = await fetch(clubSettings.logo);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      let favicon = document.querySelector('link[rel="icon"]');
      if (!favicon) { favicon = document.createElement('link'); favicon.rel = 'icon'; document.head.appendChild(favicon); }
      favicon.type = blob.type;
      favicon.href = blobUrl;
    } catch(e) { /* fallback emoji reste en place */ }
  }
}

function currentLineup() { return teams[currentTeamId].lineup; }

// ✅ Toggle edit mode (AJOUT)
function toggleEditMode() {
  isEditMode = !isEditMode;

  // Stopper toute lecture en entrant en mode édition
  if (isEditMode) stopPlayback();

  // Classe sur body (CSS)
  document.body.classList.toggle('edit-mode', isEditMode);

  // Bouton état
  const btn = document.getElementById('editModeBtn');
  if (btn) {
    btn.title = isEditMode ? 'Exit edit mode' : 'Edit mode';
    btn.textContent = isEditMode ? '✅' : '✏️';
  }

  // Activer/désactiver drag&drop
  if (sortable && typeof sortable.option === 'function') {
    sortable.option('disabled', !isEditMode);
  }

  render();
}

// ── PHOTO CONTEXT MENU ──
let _photoCtxMenu = null;

function closePhotoMenu() {
  if (_photoCtxMenu) { _photoCtxMenu.remove(); _photoCtxMenu = null; }
}

async function openPhotoMenu(photoDiv, pid) {
  closePhotoMenu();
  const menu = document.createElement('div');
  menu.id = 'photoCtxMenu';
  menu.innerHTML = `
    <div class="photo-ctx-item" data-action="recrop">✂️ Recadrer</div>
    <div class="photo-ctx-item" data-action="replace">🔄 Remplacer</div>
    <div class="photo-ctx-item danger" data-action="delete">🗑 Supprimer</div>
  `;
  document.body.appendChild(menu);
  _photoCtxMenu = menu;

  const rect = photoDiv.getBoundingClientRect();
  const mW = 170;
  let left = rect.left;
  if (left + mW > window.innerWidth - 8) left = window.innerWidth - mW - 8;
  menu.style.left = left + 'px';
  menu.style.top  = (rect.bottom + 6) + 'px';

  menu.addEventListener('click', async (e) => {
    const action = e.target.closest('.photo-ctx-item')?.dataset.action;
    if (!action) return;
    closePhotoMenu();

    if (action === 'recrop') {
      const currentUrl = allPlayers[pid].photo.split('?')[0] + '?t=' + Date.now();
      openCropModal(currentUrl, async (croppedBlob) => {
        try { await doPhotoUpload(pid, croppedBlob); }
        catch(err) { alert('Erreur upload: ' + err.message); }
      });
    } else if (action === 'replace') {
      const input = photoDiv.querySelector('input[type="file"]');
      input.click();
    } else if (action === 'delete') {
      if (!confirm('Supprimer la photo ?')) return;
      allPlayers[pid].photo = '';
      render();
      saveConfig();
    }
  });

  setTimeout(() => document.addEventListener('click', closePhotoMenu, { once: true }), 10);
}

async function doPhotoUpload(pid, blob) {
  const safeName = allPlayers[pid].name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const path = `${currentTeamId}/${safeName}.jpg`;

  let res = await fetch(`${SUPABASE_URL}/storage/v1/object/photos/${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: blob,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message || `HTTP ${res.status}`);
  }
  allPlayers[pid].photo = `${SUPABASE_URL}/storage/v1/object/public/photos/${path}?t=${Date.now()}`;
  render();
  saveConfig();
}

// ── RENDER ──
async function render() {
  const lineup = document.getElementById('lineup');
  lineup.innerHTML = '';
  const entries = currentLineup();

  entries.forEach((entry, i) => {
    const player = allPlayers[entry.pid];
    if (!player) return;

    const isPlaying = currentPid === entry.pid;
    const isAbsent = entry.present === false;

    const presentCount = entries.slice(0, i + 1).filter(e => e.present !== false).length;
    const orderNum = isAbsent ? '—' : presentCount;

    const card = document.createElement('div');
    card.className = 'player-card' + (isPlaying ? ' playing' : '') + (isAbsent ? ' absent' : '');
    card.id = 'entry-' + i;
    card.dataset.index = i;

    
  // ── POSITIONS ──
  const BASE_POS = ['P','C','1B','2B','3B','SS','CF','LF','RF'];
  const extra = appSettings.extraPositions || [];
  const ALL_POS = [...BASE_POS, ...extra.map(p => p.code)];

  // Positions autorisées plusieurs fois
  const MULTI_POS = extra.filter(p => p.multi).map(p => p.code);

  // Positions prises par d'autres players : uniquement les positions UNIQUES
  const takenPos = entries
  .map((e, j) => (j !== i ? e.pos : null))
  .filter(p => p && !MULTI_POS.includes(p));

  const posOptions = ALL_POS.map(p => {
  const isMulti = MULTI_POS.includes(p);
  const taken = !isMulti && takenPos.includes(p) && entry.pos !== p;

  return `<option value="${p}" ${entry.pos===p?'selected':''} ${taken?'disabled style="color:#555"':''}>
        ${p}${taken ? ' ✕' : ''}
      </option>`;
  }).join('');

    // ✅ AJOUT classes editable-field sur les champs modifiables
    card.innerHTML = `
      <div class="drag-handle" title="Move">⠿</div>
      <div class="order-num">${orderNum}</div>

      <button class="presence-btn ${isAbsent ? '' : 'present'}" title="${isAbsent ? 'Absent' : 'Present'}"></button>

      <div class="player-avatar">
        <select class="pos-select" title="Position">
          <option value="">?</option>
          ${posOptions}
        </select>
      </div>

      <div class="photo-btn" title="${player.photo ? 'Modifier la photo' : 'Ajouter une photo'}" data-pid="${entry.pid}">
        ${player.photo
          ? `<img src="${player.photo}" class="photo-img" alt="${player.name}"><div class="photo-edit-hint">✏️</div>`
          : `<svg width="28" height="28" viewBox="-16 -44 32 52" fill="none">
               <ellipse cx="0" cy="-18" rx="12" ry="14" class="avatar-head"/>
               <ellipse cx="0" cy="-30" rx="15" ry="7" class="avatar-cap"/>
               <rect x="-15" y="-34" width="30" height="5" rx="2" class="avatar-cap"/>
               <path d="M13,-30 L24,-28 L13,-26 Z" class="avatar-cap"/>
               <rect x="-14" y="-2" width="28" height="20" rx="3" class="avatar-body"/>
             </svg>`
        }
        <input type="file" accept="image/*,.heic,.heif" style="display:none" data-pid="${entry.pid}">
      </div>

      <div class="player-info">
        <div class="player-name-wrap">
          <div class="player-name editable-field" title="Double-click to edit">${player.name}</div>
          ${entry.jersey ? `<span class="jersey-num editable-field" title="Double-click to edit">#${entry.jersey}</span>` : ''}
        </div>
        ${player.pronunciation ? `<div class="player-pronunciation editable-field" title="Double-click to edit pronunciation">🔊 ${player.pronunciation}</div>` : `<div class="player-pronunciation add-pronunciation" title="Add pronunciation">+ pronunciation</div>`}
      </div>

      <div class="song-info">
        <div class="song-title editable-field" title="Double-click to edit">${entry.song || '—'}</div>
        <div class="song-artist editable-field" title="Double-click to edit">${entry.artist || '—'}</div>
      </div>

      <button class="upload-btn ${entry.url ? 'has-file' : ''}" title="${entry.url ? 'File saved — click to change' : 'Upload audio file'}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>
        <input type="file" accept="audio/*" style="display:none" data-entry-index="${i}">
      </button>

      <button class="play-btn ${isPlaying ? 'playing-btn' : ''}" title="Jouer ${entry.song || ''}" ${isAbsent ? 'disabled style="opacity:0.2;pointer-events:none"' : ''}>
        ${isPlaying ? '⏹' : '▶'}
      </button>

      <button class="delete-btn" title="Delete">✕</button>
      <button class="annotate-btn" title="Annoter ce joueur">🎬</button>
      <button class="wbsc-btn" title="Stats WBSC" data-pid="${entry.pid}">📊</button>
    `;

    // Photo button : menu contextuel si photo existante, picker direct sinon
    const photoDiv = card.querySelector('.photo-btn');
    const photoInput = photoDiv.querySelector('input[type="file"]');

    photoDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = photoDiv.dataset.pid;
      if (allPlayers[pid].photo) {
        openPhotoMenu(photoDiv, pid);
      } else {
        photoInput.click();
      }
    });

    photoInput.addEventListener('change', async (e) => {
      e.stopPropagation();
      const file = e.target.files[0];
      if (!file) return;
      const pid = photoDiv.dataset.pid;
      e.target.value = '';
      const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || /\.hei[cf]$/i.test(file.name);
      if (isHeic) {
        if (typeof heic2any === 'function') {
          try {
            const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
            const converted = new File([convertedBlob], file.name.replace(/\.hei[cf]$/i, '.jpg'), { type: 'image/jpeg' });
            openCropModal(converted, async (blob) => {
              try { await doPhotoUpload(pid, blob); }
              catch (err) { alert('Photo upload error: ' + err.message); }
            });
          } catch (err) { alert('Impossible de convertir le fichier HEIC.\nConvertissez-le en JPEG avant de l\'importer.'); }
        } else {
          alert('Format HEIC non supporté.\n• Sur iPhone : Réglages > Appareil photo > Formats > "Compatible"\n• Ou convertissez en JPEG avant d\'importer.');
        }
        return;
      }
      openCropModal(file, async (blob) => {
        try { await doPhotoUpload(pid, blob); }
        catch (err) { alert('Photo upload error: ' + err.message); }
      });
    });

    card.querySelector('.drag-handle').addEventListener('click', (e) => e.stopPropagation());

    card.querySelector('.pos-select').addEventListener('click', (e) => e.stopPropagation());
    card.querySelector('.pos-select').addEventListener('change', (e) => {
      e.stopPropagation();
      currentLineup()[i].pos = e.target.value;
      render();
      saveConfig();
    });

    // Supprimer
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(card.dataset.index);
      if (confirm(`Remove ${player.name} from this team?`)) {
        if (currentPid === entry.pid) stopPlayback();
        currentLineup().splice(idx, 1);
        render();
        saveConfig();
      }
    });

    // Nom du player — double-clic pour modifier
    card.querySelector('.player-name').addEventListener('dblclick', (e) => {
      e.stopPropagation();
      makeEditable(card.querySelector('.player-name'), val => {
        allPlayers[entry.pid].name = val;
        render();
        saveConfig();
      });
    });
    card.querySelector('.player-name').addEventListener('click', (e) => e.stopPropagation());

    // Numéro de maillot — double-clic pour modifier
    const jerseyEl = card.querySelector('.jersey-num');
    if (jerseyEl) {
      jerseyEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        makeEditable(jerseyEl, val => {
          currentLineup()[i].jersey = val.replace('#', '');
          saveConfig();
        }, true);
      });
      jerseyEl.addEventListener('click', (e) => e.stopPropagation());
    } else {
      const wrap = card.querySelector('.player-name-wrap');
      const addJerseyBtn = document.createElement('span');
      addJerseyBtn.className = 'add-jersey-btn';
      addJerseyBtn.textContent = '+#';
      addJerseyBtn.title = 'Add jersey number';
      addJerseyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const num = prompt('Jersey number:');
        if (num && num.trim()) {
          currentLineup()[i].jersey = num.trim().replace('#', '');
          render();
          saveConfig();
        }
      });
      wrap.appendChild(addJerseyBtn);
    }

    // Prononciation — double-clic pour modifier (ou clic sur "+ pronunciation")
    const pronEl = card.querySelector('.player-pronunciation');
    const addPronEl = card.querySelector('.add-pronunciation');
    const editPron = (el) => {
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const current = allPlayers[entry.pid].pronunciation || '';
        makeEditable(el, val => {
          allPlayers[entry.pid].pronunciation = val || null;
          render();
          saveConfig();
        }, false, current);
      });
      el.addEventListener('click', (e) => e.stopPropagation());
    };
    if (pronEl) editPron(pronEl);
    if (addPronEl) {
      addPronEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const val = prompt('Pronunciation (phonetic):', allPlayers[entry.pid].pronunciation || '');
        if (val !== null) {
          allPlayers[entry.pid].pronunciation = val.trim() || null;
          render();
          saveConfig();
        }
      });
    }

    // Édition titre et artiste au double-clic
    card.querySelector('.song-title').addEventListener('dblclick', (e) => {
      e.stopPropagation();
      makeEditable(e.target, val => {
        currentLineup()[i].song = val;
        saveConfig();
      });
    });

    card.querySelector('.song-artist').addEventListener('dblclick', (e) => {
      e.stopPropagation();
      makeEditable(e.target, val => {
        currentLineup()[i].artist = val;
        saveConfig();
      });
    });

    card.querySelector('.song-title').addEventListener('click', (e) => e.stopPropagation());
    card.querySelector('.song-artist').addEventListener('click', (e) => e.stopPropagation());

    // Upload fichier audio → Supabase
    card.querySelector('.upload-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      card.querySelector('input[type="file"]').click();
    });
    card.querySelector('input[type="file"]').addEventListener('click', (e) => e.stopPropagation());
    card.querySelector('input[type="file"]').addEventListener('change', async (e) => {
      e.stopPropagation();
      const file = e.target.files[0];
      if (!file) return;

      const idx = parseInt(e.target.dataset.entryIndex);
      const entry = currentLineup()[idx];
      const player = allPlayers[entry.pid];

      const label = card.querySelector('.upload-btn');
      label.textContent = '⏳';

      try {
        const publicUrl = await uploadToSupabase(file, currentTeamId, player.name);
        currentLineup()[idx].url = publicUrl;
        currentLineup()[idx].blobUrl = null;
        render();
        saveConfig();
      } catch (err) {
        label.textContent = '❌';
        alert('Upload error: ' + err.message);
        setTimeout(() => render(), 2000);
      }
    });

    // Présence
    card.querySelector('.presence-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(card.dataset.index);
      const wasPresent = currentLineup()[idx].present !== false;
      currentLineup()[idx].present = !wasPresent;

      if (!wasPresent === false && currentPid === entry.pid) stopPlayback();

      // Déplacer absent en fin de liste + reset position
      if (currentLineup()[idx].present === false) {
        currentLineup()[idx].pos = '?';
        const removed = currentLineup().splice(idx, 1)[0];
        currentLineup().push(removed);
      }
      render();
      saveConfig();
    });

    // Annoter ce joueur → ouvre annotator.html#player-{pid}
    card.querySelector('.annotate-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const pid = entry.pid;
      const base = location.href.replace(/\/[^/?#]*([?#].*)?$/, '/annotator.html');
      window.open(`${base}#player-${pid}`, '_blank');
    });

    // Stats WBSC
    card.querySelector('.wbsc-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      wbscOpen(entry.pid);
    });

    // ✅ Clic carte : bloqué en mode édition (AJOUT)
    card.addEventListener('click', (e) => {
      if (isEditMode) return;
      if (isAbsent) return;
      togglePlay(parseInt(card.dataset.index), e);
    });

    lineup.appendChild(card);
  });

  if (typeof initSortable === 'function') initSortable();
  if (typeof renderLiveLineup     === 'function') renderLiveLineup();
  if (typeof renderVisitorsLineup === 'function') renderVisitorsLineup();
  if (typeof renderLiveVisitors   === 'function') renderLiveVisitors();
}

// ── ÉDITION INLINE ──
function makeEditable(el, onSave) {
  const original = el.textContent === '—' ? '' : el.textContent;
  el.contentEditable = 'true';
  el.classList.add('editing');
  el.focus();

  // Sélectionne tout le texte
  const range = document.createRange();
  range.selectNodeContents(el);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  const done = () => {
    el.contentEditable = 'false';
    el.classList.remove('editing');
    const newVal = el.textContent.trim();
    if (newVal && newVal !== original) {
      el.textContent = newVal;
      onSave(newVal);
    } else {
      el.textContent = original;
    }
  };

  el.addEventListener('blur', done, { once: true });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
    if (e.key === 'Escape') { el.textContent = original; el.blur(); }
    e.stopPropagation();
  });
}


// ── TEAM SELECTOR ──

// ── GESTION ÉQUIPES (CONFIG PAGE) ──
function checkAdmin() {
  const pwd = prompt('Admin password:');
  return pwd === appSettings.adminPassword;
}

// Anciens prompts conservés (appelés uniquement depuis la config page désormais)
function addTeam() { openConfig(); }
function renameTeam() { openConfig(); }
function removeTeam() { openConfig(); }

function updateTeamSelector() {
  const sel = document.getElementById('teamSelect');
  sel.innerHTML = Object.entries(teams)
    .map(([key, t]) => `<option value="${key}" ${key === currentTeamId ? 'selected' : ''}>${t.label}</option>`)
    .join('');
}

function handleAudioUpload(input) {
  const file = input.files[0];
  if (!file) return;

  uploadedAudioFile = file;

  if (uploadedAudioURL && uploadedAudioURL.startsWith('blob:')) {
    URL.revokeObjectURL(uploadedAudioURL);
  }

  uploadedAudioURL = URL.createObjectURL(file);

  const preview = document.getElementById('audioPreview');
  preview.src = uploadedAudioURL;
  preview.style.display = 'block';

  const label = document.getElementById('audioUploadLabel');
  document.getElementById('audioUploadText').textContent = '🎵 ' + file.name;
  label.classList.add('has-file');
}

function toggleForm() {
  document.getElementById('addForm').classList.toggle('open');
}

async function addPlayer() {
  const name          = document.getElementById('newName').value.trim();
  const pronunciation = document.getElementById('newPronunciation').value.trim();
  const jersey = document.getElementById('newJersey').value.trim();
  const pos = document.getElementById('newPos').value;
  const song = document.getElementById('newSong').value.trim();
  const artist = document.getElementById('newArtist').value.trim();
  const start = parseInt(document.getElementById('newStart').value) || 0;

  if (!name) { alert('Player name is required!'); return; }

  // Upload du fichier audio sur Supabase si présent
  let url = uploadedAudioURL || '';
  if (uploadedAudioFile) {
    const addBtn = document.querySelector('.add-btn');
    addBtn.textContent = '⏳ Uploading…';
    addBtn.disabled = true;

    try {
      url = await uploadToSupabase(uploadedAudioFile, currentTeamId, name);
    } catch (err) {
      alert('Audio upload error: ' + err.message);
      addBtn.textContent = 'Add';
      addBtn.disabled = false;
      return;
    }

    addBtn.textContent = 'Add';
    addBtn.disabled = false;
  }

  // Cherche si ce player existe déjà dans allPlayers
  let pid = Object.keys(allPlayers).find(k => allPlayers[k].name.toLowerCase() === name.toLowerCase());
  if (!pid) {
    pid = Date.now();
    allPlayers[pid] = {
      name,
      pronunciation: pronunciation || null,
      emoji: EMOJIS[Object.keys(allPlayers).length % EMOJIS.length]
    };
  } else if (pronunciation) {
    allPlayers[pid].pronunciation = pronunciation;
  }

  if (currentLineup().find(e => e.pid == pid)) {
    alert('This player is already on this team!');
    return;
  }

  currentLineup().push({ pid: parseInt(pid) || pid, pos, jersey, song, artist, url, start, present: true });

  // Reset form
  ['newName','newPronunciation','newSong','newArtist','newJersey'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('newPos').value = '';
  document.getElementById('newStart').value = '0';
  document.getElementById('newAudioFile').value = '';
  document.getElementById('audioUploadText').textContent = '📂 Choose an mp3 / wav file…';
  document.getElementById('audioUploadLabel').classList.remove('has-file');
  document.getElementById('audioPreview').style.display = 'none';
  document.getElementById('audioPreview').src = '';

  uploadedAudioURL = null;
  uploadedAudioFile = null;

  document.getElementById('addForm').classList.remove('open');
  render();
  saveConfig();
}


// ══════════════════════════════════════════════════════════════
//  WBSC STATS IMPORT
//  Fetches player stats from baseballsoftball.be via a Supabase
//  Edge Function proxy (to avoid CORS).
// ══════════════════════════════════════════════════════════════

const WBSC_FED_ID   = 143; // Belgian federation
const WBSC_CATEGORIES = ['D1','D2','BU18','BU15','BU12','SU18','SU15','SU12'];

// ── Modal HTML (injected once into body) ──
function wbscEnsureModal() {
  if (document.getElementById('wbscModal')) return;
  const el = document.createElement('div');
  el.id = 'wbscModal';
  el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:500;align-items:center;justify-content:center';
  el.innerHTML = `
    <div style="background:var(--darkgray);border:1px solid var(--border);border-top:3px solid var(--orange);border-radius:6px;padding:28px 24px;width:520px;max-width:95vw;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px" onclick="event.stopPropagation()">
      <div style="font-family:'Oswald',sans-serif;font-size:18px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--white)">📊 Stats WBSC</div>
      <div id="wbscPlayerName" style="font-family:'Oswald',sans-serif;font-size:14px;color:var(--orange)"></div>

      <!-- URL input -->
      <div id="wbscInputSection" style="display:flex;flex-direction:column;gap:10px">
        <label style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase">URL MyBallClub du joueur</label>
        <div style="display:flex;gap:8px">
          <input id="wbscUrlInput" type="text" placeholder="https://www.baseballsoftball.be/en/events/.../players/XXXXX"
            style="flex:1;background:var(--gray);border:1px solid var(--border);border-radius:3px;color:var(--white);padding:9px 12px;font-family:'Barlow Condensed',sans-serif;font-size:13px;outline:none"
            onfocus="this.style.borderColor='var(--orange)'" onblur="this.style.borderColor='var(--border)'"/>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <label style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1px;color:var(--muted);text-transform:uppercase;white-space:nowrap">Catégorie</label>
          <select id="wbscCategory" style="background:var(--gray);border:1px solid var(--border);border-radius:3px;color:var(--white);padding:8px 10px;font-family:'Barlow Condensed',sans-serif;font-size:13px">
            ${WBSC_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <button onclick="wbscFetchStats()" id="wbscFetchBtn"
            style="padding:9px 20px;background:var(--orange);border:none;border-radius:3px;color:#fff;font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">
            Charger
          </button>
        </div>
        <div id="wbscError" style="display:none;color:#ff4444;font-size:12px;font-family:'Barlow Condensed',sans-serif"></div>
      </div>

      <!-- Stats display -->
      <div id="wbscStatsSection" style="display:none;flex-direction:column;gap:12px">
        <div id="wbscBatting"></div>
        <div id="wbscPitching"></div>
        <div id="wbscFielding"></div>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
        <button onclick="wbscSaveId()" id="wbscSaveBtn" style="display:none;padding:8px 16px;background:var(--orange);border:none;border-radius:3px;color:#fff;font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;cursor:pointer">💾 Sauvegarder l'ID</button>
        <button onclick="wbscClose()" style="padding:8px 16px;background:transparent;border:1px solid var(--border);border-radius:3px;color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;cursor:pointer">Fermer</button>
      </div>
    </div>`;
  el.addEventListener('click', wbscClose);
  document.body.appendChild(el);
}

let _wbscCurrentPid = null;
let _wbscCurrentPId = null; // WBSC numeric ID

function wbscOpen(pid) {
  wbscEnsureModal();
  _wbscCurrentPid = pid;
  _wbscCurrentPId = null;
  const player = allPlayers[pid];
  document.getElementById('wbscPlayerName').textContent = player?.name || '';
  document.getElementById('wbscUrlInput').value = player?.wbscUrl || '';
  document.getElementById('wbscError').style.display = 'none';
  document.getElementById('wbscStatsSection').style.display = 'none';
  document.getElementById('wbscSaveBtn').style.display = 'none';
  document.getElementById('wbscInputSection').style.display = 'flex';

  // Pre-fill category from saved data
  if (player?.wbscCategory) {
    const sel = document.getElementById('wbscCategory');
    sel.value = player.wbscCategory;
  }

  const modal = document.getElementById('wbscModal');
  modal.style.display = 'flex';

  // Auto-load if wbscId already saved
  if (player?.wbscId) {
    _wbscCurrentPId = player.wbscId;
    const cat = player.wbscCategory || 'D1';
    document.getElementById('wbscCategory').value = cat;
    wbscLoadStats(player.wbscId, cat);
  }
}

function wbscClose() {
  const modal = document.getElementById('wbscModal');
  if (modal) modal.style.display = 'none';
}

async function wbscFetchStats() {
  const url      = document.getElementById('wbscUrlInput').value.trim();
  const category = document.getElementById('wbscCategory').value;
  const errEl    = document.getElementById('wbscError');
  const btn      = document.getElementById('wbscFetchBtn');
  errEl.style.display = 'none';

  if (!url) { errEl.textContent = 'Collez l\'URL de la page joueur MyBallClub.'; errEl.style.display = 'block'; return; }

  btn.textContent = '⏳'; btn.disabled = true;

  try {
    // 1. Fetch the player page HTML via Edge Function proxy to extract pId
    const proxyUrl = `${SUPABASE_URL}/functions/v1/wbsc-proxy?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, { headers: { 'Authorization': `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) throw new Error(`Proxy error ${res.status}`);
    const html = await res.text();

    // 2. Extract pId from HTML
    const match = html.match(/\/v1\/player\/stats\?pId=(\d+)/);
    if (!match) throw new Error('ID joueur WBSC introuvable dans la page. Vérifiez l\'URL.');
    const pId = match[1];
    _wbscCurrentPId = pId;

    // Save URL in player profile
    if (_wbscCurrentPid && allPlayers[_wbscCurrentPid]) {
      allPlayers[_wbscCurrentPid].wbscUrl = url;
    }

    await wbscLoadStats(pId, category);
  } catch(err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  } finally {
    btn.textContent = 'Charger'; btn.disabled = false;
  }
}

async function wbscLoadStats(pId, category) {
  const errEl = document.getElementById('wbscError');
  try {
    const statsUrl = `https://www.baseballsoftball.be/api/v1/player/stats?pId=${pId}&lang=en&tab=career&fedId=${WBSC_FED_ID}&eventCategory=${category}`;
    const proxyUrl = `${SUPABASE_URL}/functions/v1/wbsc-proxy?url=${encodeURIComponent(statsUrl)}`;
    const res = await fetch(proxyUrl, { headers: { 'Authorization': `Bearer ${SUPABASE_KEY}` } });
    if (!res.ok) throw new Error(`Stats error ${res.status}`);
    const data = await res.json();

    wbscRenderStats(data);
    document.getElementById('wbscStatsSection').style.display = 'flex';
    document.getElementById('wbscSaveBtn').style.display = 'inline-block';
  } catch(err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
}

function wbscRenderStats(data) {
  const batting  = data.batting  || [];
  const pitching = data.pitching || [];
  const fielding = data.fielding || [];

  const fmt3 = v => (v != null && v !== '') ? parseFloat(v).toFixed(3).replace('0.', '.') : '—';
  const fmtN = v => (v != null && v !== '') ? v : '—';

  const tableStyle = 'width:100%;border-collapse:collapse;font-family:"Barlow Condensed",sans-serif;font-size:12px';
  const thStyle    = 'padding:6px 8px;text-align:center;background:var(--gray);color:var(--orange);letter-spacing:1px;text-transform:uppercase;white-space:nowrap';
  const tdStyle    = 'padding:5px 8px;text-align:center;border-bottom:1px solid var(--border);color:var(--white)';
  const tdLStyle   = 'padding:5px 8px;text-align:left;border-bottom:1px solid var(--border);color:var(--muted)';
  const titleStyle = 'font-family:"Oswald",sans-serif;font-size:13px;font-weight:700;letter-spacing:2px;color:var(--orange);text-transform:uppercase;margin-bottom:6px';

  // ── BATTING ──
  const batEl = document.getElementById('wbscBatting');
  if (batting.length) {
    const rows = batting.map(r => `
      <tr>
        <td style="${tdLStyle}">${r.year}</td>
        <td style="${tdLStyle}">${r.teamcode}</td>
        <td style="${tdStyle}">${fmtN(r.g)}</td>
        <td style="${tdStyle}">${fmtN(r.ab)}</td>
        <td style="${tdStyle}">${fmtN(r.h)}</td>
        <td style="${tdStyle}">${fmtN(r.double)}</td>
        <td style="${tdStyle}">${fmtN(r.hr)}</td>
        <td style="${tdStyle}">${fmtN(r.rbi)}</td>
        <td style="${tdStyle}">${fmtN(r.bb)}</td>
        <td style="${tdStyle}">${fmtN(r.so)}</td>
        <td style="${tdStyle}">${fmtN(r.sb)}</td>
        <td style="${tdStyle}" style="color:var(--orange);font-weight:700">${fmt3(r.avg)}</td>
        <td style="${tdStyle}">${fmt3(r.obp)}</td>
        <td style="${tdStyle}">${fmt3(r.ops)}</td>
      </tr>`).join('');
    batEl.innerHTML = `
      <div style="${titleStyle}">⚾ Batting</div>
      <div style="overflow-x:auto">
      <table style="${tableStyle}">
        <thead><tr>
          <th style="${thStyle}">Year</th><th style="${thStyle}">Team</th>
          <th style="${thStyle}">G</th><th style="${thStyle}">AB</th><th style="${thStyle}">H</th>
          <th style="${thStyle}">2B</th><th style="${thStyle}">HR</th><th style="${thStyle}">RBI</th>
          <th style="${thStyle}">BB</th><th style="${thStyle}">SO</th><th style="${thStyle}">SB</th>
          <th style="${thStyle}">AVG</th><th style="${thStyle}">OBP</th><th style="${thStyle}">OPS</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  } else {
    batEl.innerHTML = '';
  }

  // ── PITCHING ──
  const pitEl = document.getElementById('wbscPitching');
  if (pitching.length) {
    const rows = pitching.map(r => `
      <tr>
        <td style="${tdLStyle}">${r.year}</td>
        <td style="${tdLStyle}">${r.teamcode}</td>
        <td style="${tdStyle}">${fmtN(r.pitch_win)}-${fmtN(r.pitch_loss)}</td>
        <td style="${tdStyle}">${fmtN(r.pitch_appear)}</td>
        <td style="${tdStyle}">${fmtN(r.pitch_ip)}</td>
        <td style="${tdStyle}">${fmtN(r.pitch_h)}</td>
        <td style="${tdStyle}">${fmtN(r.pitch_bb)}</td>
        <td style="${tdStyle}">${fmtN(r.pitch_so)}</td>
        <td style="${tdStyle}">${fmtN(r.pitch_er)}</td>
        <td style="${tdStyle}" style="color:var(--orange);font-weight:700">${fmt3(r.era)}</td>
        <td style="${tdStyle}">${fmt3(r.pitch_whip)}</td>
      </tr>`).join('');
    pitEl.innerHTML = `
      <div style="${titleStyle}">⚡ Pitching</div>
      <div style="overflow-x:auto">
      <table style="${tableStyle}">
        <thead><tr>
          <th style="${thStyle}">Year</th><th style="${thStyle}">Team</th>
          <th style="${thStyle}">W-L</th><th style="${thStyle}">APP</th><th style="${thStyle}">IP</th>
          <th style="${thStyle}">H</th><th style="${thStyle}">BB</th><th style="${thStyle}">SO</th>
          <th style="${thStyle}">ER</th><th style="${thStyle}">ERA</th><th style="${thStyle}">WHIP</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  } else {
    pitEl.innerHTML = '';
  }

  // ── FIELDING ──
  const fldEl = document.getElementById('wbscFielding');
  if (fielding.length) {
    const rows = fielding.map(r => `
      <tr>
        <td style="${tdLStyle}">${r.year}</td>
        <td style="${tdLStyle}">${r.teamcode}</td>
        <td style="${tdStyle}">${fmtN(r.pos)}</td>
        <td style="${tdStyle}">${fmtN(r.field_g)}</td>
        <td style="${tdStyle}">${fmtN(r.field_po)}</td>
        <td style="${tdStyle}">${fmtN(r.field_a)}</td>
        <td style="${tdStyle}">${fmtN(r.field_e)}</td>
        <td style="${tdStyle}" style="color:var(--orange);font-weight:700">${fmt3(r.fldp)}</td>
      </tr>`).join('');
    fldEl.innerHTML = `
      <div style="${titleStyle}">🧤 Fielding</div>
      <div style="overflow-x:auto">
      <table style="${tableStyle}">
        <thead><tr>
          <th style="${thStyle}">Year</th><th style="${thStyle}">Team</th><th style="${thStyle}">Pos</th>
          <th style="${thStyle}">G</th><th style="${thStyle}">PO</th><th style="${thStyle}">A</th>
          <th style="${thStyle}">E</th><th style="${thStyle}">FLDP</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table></div>`;
  } else {
    fldEl.innerHTML = '';
  }

  // If no stats at all
  if (!batting.length && !pitching.length && !fielding.length) {
    document.getElementById('wbscBatting').innerHTML =
      `<div style="color:var(--muted);font-family:'Barlow Condensed',sans-serif;font-size:13px;text-align:center;padding:16px">Aucune statistique disponible pour cette catégorie.</div>`;
  }
}

function wbscSaveId() {
  if (!_wbscCurrentPid || !_wbscCurrentPId) return;
  const category = document.getElementById('wbscCategory').value;
  allPlayers[_wbscCurrentPid].wbscId       = _wbscCurrentPId;
  allPlayers[_wbscCurrentPid].wbscCategory = category;
  saveConfig();
  const btn = document.getElementById('wbscSaveBtn');
  btn.textContent = '✓ Sauvegardé';
  setTimeout(() => { btn.textContent = '💾 Sauvegarder l\'ID'; }, 2000);
}