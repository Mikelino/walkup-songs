/* ============================================================
   Diamond Pulse — js/sponsors.js
   ADS panel: Sponsor management (CRUD, logo upload, drag & drop)

   Data functions:
   - loadSponsors(clubId)
   - saveSponsor(sponsor)
   - deleteSponsor(id)
   - uploadSponsorLogo(clubId, file)
   - getActiveSponsorsByTier(clubId, tier)
   - updateSponsorOrder(sponsorIds)
   - loadSponsorSettings()
   - saveSponsorSettings(settings)

   UI functions (ADS config panel):
   - adsRenderPanel()
   - adsRenderList(tier)
   - adsOpenForm(sponsor, tier)
   - adsCloseForm()
   - adsHandleLogoPreview(input)
   - adsSaveSponsor()
   - adsDeleteSponsor(id, tier)
   - adsToggleActive(id, tier, active)
   - adsSaveSettings()

   Depends on globals:
   - SUPABASE_URL, SUPABASE_KEY, APP_CONFIG
   - appSettings, saveConfig(), showSaveIndicator()
   - Sortable.js
   ============================================================ */

// ── STATE ──
let _adsSponsors        = { gold: [], silver: [], bronze: [] };
let _adsSponsorSettings = { max_gold: 3, max_silver: 5, max_bronze: 10 };
let _adsLogoFile        = null;
let _adsCurrentId       = null;
let _adsCurrentTier     = null;

function _adsHeaders() {
  return {
    'apikey':        SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type':  'application/json',
  };
}

// ═══════════════════════════════════════════════════════════
// DATA FUNCTIONS
// ═══════════════════════════════════════════════════════════

async function loadSponsors(clubId) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sponsors?club_id=eq.${encodeURIComponent(clubId)}&order=tier,display_order`,
    { headers: _adsHeaders() }
  );
  if (!res.ok) throw new Error(`loadSponsors: ${res.status}`);
  return res.json();
}

async function saveSponsor(sponsor) {
  const method = sponsor.id ? 'PATCH' : 'POST';
  const url = sponsor.id
    ? `${SUPABASE_URL}/rest/v1/sponsors?id=eq.${sponsor.id}`
    : `${SUPABASE_URL}/rest/v1/sponsors`;
  const body = { ...sponsor };
  if (!body.id) delete body.id;

  const res = await fetch(url, {
    method,
    headers: { ..._adsHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`saveSponsor: ${await res.text()}`);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function deleteSponsor(id) {
  // Remove logo from storage if present
  const sponsor = Object.values(_adsSponsors).flat().find(s => s.id === id);
  if (sponsor?.logo_url) {
    try {
      const path = sponsor.logo_url.split('/sponsors/')[1]?.split('?')[0];
      if (path) {
        await fetch(`${SUPABASE_URL}/storage/v1/object/sponsors/${path}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'apikey': SUPABASE_KEY },
        });
      }
    } catch (e) { console.warn('[ADS] logo cleanup:', e); }
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/sponsors?id=eq.${id}`, {
    method: 'DELETE',
    headers: _adsHeaders(),
  });
  if (!res.ok) throw new Error(`deleteSponsor: ${res.status}`);
}

async function uploadSponsorLogo(clubId, file) {
  // Resize to 400×200 PNG, centered, transparent background
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width  = 400;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  const scale = Math.min(400 / bitmap.width, 200 / bitmap.height);
  const w = bitmap.width  * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (400 - w) / 2, (200 - h) / 2, w, h);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const uuid  = crypto.randomUUID();
  const path  = `${clubId}/${uuid}.png`;

  let res = await fetch(`${SUPABASE_URL}/storage/v1/object/sponsors/${path}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
    body: blob,
  });
  if (!res.ok && res.status === 409) {
    res = await fetch(`${SUPABASE_URL}/storage/v1/object/sponsors/${path}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'image/png', 'x-upsert': 'true' },
      body: blob,
    });
  }
  if (!res.ok) throw new Error('uploadSponsorLogo failed');
  return `${SUPABASE_URL}/storage/v1/object/public/sponsors/${path}`;
}

async function getActiveSponsorsByTier(clubId, tier) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/sponsors?club_id=eq.${encodeURIComponent(clubId)}&tier=eq.${tier}&active=eq.true&order=display_order.asc`,
    { headers: _adsHeaders() }
  );
  if (!res.ok) return [];
  return res.json();
}

async function updateSponsorOrder(sponsorIds) {
  await Promise.all(sponsorIds.map((id, idx) =>
    fetch(`${SUPABASE_URL}/rest/v1/sponsors?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ..._adsHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ display_order: idx }),
    })
  ));
}

async function loadSponsorSettings() {
  const { data } = await window.supabase
    .from('config')
    .select('value')
    .eq('key', 'sponsor_settings')
    .single();
  return data?.value ?? { max_gold: 3, max_silver: 5, max_bronze: 10 };
}

async function saveSponsorSettings(settings) {
  await window.supabase
    .from('config')
    .upsert({ key: 'sponsor_settings', value: settings, updated_at: new Date().toISOString() });
}

// ═══════════════════════════════════════════════════════════
// UI FUNCTIONS
// ═══════════════════════════════════════════════════════════

async function adsRenderPanel() {
  const clubId = APP_CONFIG.clubId || 'default';
  let rows = [];
  try {
    rows = await loadSponsors(clubId);
  } catch (e) {
    console.error('[ADS] loadSponsors:', e);
  }

  _adsSponsors = { gold: [], silver: [], bronze: [] };
  rows.forEach(s => { if (_adsSponsors[s.tier]) _adsSponsors[s.tier].push(s); });

  const settings = await loadSponsorSettings();
  document.getElementById('adsMaxGold').value   = settings.max_gold   ?? 3;
  document.getElementById('adsMaxSilver').value = settings.max_silver ?? 5;
  document.getElementById('adsMaxBronze').value = settings.max_bronze ?? 10;

  // Cache for sync use in adsRenderList / adsSaveSponsor
  _adsSponsorSettings = settings;

  ['gold', 'silver', 'bronze'].forEach(tier => adsRenderList(tier));
}

function adsRenderList(tier) {
  const cap  = tier.charAt(0).toUpperCase() + tier.slice(1);
  const list = document.getElementById(`adsList${cap}`);
  if (!list) return;

  const sponsors = _adsSponsors[tier] || [];
  const settings = _adsSponsorSettings;
  const atLimit  = sponsors.length >= (settings[`max_${tier}`] || 99);

  const addBtn = document.getElementById(`adsAdd${cap}Btn`);
  if (addBtn) {
    addBtn.disabled = atLimit;
    addBtn.title = atLimit ? `Limit of ${settings[`max_${tier}`]} ${tier} sponsors reached` : '';
  }

  list.innerHTML = '';

  if (!sponsors.length) {
    list.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:12px 0">No sponsors yet.</div>';
    if (tier === 'gold') _adsAppendGoldNote(list);
    return;
  }

  sponsors.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'ads-sponsor-item';
    item.dataset.id = s.id;
    item.innerHTML = `
      ${tier === 'gold' ? `<span class="ads-position-badge">#${idx + 1}</span>` : ''}
      <span class="ads-drag-handle" title="Drag to reorder">⠿</span>
      ${s.logo_url
        ? `<img src="${s.logo_url}" alt="${s.name}" class="ads-logo-thumb" crossorigin="anonymous">`
        : `<div class="ads-logo-placeholder">${s.name.charAt(0).toUpperCase()}</div>`
      }
      <div class="ads-sponsor-info">
        <div class="ads-sponsor-name">${s.name}</div>
        ${s.website_url ? `<div class="ads-sponsor-url">${s.website_url}</div>` : ''}
      </div>
      <label class="ads-toggle" title="${s.active ? 'Active' : 'Inactive'}">
        <input type="checkbox" ${s.active ? 'checked' : ''} onchange="adsToggleActive('${s.id}','${tier}',this.checked)">
        <span class="ads-toggle-slider"></span>
      </label>
      <button class="ads-edit-btn" onclick="adsOpenFormById('${s.id}','${tier}')" title="Edit">✏️</button>
      <button class="ads-del-btn"  onclick="adsDeleteSponsor('${s.id}','${tier}')" title="Delete">🗑️</button>
    `;
    list.appendChild(item);
  });

  if (tier === 'gold') _adsAppendGoldNote(list);

  if (typeof Sortable !== 'undefined') {
    Sortable.create(list, {
      handle:    '.ads-drag-handle',
      animation: 150,
      onEnd: async () => {
        const ids = [...list.querySelectorAll('.ads-sponsor-item')].map(el => el.dataset.id);
        _adsSponsors[tier] = ids.map(id => _adsSponsors[tier].find(s => s.id === id)).filter(Boolean);
        // Refresh position badges after reorder (gold only)
        if (tier === 'gold') {
          list.querySelectorAll('.ads-position-badge').forEach((badge, i) => {
            badge.textContent = `#${i + 1}`;
          });
        }
        try { await updateSponsorOrder(ids); }
        catch (e) { console.error('[ADS] updateOrder:', e); }
      },
    });
  }
}

function _adsAppendGoldNote(list) {
  const note = document.createElement('div');
  note.className = 'ads-gold-note';
  note.textContent = '⚠️ L\'ordre est fixe — le sponsor #1 apparaît toujours en premier dans l\'overlay.';
  list.parentElement.appendChild(note);
}

function adsOpenFormById(id, tier) {
  const sponsor = _adsSponsors[tier]?.find(s => s.id === id) || null;
  adsOpenForm(sponsor, tier);
}

function adsOpenForm(sponsor, tier) {
  _adsCurrentId   = sponsor?.id   || null;
  _adsCurrentTier = sponsor?.tier || tier;
  _adsLogoFile    = null;

  document.getElementById('adsSponsorId').value       = sponsor?.id          || '';
  document.getElementById('adsSponsorTier').value     = _adsCurrentTier;
  document.getElementById('adsSponsorName').value     = sponsor?.name        || '';
  document.getElementById('adsSponsorUrl').value      = sponsor?.website_url || '';
  document.getElementById('adsLogoText').textContent  = '📂 Choose an image…';
  document.getElementById('adsLogoFile').value        = '';

  const preview = document.getElementById('adsLogoPreview');
  const img     = document.getElementById('adsLogoImg');
  if (sponsor?.logo_url) {
    img.src = sponsor.logo_url;
    preview.style.display = 'flex';
  } else {
    preview.style.display = 'none';
    img.src = '';
  }

  const form = document.getElementById('adsSponsorForm');
  form.style.display = 'block';
  form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function adsCloseForm() {
  document.getElementById('adsSponsorForm').style.display = 'none';
  _adsCurrentId   = null;
  _adsCurrentTier = null;
  _adsLogoFile    = null;
}

function adsHandleLogoPreview(input) {
  const file = input.files[0];
  if (!file) return;
  _adsLogoFile = file;
  document.getElementById('adsLogoText').textContent = '🖼️ ' + file.name;
  const preview = document.getElementById('adsLogoPreview');
  const img     = document.getElementById('adsLogoImg');
  img.src = URL.createObjectURL(file);
  preview.style.display = 'flex';
}

async function adsSaveSponsor() {
  const clubId = APP_CONFIG.clubId || 'default';
  const name   = document.getElementById('adsSponsorName').value.trim();
  const url    = document.getElementById('adsSponsorUrl').value.trim();
  const tier   = _adsCurrentTier;

  if (!name) { alert('Please enter a sponsor name.'); return; }

  const settings = _adsSponsorSettings;
  if (!_adsCurrentId && (_adsSponsors[tier]?.length || 0) >= (settings[`max_${tier}`] || 99)) {
    alert(`Cannot add more ${tier} sponsors (limit: ${settings[`max_${tier}`]}).`);
    return;
  }

  let logoUrl = _adsCurrentId
    ? (Object.values(_adsSponsors).flat().find(s => s.id === _adsCurrentId)?.logo_url || null)
    : null;

  if (_adsLogoFile) {
    try {
      logoUrl = await uploadSponsorLogo(clubId, _adsLogoFile);
    } catch (e) {
      console.error('[ADS] logo upload:', e);
      alert('Logo upload failed. Sponsor will be saved without logo.');
    }
  }

  const existingOrder = _adsCurrentId
    ? (Object.values(_adsSponsors).flat().find(s => s.id === _adsCurrentId)?.display_order ?? _adsSponsors[tier]?.length)
    : (_adsSponsors[tier]?.length || 0);

  const sponsor = {
    ...(_adsCurrentId ? { id: _adsCurrentId } : {}),
    club_id:       clubId,
    name,
    logo_url:      logoUrl,
    website_url:   url || null,
    tier,
    active:        true,
    display_order: existingOrder,
  };

  try {
    const saved = await saveSponsor(sponsor);
    if (saved) {
      if (_adsCurrentId) {
        _adsSponsors[tier] = _adsSponsors[tier].map(s => s.id === _adsCurrentId ? saved : s);
      } else {
        if (!_adsSponsors[tier]) _adsSponsors[tier] = [];
        _adsSponsors[tier].push(saved);
      }
    }
    adsCloseForm();
    adsRenderList(tier);
    showSaveIndicator();
  } catch (e) {
    console.error('[ADS] saveSponsor:', e);
    alert('Error saving sponsor: ' + e.message);
  }
}

async function adsDeleteSponsor(id, tier) {
  if (!confirm('Delete this sponsor?')) return;
  try {
    await deleteSponsor(id);
    _adsSponsors[tier] = (_adsSponsors[tier] || []).filter(s => s.id !== id);
    adsRenderList(tier);
    showSaveIndicator();
  } catch (e) {
    console.error('[ADS] deleteSponsor:', e);
    alert('Error deleting sponsor: ' + e.message);
  }
}

async function adsToggleActive(id, tier, active) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/sponsors?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ..._adsHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ active }),
    });
    const s = (_adsSponsors[tier] || []).find(s => s.id === id);
    if (s) s.active = active;
    showSaveIndicator();
  } catch (e) { console.error('[ADS] toggleActive:', e); }
}

// ── BROADCAST COLUMN — SPONSOR CONTROLS ──

let _bcPauseActive  = false;
let _bcTickerActive = false;

async function broadcastSponsorPause() {
  const clubId = APP_CONFIG.clubId || 'default';
  _bcPauseActive = !_bcPauseActive;

  // Mutual exclusivity: deactivate ticker if pause is being turned on
  if (_bcPauseActive && _bcTickerActive) {
    _bcTickerActive = false;
    _bcSetBtnState(document.getElementById('bcTickerBtn'), false, '▶ Ticker Silver', '⏹ Arrêter ticker Silver');
    try {
      await window.supabase.channel(`overlay:${clubId}`)
        .send({ type: 'broadcast', event: 'silver_ticker', payload: { active: false } });
    } catch (e) { console.error('[BC] silver_ticker off:', e); }
  }

  const btn = document.getElementById('bcPauseBtn');
  try {
    await window.supabase.channel(`overlay:${clubId}`)
      .send({ type: 'broadcast', event: 'sponsor_pause', payload: { active: _bcPauseActive } });
    _bcSetBtnState(btn, _bcPauseActive, '⏸ Écran pause sponsors', '⏹ Arrêter pause sponsors');
  } catch (e) {
    console.error('[BC] sponsor_pause:', e);
    _bcPauseActive = !_bcPauseActive; // revert on error
  }
}

async function broadcastSilverTicker() {
  const clubId = APP_CONFIG.clubId || 'default';
  _bcTickerActive = !_bcTickerActive;

  // Mutual exclusivity: deactivate pause if ticker is being turned on
  if (_bcTickerActive && _bcPauseActive) {
    _bcPauseActive = false;
    _bcSetBtnState(document.getElementById('bcPauseBtn'), false, '⏸ Écran pause sponsors', '⏹ Arrêter pause sponsors');
    try {
      await window.supabase.channel(`overlay:${clubId}`)
        .send({ type: 'broadcast', event: 'sponsor_pause', payload: { active: false } });
    } catch (e) { console.error('[BC] sponsor_pause off:', e); }
  }

  const btn = document.getElementById('bcTickerBtn');
  try {
    await window.supabase.channel(`overlay:${clubId}`)
      .send({ type: 'broadcast', event: 'silver_ticker', payload: { active: _bcTickerActive } });
    _bcSetBtnState(btn, _bcTickerActive, '▶ Ticker Silver', '⏹ Arrêter ticker Silver');
  } catch (e) {
    console.error('[BC] silver_ticker:', e);
    _bcTickerActive = !_bcTickerActive; // revert on error
  }
}

function _bcSetBtnState(btn, active, labelOff, labelOn) {
  if (!btn) return;
  btn.textContent = active ? labelOn : labelOff;
  if (active) {
    btn.style.background   = '#8b0000';
    btn.style.borderColor  = '#cc0000';
    btn.style.boxShadow    = '0 0 10px rgba(204,0,0,0.5)';
    btn.style.animation    = 'adsPausePulse 1.4s ease-in-out infinite';
    btn.style.color        = '#fff';
  } else {
    btn.style.background   = '';
    btn.style.borderColor  = '';
    btn.style.boxShadow    = '';
    btn.style.animation    = '';
    btn.style.color        = '';
  }
}

// ── OBS PAUSE SCREEN TOGGLE ──

let _adsPauseActive = false;

async function adsTogglePauseScreen() {
  const clubId = APP_CONFIG.clubId || 'default';
  _adsPauseActive = !_adsPauseActive;

  const btn    = document.getElementById('adsPauseBtn');
  const status = document.getElementById('adsPauseStatus');

  try {
    await window.supabase
      .channel(`overlay:${clubId}`)
      .send({
        type:    'broadcast',
        event:   'sponsor_pause',
        payload: { active: _adsPauseActive },
      });
  } catch (e) {
    console.error('[ADS] sponsor_pause broadcast:', e);
    _adsPauseActive = !_adsPauseActive; // revert
    return;
  }

  if (_adsPauseActive) {
    btn.style.background  = '#cc0000';
    btn.style.boxShadow   = '0 0 12px rgba(204,0,0,0.6)';
    btn.style.animation   = 'adsPausePulse 1.4s ease-in-out infinite';
    status.textContent    = '🔴 LIVE';
    status.style.color    = '#cc0000';
  } else {
    btn.style.background  = '';
    btn.style.boxShadow   = '';
    btn.style.animation   = '';
    status.textContent    = 'Off';
    status.style.color    = '';
  }
}

// ── SILVER TICKER TOGGLE ──

let _adsTickerActive = false;

async function adsToggleSilverTicker() {
  const clubId = APP_CONFIG.clubId || 'default';
  _adsTickerActive = !_adsTickerActive;

  const btn    = document.getElementById('adsTickerBtn');
  const status = document.getElementById('adsTickerStatus');

  try {
    await window.supabase
      .channel(`overlay:${clubId}`)
      .send({
        type:    'broadcast',
        event:   'silver_ticker',
        payload: { active: _adsTickerActive },
      });
  } catch (e) {
    console.error('[ADS] silver_ticker broadcast:', e);
    _adsTickerActive = !_adsTickerActive;
    return;
  }

  if (_adsTickerActive) {
    btn.style.background = '#cc0000';
    btn.style.boxShadow  = '0 0 12px rgba(204,0,0,0.6)';
    btn.style.animation  = 'adsPausePulse 1.4s ease-in-out infinite';
    status.textContent   = '🔴 LIVE';
    status.style.color   = '#cc0000';
  } else {
    btn.style.background = '';
    btn.style.boxShadow  = '';
    btn.style.animation  = '';
    status.textContent   = 'Off';
    status.style.color   = '';
  }
}

async function adsSaveSettings() {
  const settings = {
    max_gold:   parseInt(document.getElementById('adsMaxGold').value,   10) || 3,
    max_silver: parseInt(document.getElementById('adsMaxSilver').value, 10) || 5,
    max_bronze: parseInt(document.getElementById('adsMaxBronze').value, 10) || 10,
  };
  try {
    await saveSponsorSettings(settings);
    _adsSponsorSettings = settings;
    ['gold', 'silver', 'bronze'].forEach(tier => adsRenderList(tier));
    showSaveIndicator();
  } catch (e) {
    console.error('[ADS] saveSettings:', e);
  }
}
