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

function openPhotoMenu(photoDiv, pid) {
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
function render() {
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
        <input type="file" accept="image/*" style="display:none" data-pid="${entry.pid}">
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

    // ✅ Clic carte : bloqué en mode édition (AJOUT)
    card.addEventListener('click', (e) => {
      if (isEditMode) return;
      if (isAbsent) return;
      togglePlay(parseInt(card.dataset.index), e);
    });

    lineup.appendChild(card);
  });

  if (typeof initSortable === 'function') initSortable();
  renderLiveLineup();
  renderVisitorsLineup();
  renderLiveVisitors();
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

