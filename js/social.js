/* ============================================================
   Diamond Pulse — js/social.js
   Export Instagram Stories, Team Intro, Visitors lineup

   Fonctions :
   - drawPhotoPlaceholder(), handleFeaturedPhoto()
   - toggleOpponentInput(), toggleStoryForm()
   - getAccentColor(), hexToRgb()
   - exportStory() — lineup story
   - toggleScoreForm(), toggleMvpForm()
   - updateScoreResult(), handleMvpPhoto(), updateMvpPhoto()
   - exportScoreStory(), exportMvpStory()
   - shareStory(canvas, filename)
   - startTeamIntro(), launchTeamIntro(), stopTeamIntro()
   - introShowPlayer(), introNext(), introPrev(), introTogglePause()
   - renderVisitorsLineup(), editVisitor(), startVisitorIntro()
   - liveAnnounceVisitor()

   Dépend de (globals) :
   - allPlayers, teams, currentTeamId, clubSettings, appSettings
   - ttsSpeak(), ttsBuildIntroText(), ttsUnlock()
   - saveConfig(), render()
   ============================================================ */

function drawPhotoPlaceholder(ctx, x, y, size, mid) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size/2, mid, size/2, 0, Math.PI*2);
  ctx.clip();

  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(x, y, size, size);

  // silhouette
  ctx.fillStyle = '#FF4500';
  ctx.globalAlpha = 0.5;
  const cx = x + size/2, s = size * 0.28;
  ctx.beginPath(); ctx.arc(cx, mid - s*0.6, s*0.55, 0, Math.PI*2); ctx.fill();
  ctx.fillRect(cx - s*0.7, mid - s*0.05, s*1.4, s);
  ctx.globalAlpha = 1;

  ctx.restore();
}

let featuredPhotoURL = null;

function handleFeaturedPhoto(input) {
  const file = input.files[0];
  if (!file) return;

  if (featuredPhotoURL) URL.revokeObjectURL(featuredPhotoURL);
  featuredPhotoURL = URL.createObjectURL(file);

  document.getElementById('featuredPhotoText').textContent = '🖼️ ' + file.name;
  document.getElementById('featuredPhotoLabel').classList.add('has-file');
}

function toggleOpponentInput(prefix) {
  const sel = document.getElementById(prefix + 'OpponentSelect');
  const inp = document.getElementById(prefix + 'Opponent');
  if (!sel || !inp) return;
  if (sel.value) {
    const opp = (appSettings.opponents || []).find(o => o.id === sel.value);
    if (opp) {
      inp.value = opp.name;
      inp.style.display = 'none';
    }
  } else {
    inp.value = '';
    inp.style.display = '';
    inp.focus();
  }
}

function refreshStorySelects() {
  // Rafraîchit les selects story/MVP si leurs formulaires sont ouverts
  const storyForm = document.getElementById('storyForm');
  if (storyForm && storyForm.classList.contains('open')) {
    const sel = document.getElementById('storyFeatured');
    const current = sel.value;
    sel.innerHTML = '<option value="">— None —</option>';
    currentLineup().filter(e => e.present !== false).forEach((entry) => {
      const player = allPlayers[entry.pid];
      if (!player || player.gdprRestricted) return;
      const opt = document.createElement('option');
      opt.value = entry.pid;
      opt.textContent = player.name + (entry.jersey ? ' #' + entry.jersey : '');
      sel.appendChild(opt);
    });
    // Restaurer la sélection si toujours valide
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
    document.getElementById('featuredPhotoGroup').style.display = sel.value ? 'flex' : 'none';
  }

  const mvpForm = document.getElementById('mvpForm');
  if (mvpForm && mvpForm.classList.contains('open')) {
    const sel = document.getElementById('mvpPlayer');
    const current = sel.value;
    sel.innerHTML = '<option value="">— Choose MVP —</option>';
    currentLineup().filter(e => e.present !== false).forEach(entry => {
      const p = allPlayers[entry.pid];
      if (!p || p.gdprRestricted) return;
      const opt = document.createElement('option');
      opt.value = entry.pid;
      opt.textContent = p.name + (entry.jersey ? ' #' + entry.jersey : '') + (entry.pos ? ' · ' + entry.pos : '');
      sel.appendChild(opt);
    });
    if ([...sel.options].some(o => o.value === current)) sel.value = current;
  }
}

function toggleStoryForm() {
  const form = document.getElementById('storyForm');
  form.classList.toggle('open');

  if (!document.getElementById('storyDate').value) {
    document.getElementById('storyDate').value = new Date().toISOString().split('T')[0];
  }

  const sel = document.getElementById('storyFeatured');
  sel.innerHTML = '<option value="">— None —</option>';

  currentLineup().filter(e => e.present !== false).forEach((entry) => {
    const player = allPlayers[entry.pid];
    if (!player || player.gdprRestricted) return;
    const opt = document.createElement('option');
    opt.value = entry.pid;
    opt.textContent = player.name + (entry.jersey ? ' #' + entry.jersey : '');
    sel.appendChild(opt);
  });

  sel.onchange = () => {
    document.getElementById('featuredPhotoGroup').style.display = sel.value ? 'flex' : 'none';
  };

  populateGoldSponsorSelect('storyGoldSponsor');
}

// ── COULEUR DYNAMIQUE POUR LES EXPORTS CANVAS ──
function getAccentColor() {
  return getComputedStyle(document.documentElement).getPropertyValue('--orange').trim() || '#FF4500';
}
function hexToRgb(hex) {
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16);
  const g = parseInt(h.substring(2,4),16);
  const b = parseInt(h.substring(4,6),16);
  return {r,g,b};
}

async function exportStory() {
  const accent = getAccentColor();
  const {r:ar, g:ag, b:ab} = hexToRgb(accent);
  const accentAlpha = (a) => `rgba(${ar},${ag},${ab},${a})`;
  const date = document.getElementById('storyDate').value;
  const oppInfo = getOpponentInfo('storyOpponentSelect', 'storyOpponent');
  const opponent = oppInfo.name;
  const featuredPid = document.getElementById('storyFeatured').value;
  const team = teams[currentTeamId];
  const entries = team.lineup.filter(e => e.present !== false);

  // Load opponent logo if available
  let oppLogoImg = null;
  if (oppInfo.logo) {
    oppLogoImg = new Image();
    await new Promise(r => { oppLogoImg.onload = r; oppLogoImg.onerror = r; oppLogoImg.src = oppInfo.logo; });
    if (!oppLogoImg.naturalWidth) oppLogoImg = null;
  }

  const W = 1080, H = 1920;
  const canvas = document.getElementById('storyCanvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // ── FOND ──
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  const hasBgLineup = await drawStoryBg(ctx, W, H, clubSettings.bgLineup, 0.6);
  if (!hasBgLineup) {
    // Dégradé orange par défaut
    const grad = ctx.createRadialGradient(W/2, 0, 0, W/2, 0, H * 0.55);
    grad.addColorStop(0, accentAlpha(0.18));
    grad.addColorStop(1, accentAlpha(0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Ligne orange en haut
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 6);

  // ── LOGO ──
  const logoImg = new Image();
  logoImg.src = clubSettings.logo || '';
  await new Promise(r => { logoImg.onload = r; logoImg.onerror = r; });

  const logoH = 160;
  const logoW = logoImg.width ? (logoImg.width / logoImg.height) * logoH : logoH;
  ctx.drawImage(logoImg, W/2 - logoW/2, 60, logoW, logoH);

  // ── TITRE CLUB ──
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 72px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(document.querySelector('.header-club')?.textContent || 'YOUR TEAM', W/2, 280);

  ctx.fillStyle = accent;
  ctx.font = '36px Oswald, sans-serif';
  ctx.fillText((clubSettings.website || '').toUpperCase(), W/2, 330);

  // ── ÉQUIPE ──
  ctx.fillStyle = accent;
  ctx.font = 'bold 52px Oswald, sans-serif';
  ctx.fillText(team.label.toUpperCase(), W/2, 420);

  // ── SÉPARATEUR ──
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 450); ctx.lineTo(W - 80, 450);
  ctx.stroke();

  // ── DATE & ADVERSAIRE ──
  if (date) {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '32px Barlow Condensed, sans-serif';
    ctx.fillText(dateStr.toUpperCase(), W/2, 510);
  }

  if (opponent) {
    const vsY = 580;
    const logoSize = 100;
    const gap = 60;   // espace entre logo et VS
    const vsX = W / 2;

    // Mesurer la largeur du "VS"
    ctx.font = 'bold 40px Oswald, sans-serif';
    const vsW = ctx.measureText('VS').width;

    // Notre logo à gauche du centre
    const myLogoImg = new Image();
    myLogoImg.src = clubSettings.logo || '';
    await new Promise(r => { myLogoImg.onload = r; myLogoImg.onerror = r; });

    if (myLogoImg.naturalWidth > 0) {
      const lw = (myLogoImg.width / myLogoImg.height) * logoSize;
      ctx.drawImage(myLogoImg, vsX - vsW/2 - gap - lw, vsY - logoSize/2, lw, logoSize);
    }

    // VS au centre
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 40px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', vsX, vsY + 14);

    // Logo adversaire à droite du centre (si dispo), sinon nom
    if (oppLogoImg && oppLogoImg.naturalWidth > 0) {
      const lw = (oppLogoImg.width / oppLogoImg.height) * logoSize;
      const oppX = vsX + vsW/2 + gap;
      ctx.drawImage(oppLogoImg, oppX, vsY - logoSize/2, lw, logoSize);
      // Nom sous le logo
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '26px Barlow Condensed, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(opponent.toUpperCase(), oppX, vsY + logoSize/2 + 30);
    } else {
      // Pas de logo : nom adversaire à droite, taille auto
      const maxNameW = W - 80 - (vsX + vsW/2 + gap);
      let fontSize = 52;
      ctx.font = `bold ${fontSize}px Oswald, sans-serif`;
      while (ctx.measureText(opponent.toUpperCase()).width > maxNameW && fontSize > 28) {
        fontSize -= 2;
        ctx.font = `bold ${fontSize}px Oswald, sans-serif`;
      }
      ctx.fillStyle = '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(opponent.toUpperCase(), vsX + vsW/2 + gap, vsY + fontSize * 0.38);
    }
  }

  // ── TITRE LINEUP ──
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = '28px Barlow Condensed, sans-serif';
  ctx.fillText('BATTING ORDER', W/2, 630);

  // ── SÉPARATEUR ──
  ctx.strokeStyle = accentAlpha(0.4);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(80, 650); ctx.lineTo(W - 80, 650);
  ctx.stroke();

  // ── JOUEUR EN ARRIÈRE-PLAN ──
  if (featuredPid && featuredPhotoURL) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise(r => { img.onload = r; img.onerror = r; img.src = featuredPhotoURL; });

    if (img.naturalWidth > 0) {
      const fH = Math.round(H * 0.52);
      const fW = Math.round(fH * img.naturalWidth / img.naturalHeight);
      const fX = W - fW + Math.round(fW * 0.08);
      const fY = H - fH - 60;
      ctx.globalAlpha = 0.35;
      ctx.drawImage(img, fX, fY, fW, fH);
      ctx.globalAlpha = 1.0;
    }
  }

  // ── JOUEURS ──
  const startY = 680;
  const rowH = Math.min(98, (H - startY - 120) / Math.max(entries.length, 1));
  const maxRows = Math.floor((H - startY - 120) / rowH);

  for (let idx = 0; idx < Math.min(entries.length, maxRows); idx++) {
    const entry = entries[idx];
    const player = allPlayers[entry.pid];
    if (!player) continue;

    const y = startY + idx * rowH;
    const mid = y + rowH / 2;

    if (idx % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.fillRect(60, y + 4, W - 120, rowH - 8);
    }

    // Numéro d'ordre
    ctx.fillStyle = accentAlpha(0.5);
    ctx.font = `bold ${Math.round(rowH * 0.45)}px Oswald, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(String(idx + 1), 80, mid + rowH * 0.16);

    // Photo player en rond
    const photoSize = Math.round(rowH * 0.72);
    const photoX = 150, photoY = mid - photoSize / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(photoX + photoSize/2, mid, photoSize/2, 0, Math.PI*2);
    ctx.clip();

    if (player.photo) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = player.photo + '?t=' + Date.now();
        });

        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, photoX, photoY, photoSize, photoSize);
        } else {
          drawPhotoPlaceholder(ctx, photoX, photoY, photoSize, mid);
        }
      } catch {
        drawPhotoPlaceholder(ctx, photoX, photoY, photoSize, mid);
      }
    } else {
      drawPhotoPlaceholder(ctx, photoX, photoY, photoSize, mid);
    }
    ctx.restore();

    // Cercle border
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(photoX + photoSize/2, mid, photoSize/2, 0, Math.PI*2);
    ctx.stroke();

    // Position
    if (entry.pos) {
      ctx.fillStyle = accent;
      ctx.font = `bold ${Math.round(rowH * 0.32)}px Oswald, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(entry.pos, photoX + photoSize + 20, mid + rowH * 0.12);
    }

    const isFeatured = String(entry.pid) === String(featuredPid);
    const nameFontSize = isFeatured ? Math.round(rowH * 0.58) : Math.round(rowH * 0.42);

    if (isFeatured) {
      ctx.fillStyle = accentAlpha(0.08);
      ctx.fillRect(60, y + 2, W - 120, rowH - 4);
      ctx.fillStyle = accent;
      ctx.fillRect(60, y + 2, 4, rowH - 4);
    }

    // Nom
    ctx.fillStyle = isFeatured ? accent : '#FFFFFF';
    ctx.font = `bold ${nameFontSize}px Oswald, sans-serif`;
    ctx.textAlign = 'left';
    const nameX = photoX + photoSize + (entry.pos ? 100 : 20);
    ctx.fillText(player.name.toUpperCase(), nameX, mid + nameFontSize * 0.38);

    // Numéro maillot
    if (entry.jersey) {
      ctx.fillStyle = accent;
      ctx.font = `bold ${Math.round(rowH * 0.38)}px Oswald, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText('#' + entry.jersey, W - 80, mid + rowH * 0.14);
    }

    // Ligne séparatrice
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, y + rowH); ctx.lineTo(W - 80, y + rowH);
    ctx.stroke();
  }

  // ── LIGNE ORANGE EN BAS ──
  ctx.fillStyle = accent;
  ctx.fillRect(0, H - 6, W, 6);

  // ── FOOTER ──
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.font = '28px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(clubSettings.website || 'yourclub.com', W/2, H - 24);

  // ── SPONSOR GOLD (bottom-left) ──
  try {
    const logoUrl = document.getElementById('storyGoldSponsor')?.value;
    if (logoUrl) {
      const sponsorImg = new Image();
      sponsorImg.crossOrigin = 'anonymous';
      await new Promise(r => { sponsorImg.onload = r; sponsorImg.onerror = r; sponsorImg.src = logoUrl; });
      if (sponsorImg.naturalWidth > 0) {
        const sW = 220, sH = 110, margin = 24;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(sponsorImg, margin, H - sH - margin - 6, sW, sH);
        ctx.globalAlpha = 1;
      }
    }
  } catch (e) { /* sponsor logo is optional */ }

  // ── PARTAGE ──
  const filename = `walkup-lineup-${currentTeamId}-${date || 'match'}.png`;
  shareStory(canvas, filename);
}


// ── SPONSOR GOLD SELECT — helper ──
async function populateGoldSponsorSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— Aucun —</option>';
  try {
    const clubId = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.clubId) || 'default';
    const sponsors = await getActiveSponsorsByTier(clubId, 'gold');
    sponsors.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.logo_url || '';
      opt.textContent = s.name;
      sel.appendChild(opt);
    });
    if (sponsors.length === 1) sel.value = sponsors[0].logo_url || '';
  } catch (e) { /* optional */ }
}

// ── SOCIAL : TOGGLE FORMS ──
function toggleScoreForm() {
  const f = document.getElementById('scoreForm');
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    if (!document.getElementById('scoreDate').value)
      document.getElementById('scoreDate').value = new Date().toISOString().split('T')[0];
    populateGoldSponsorSelect('scoreGoldSponsor');
  }
}

function toggleMvpForm() {
  const f = document.getElementById('mvpForm');
  f.classList.toggle('open');
  if (f.classList.contains('open')) {
    if (!document.getElementById('mvpDate').value)
      document.getElementById('mvpDate').value = new Date().toISOString().split('T')[0];
    // Peupler le select MVP
    const sel = document.getElementById('mvpPlayer');
    sel.innerHTML = '<option value="">— Choose MVP —</option>';
    currentLineup().filter(e => e.present !== false).forEach(entry => {
      const p = allPlayers[entry.pid];
      if (!p || p.gdprRestricted) return;
      const opt = document.createElement('option');
      opt.value = entry.pid;
      opt.textContent = p.name + (entry.jersey ? ' #' + entry.jersey : '') + (entry.pos ? ' · ' + entry.pos : '');
      sel.appendChild(opt);
    });
    // Lier onchange pour mise à jour photo
    sel.onchange = updateMvpPhoto;
    populateGoldSponsorSelect('mvpGoldSponsor');
  }
}

function updateScoreResult() {
  // visuel auto — géré par CSS :has()
}

let mvpPhotoURL = null;
function handleMvpPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  if (mvpPhotoURL) URL.revokeObjectURL(mvpPhotoURL);
  mvpPhotoURL = URL.createObjectURL(file);
  document.getElementById('mvpPhotoText').textContent = '🖼️ ' + file.name;
  document.getElementById('mvpPhotoLabel').classList.add('has-file');
}

function updateMvpPhoto() {
  // Réinitialise la photo quand on change de player
  mvpPhotoURL = null;
  document.getElementById('mvpPhotoText').textContent = '📂 Choose a PNG photo…';
  document.getElementById('mvpPhotoLabel').classList.remove('has-file');
  document.getElementById('mvpPhotoFile').value = '';
}

// ── EXPORT STORY SCORE ──
async function exportScoreStory() {
  const accent = getAccentColor();
  const {r:ar, g:ag, b:ab} = hexToRgb(accent);
  const accentAlpha = (a) => `rgba(${ar},${ag},${ab},${a})`;
  const date     = document.getElementById('scoreDate').value;
  const oppInfo  = getOpponentInfo('scoreOpponentSelect', 'scoreOpponent');
  const opponent = oppInfo.name;
  const home     = document.getElementById('scoreHome').value || '0';
  const away     = document.getElementById('scoreAway').value || '0';
  const result   = document.querySelector('input[name="scoreResult"]:checked')?.value || '';
  const team     = teams[currentTeamId];

  // Load opponent logo if available
  let oppLogoImg = null;
  if (oppInfo.logo) {
    oppLogoImg = new Image();
    await new Promise(r => { oppLogoImg.onload = r; oppLogoImg.onerror = r; oppLogoImg.src = oppInfo.logo; });
    if (!oppLogoImg.naturalWidth) oppLogoImg = null;
  }

  const W = 1080, H = 1920;
  const canvas = document.getElementById('scoreCanvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fond
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);

  const hasBgScore = await drawStoryBg(ctx, W, H, clubSettings.bgScore, 0.6);
  if (!hasBgScore) {
    const grad = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H*0.4, H*0.7);
    grad.addColorStop(0, accentAlpha(0.2));
    grad.addColorStop(1, accentAlpha(0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // Bande orange haut
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 6);

  // Logo
  const logoImg = new Image();
  logoImg.src = clubSettings.logo || '';
  await new Promise(r => { logoImg.onload = r; logoImg.onerror = r; });
  const logoH = 140, logoW = logoImg.width ? (logoImg.width / logoImg.height) * logoH : logoH;
  if (logoImg.naturalWidth > 0) ctx.drawImage(logoImg, W/2 - logoW/2, 80, logoW, logoH);

  // Nom club
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 64px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(document.querySelector('.header-club')?.textContent || 'YOUR TEAM', W/2, 272);

  ctx.fillStyle = accent;
  ctx.font = '34px Oswald, sans-serif';
  ctx.fillText((team.label || currentTeamId).toUpperCase(), W/2, 320);

  // Date & adversaire
  if (date) {
    const d = new Date(date);
    const dateStr = d.toLocaleDateString('en-US', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '30px Barlow Condensed, sans-serif';
    ctx.fillText(dateStr.toUpperCase(), W/2, 390);
  }

  // VS row: our logo — VS — opponent logo
  {
    const vsY = 440, vsLogoH = 72;
    // Our logo
    if (logoImg.naturalWidth > 0) {
      const lw = (logoImg.width / logoImg.height) * vsLogoH;
      ctx.drawImage(logoImg, W/2 - 200 - lw, vsY - vsLogoH/2 - 8, lw, vsLogoH);
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 38px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VS', W/2, vsY + 14);
    // Opponent logo or name
    if (oppLogoImg) {
      const lw = (oppLogoImg.width / oppLogoImg.height) * vsLogoH;
      ctx.drawImage(oppLogoImg, W/2 + 200, vsY - vsLogoH/2 - 8, lw, vsLogoH);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 30px Oswald, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(opponent.toUpperCase(), W/2 + 240, vsY + 14);
    }
  }

  // Séparateur
  ctx.strokeStyle = accentAlpha(0.4);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(100, 470); ctx.lineTo(W-100, 470); ctx.stroke();

  // Grand score central
  const resultColors = { win: '#2ecc40', loss: '#cc2200', tie: accent };
  const resultLabels = { win: '🏆 WIN', loss: '❌ LOSS', tie: '🤝 TIE' };
  const accentColor = resultColors[result] || accent;

  // Score box
  const boxY = 520, boxH = 340;
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(80, boxY, W-160, boxH);
  ctx.strokeStyle = accentColor + '44';
  ctx.lineWidth = 2;
  ctx.strokeRect(80, boxY, W-160, boxH);

  // Score chiffres
  ctx.font = 'bold 220px Oswald, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(home, 140, boxY + 270);

  ctx.fillStyle = accentColor;
  ctx.font = 'bold 120px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('—', W/2, boxY + 220);

  ctx.font = 'bold 220px Oswald, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(away, W-140, boxY + 270);

  // Labels sous les scores + logos miniatures
  const labelY = boxY + 320;
  // Our side
  ctx.font = '28px Barlow Condensed, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = accent;
  ctx.fillText(document.querySelector('.header-club')?.textContent || 'YOUR TEAM', 140, labelY);
  // Opponent side
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText(opponent.toUpperCase(), W-140, labelY);
  // Opponent logo miniature above away score
  if (oppLogoImg) {
    const mH = 60;
    const mW = (oppLogoImg.width / oppLogoImg.height) * mH;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(oppLogoImg, W - 140 - mW, boxY - mH - 10, mW, mH);
    ctx.globalAlpha = 1;
  }

  // Badge résultat
  if (result) {
    const label = resultLabels[result];
    ctx.font = 'bold 52px Oswald, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = accentColor;
    ctx.fillText(label, W/2, boxY + boxH + 90);
  }

  // Footer
  ctx.fillStyle = accent;
  ctx.fillRect(0, H-6, W, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '28px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(clubSettings.website || 'yourclub.com', W/2, H-24);

  // ── SPONSOR GOLD (bottom-left) ──
  try {
    const logoUrl = document.getElementById('scoreGoldSponsor')?.value;
    if (logoUrl) {
      const sponsorImg = new Image();
      sponsorImg.crossOrigin = 'anonymous';
      await new Promise(r => { sponsorImg.onload = r; sponsorImg.onerror = r; sponsorImg.src = logoUrl; });
      if (sponsorImg.naturalWidth > 0) {
        const sW = 220, sH = 110, margin = 24;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(sponsorImg, margin, H - sH - margin - 6, sW, sH);
        ctx.globalAlpha = 1;
      }
    }
  } catch (e) { /* sponsor logo is optional */ }

  const filename = `walkup-score-${currentTeamId}-${date || 'match'}.png`;
  shareStory(canvas, filename);
}
async function exportMvpStory() {
  const accent = getAccentColor();
  const {r:ar, g:ag, b:ab} = hexToRgb(accent);
  const accentAlpha = (a) => `rgba(${ar},${ag},${ab},${a})`;
  const pid      = document.getElementById('mvpPlayer').value;
  const date     = document.getElementById('mvpDate').value;
  const opponent = document.getElementById('mvpOpponent').value.trim() || 'Opponent';
  const quote    = document.getElementById('mvpQuote').value.trim();

  if (!pid) { alert('Select a player MVP !'); return; }

  const player = allPlayers[pid];
  const entry  = currentLineup().find(e => String(e.pid) === String(pid));
  if (!player) return;

  const W = 1080, H = 1920;
  const canvas = document.getElementById('mvpCanvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Fond sombre diagonal
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, W, H);

  const hasBgMvp = await drawStoryBg(ctx, W, H, clubSettings.bgMvp, 0.6);
  if (!hasBgMvp) {
    const sideGrad = ctx.createLinearGradient(0, 0, W*0.6, H);
    sideGrad.addColorStop(0, accentAlpha(0.18));
    sideGrad.addColorStop(0.5, accentAlpha(0.05));
    sideGrad.addColorStop(1, accentAlpha(0));
    ctx.fillStyle = sideGrad;
    ctx.fillRect(0, 0, W, H);
  }

  // Bande gauche orange
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 8, H);

  // Logo + nom club (haut gauche)
  const logoImg = new Image();
  logoImg.src = clubSettings.logo || '';
  await new Promise(r => { logoImg.onload = r; logoImg.onerror = r; });
  const lH = 80, lW = logoImg.width ? (logoImg.width/logoImg.height)*lH : lH;
  if (logoImg.naturalWidth > 0) ctx.drawImage(logoImg, 60, 60, lW, lH);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 44px Oswald, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(document.querySelector('.header-club')?.textContent || 'YOUR TEAM', 60 + lW + 20, 100);
  ctx.fillStyle = accent;
  ctx.font = '26px Barlow Condensed, sans-serif';
  ctx.fillText((teams[currentTeamId]?.label || currentTeamId).toUpperCase(), 60 + lW + 20, 132);

  // Date & adversaire
  if (date) {
    const d = new Date(date);
    const ds = d.toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric' });
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '28px Barlow Condensed, sans-serif';
    ctx.fillText(ds.toUpperCase() + '  ·  VS ' + opponent.toUpperCase(), 60, 200);
  }

  // Grand titre MVP
  ctx.fillStyle = accent;
  ctx.font = 'bold 110px Oswald, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MVP', 60, 340);

  // Ligne déco
  ctx.fillStyle = accent;
  ctx.fillRect(60, 360, 180, 4);

  // Photo player si disponible
  let photoLoaded = false;
  if (mvpPhotoURL || player.photo) {
    const pImg = new Image();
    pImg.src = mvpPhotoURL || player.photo;
    await new Promise(r => { pImg.onload = r; pImg.onerror = r; });
    if (pImg.naturalWidth > 0) {
      const pH = Math.round(H * 0.55);
      const pW = Math.round(pH * pImg.naturalWidth / pImg.naturalHeight);
      const pX = W - pW + Math.round(pW * 0.05);
      const pY = H - pH - 80;
      ctx.drawImage(pImg, pX, pY, pW, pH);
      photoLoaded = true;
    }
  }

  // Numéro de maillot géant en fond
  if (entry?.jersey) {
    ctx.font = 'bold 500px Oswald, sans-serif';
    ctx.fillStyle = accentAlpha(0.06);
    ctx.textAlign = 'right';
    ctx.fillText('#' + entry.jersey, W - 40, H * 0.72);
  }

  // Nom player
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 96px Oswald, sans-serif';
  ctx.textAlign = 'left';
  const nameParts = player.name.toUpperCase().split(' ');
  if (nameParts.length >= 2) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = 'bold 60px Oswald, sans-serif';
    ctx.fillText(nameParts[0], 60, 470);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 96px Oswald, sans-serif';
    ctx.fillText(nameParts.slice(1).join(' '), 60, 565);
  } else {
    ctx.fillText(player.name.toUpperCase(), 60, 540);
  }

  // Stats (position + maillot)
  let statsY = 610;
  if (entry?.jersey) {
    ctx.fillStyle = accent;
    ctx.font = 'bold 36px Oswald, sans-serif';
    ctx.fillText('#' + entry.jersey, 60, statsY);
    statsY += 50;
  }
  if (entry?.pos) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '30px Barlow Condensed, sans-serif';
    ctx.fillText(entry.pos, 60, statsY);
    statsY += 46;
  }

  // Citation
  if (quote) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'italic 34px Barlow, sans-serif';
    // Wrap texte
    const maxW = photoLoaded ? W * 0.5 : W - 120;
    const words = quote.split(' ');
    let line = '"', lineY = statsY + 40;
    for (const word of words) {
      const test = line + word + ' ';
      if (ctx.measureText(test + '"').width > maxW && line !== '"') {
        ctx.fillText(line, 60, lineY);
        line = word + ' ';
        lineY += 44;
      } else { line = test; }
    }
    ctx.fillText(line.trimEnd() + '"', 60, lineY);
  }

  // Footer
  ctx.fillStyle = accent;
  ctx.fillRect(0, H-6, W, 6);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '28px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(clubSettings.website || 'yourclub.com', W/2, H-24);

  // ── SPONSOR GOLD (bottom-left) ──
  try {
    const logoUrl = document.getElementById('mvpGoldSponsor')?.value;
    if (logoUrl) {
      const sponsorImg = new Image();
      sponsorImg.crossOrigin = 'anonymous';
      await new Promise(r => { sponsorImg.onload = r; sponsorImg.onerror = r; sponsorImg.src = logoUrl; });
      if (sponsorImg.naturalWidth > 0) {
        const sW = 220, sH = 110, margin = 24;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(sponsorImg, margin, H - sH - margin - 6, sW, sH);
        ctx.globalAlpha = 1;
      }
    }
  } catch (e) { /* sponsor logo is optional */ }

  const filename = `walkup-mvp-${player.name.toLowerCase().replace(/\s+/g,'-')}-${date || 'match'}.png`;
  shareStory(canvas, filename);
}

// ── PARTAGE ──
async function shareStory(canvas, filename) {
  try {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.share && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      // Fallback téléchargement (desktop ou navigateur non compatible)
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      // Dernier recours : dataURL
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = filename;
      link.click();
    }
  }
}

// ── TEAM INTRO — SEQUENTIAL MODE ──
let introState = {
  entries: [],
  index: 0,
  paused: false,
  timer: null,
  elapsed: 0,
};


function startTeamIntro() {
  ttsUnlock();
  const entries = currentLineup().filter(e => e.present !== false);
  if (entries.length === 0) { alert('No present players in the lineup.'); return; }
  launchTeamIntro(entries);
}

async function launchTeamIntro(entries) {
  stopPlayback();
  introState = { entries, index: 0, paused: false, timer: null, elapsed: 0 };

  const overlay = document.getElementById('introOverlay');
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  introBuildDots();

  // Open mixer
  mixerOpen();

  // Start background music if configured
  const bgUrl = (appSettings.intro || {}).bgMusic;
  if (bgUrl) {
    const bgAudio = new Audio(bgUrl);
    bgAudio.loop   = true;
    bgAudio.volume = mixerState.bgMuted ? 0 : mixerState.bgVol;
    bgAudio.play().catch(() => {});
    introState._bgAudio = bgAudio;
  }

  // Keep audio channel open continuously to prevent OS fade-in on each utterance
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0; // silent
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    introState._audioCtx = ctx;
    introState._audioOsc = osc;
  } catch(e) {}

  // Pre-warm Web Speech engine to eliminate first-utterance lag
  if (appSettings.tts?.enabled && (!appSettings.tts?.engine || appSettings.tts?.engine === 'webspeech') && window.speechSynthesis) {
    const warmup = new SpeechSynthesisUtterance(' ');
    warmup.volume = 0;
    speechSynthesis.speak(warmup);
    speechSynthesis.cancel();
  }

  // Opening text — show in overlay and speak/wait before lineup
  const openingText = (appSettings.intro || {}).openingText;
  if (openingText) {
    // Display opening text in the intro card area
    document.getElementById('introOrderNum').textContent  = '';
    document.getElementById('introName').textContent      = '';
    document.getElementById('introJersey').textContent    = '';
    document.getElementById('introPosBadge').style.display = 'none';
    document.getElementById('introPlayingLabel').textContent = openingText;
    document.getElementById('introCounter').textContent   = '';
    document.getElementById('introAvatar').innerHTML = `<svg width="60" height="60" viewBox="0 0 60 60"><text x="30" y="42" text-anchor="middle" font-size="40">🎤</text></svg>`;

    if (appSettings.tts?.enabled) {
      try { await ttsSpeak(openingText); } catch(e) { console.warn('TTS failed:', e); }
    } else {
      // Estimate reading time: ~130 words/min, min 2s
      const words = openingText.trim().split(/\s+/).length;
      const ms = Math.max(2000, Math.round(words / 130 * 60 * 1000));
      await new Promise(r => setTimeout(r, ms));
    }
  }

  introShowPlayer(0);
}

function stopTeamIntro() {
  clearTimeout(introState.timer);
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (introState._bgAudio)   { introState._bgAudio.pause(); introState._bgAudio = null; }
  if (introState._audioOsc)  { try { introState._audioOsc.stop(); } catch(e) {} }
  if (introState._audioCtx)  { introState._audioCtx.close().catch(()=>{}); }
  mixerClose();
  introState = { entries: [], index: 0, paused: false, timer: null, elapsed: 0 };
  document.getElementById('introOverlay').style.display = 'none';
  document.body.style.overflow = '';
}

function introBuildDots() {
  const wrap = document.getElementById('introDotsWrap');
  if (!wrap) return;
  wrap.innerHTML = introState.entries.map((_, i) =>
    `<div class="intro-dot" id="idot-${i}" style="width:10px;height:10px;border-radius:50%;background:var(--border);transition:all 0.3s;flex-shrink:0"></div>`
  ).join('');
}

function introUpdateDots(idx) {
  introState.entries.forEach((_, i) => {
    const d = document.getElementById(`idot-${i}`);
    if (!d) return;
    d.style.background = i < idx ? 'rgba(255,69,0,0.4)' : i === idx ? 'var(--orange)' : 'var(--border)';
    d.style.transform = i === idx ? 'scale(1.4)' : 'scale(1)';
    d.style.boxShadow = i === idx ? '0 0 8px var(--orange)' : 'none';
  });
}

async function introShowPlayer(idx) {
  clearTimeout(introState.timer);
  introState.timer = null;

  if (idx >= introState.entries.length) {
    // Wait 15s on last player before closing
    await new Promise(r => { introState.timer = setTimeout(r, 15000); });
    stopTeamIntro();
    return;
  }

  introState.index = idx;
  introState.elapsed = 0;
  introUpdateDots(idx);

  const entry  = introState.entries[idx];
  // For visitor entries, build player object directly from entry
  const player = entry._visitor
    ? { name: entry._name, pronunciation: entry._pronunciation }
    : allPlayers[entry.pid];
  if (!player) { setTimeout(() => introNext(), 500); return; }

  const useFr    = (appSettings.tts?.lang || 'en').startsWith('fr');
  const isBench  = idx >= 9;

  // ── Transition announcement before first bench player ──
  if (idx === 9 && appSettings.intro?.showRestOfTeam !== false) {
    // Show transition card in UI
    document.getElementById('introOrderNum').textContent  = '';
    document.getElementById('introName').textContent      = useFr ? 'ET MAINTENANT…' : 'AND NOW…';
    document.getElementById('introJersey').textContent    = '';
    document.getElementById('introPosBadge').style.display = 'none';
    document.getElementById('introPlayingLabel').textContent = useFr ? 'Le reste de l\'équipe !' : 'The rest of the team!';
    document.getElementById('introCounter').textContent   = `${idx + 1} / ${introState.entries.length}`;
    document.getElementById('introAvatar').innerHTML = `<svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      <text x="30" y="42" text-anchor="middle" font-size="40" fill="rgba(255,69,0,0.8)">🎉</text>
    </svg>`;

    await new Promise(r => setTimeout(r, 600));
    if (introState.index !== idx) return;

    const ttsEnabled = appSettings.tts?.enabled;
    if (ttsEnabled) {
      try {
        const transitionText = useFr
          ? 'Et maintenant… le reste de l\'équipe !'
          : 'And now… the rest of the team!';
        await ttsSpeak(transitionText);
      } catch(e) { console.warn('TTS failed:', e); }
    } else {
      await new Promise(r => setTimeout(r, 2000));
    }

    if (introState.index !== idx) return;
    await new Promise(r => setTimeout(r, 400));
    if (introState.index !== idx) return;
  }

  // Build position label (only for lineup players)
  const posCode = entry.pos || '';
  const posLabels_fr = {
    'P':'Pitcher','C':'Catcher','1B':'Première base','2B':'Deuxième base',
    '3B':'Troisième base','SS':'Shortstop','LF':'Champ gauche','CF':'Champ centre','RF':'Champ droit',
  };
  const posLabels_en = {
    'P':'Pitcher','C':'Catcher','1B':'First Base','2B':'Second Base',
    '3B':'Third Base','SS':'Shortstop','LF':'Left Field','CF':'Center Field','RF':'Right Field',
  };
  const extraPos   = (appSettings.extraPositions || []).find(p => p.code === posCode);
  const posDisplay = useFr
    ? (posLabels_fr[posCode] || extraPos?.label || posCode)
    : (posLabels_en[posCode] || extraPos?.label || posCode);
  const playingLabel = !isBench && posDisplay
    ? (useFr ? 'Position : ' + posDisplay : 'Playing ' + posDisplay)
    : '';

  // ── Update UI ──
  document.getElementById('introOrderNum').textContent  = isBench ? '' : idx + 1;
  document.getElementById('introName').textContent      = player.name.toUpperCase();
  document.getElementById('introJersey').textContent    = entry.jersey ? '#' + entry.jersey : '';
  document.getElementById('introPosBadge').textContent  = posCode;
  document.getElementById('introPosBadge').style.display = (!isBench && posCode) ? 'inline-block' : 'none';
  document.getElementById('introPlayingLabel').textContent = playingLabel;
  document.getElementById('introCounter').textContent   = `${idx + 1} / ${introState.entries.length}`;
  document.getElementById('introPauseIcon').innerHTML   = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';

  // Avatar
  const avatarEl = document.getElementById('introAvatar');
  if (player.photo) {
    avatarEl.innerHTML = `<img src="${player.photo}" style="width:100%;height:100%;object-fit:cover" />`;
  } else {
    avatarEl.innerHTML = `<svg width="60" height="60" viewBox="-16 -44 32 52" fill="none">
      <ellipse cx="0" cy="-18" rx="12" ry="14" fill="#555"/>
      <ellipse cx="0" cy="-30" rx="15" ry="7" fill="rgba(255,69,0,0.5)"/>
      <rect x="-15" y="-34" width="30" height="5" rx="2" fill="rgba(255,69,0,0.5)"/>
      <path d="M13,-30 L24,-28 L13,-26 Z" fill="rgba(255,69,0,0.5)"/>
      <rect x="-14" y="-2" width="28" height="20" rx="3" fill="#333"/>
    </svg>`;
  }

  // ── Pause before announcement — let UI render first ──
  await new Promise(r => setTimeout(r, 800));
  if (introState.index !== idx) return;

  // ── TTS ──
  const ttsEnabled = appSettings.tts?.enabled;
  if (ttsEnabled) {
    try { await ttsSpeak(ttsBuildIntroText(entry, idx)); } catch(e) { console.warn('TTS failed:', e); }
  }
  if (introState.index !== idx) return;

  // ── Delay before next player — shorter for bench players ──
  const delay = idx >= 9 ? 1000 : 10000;
  await new Promise(r => { introState.timer = setTimeout(r, delay); });
  if (introState.index !== idx) return;
  introNext();
}

function introNext() {
  introShowPlayer(introState.index + 1);
}

function introPrev() {
  introShowPlayer(Math.max(0, introState.index - 1));
}

function introTogglePause() {
  introState.paused = !introState.paused;
  const icon = document.getElementById('introPauseIcon');
  if (introState.paused) {
    if (window.speechSynthesis) speechSynthesis.pause();
    if (icon) icon.innerHTML = '<path d="M8 5v14l11-7z"/>';
  } else {
    if (window.speechSynthesis) speechSynthesis.resume();
    if (icon) icon.innerHTML = '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>';
  }
}

// Close on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('introOverlay')?.style.display !== 'none') {
    stopTeamIntro();
  }
  if (e.key === 'ArrowRight' && document.getElementById('introOverlay')?.style.display !== 'none') introNext();
  if (e.key === 'ArrowLeft'  && document.getElementById('introOverlay')?.style.display !== 'none') introPrev();
  if (e.key === ' '          && document.getElementById('introOverlay')?.style.display !== 'none') {
    e.preventDefault(); introTogglePause();
  }
});

// ── Touch swipe on intro overlay ──
(function() {
  let touchStartX = 0;
  let touchStartY = 0;
  // Attaché sur document (pas sur l'overlay) car les éléments enfants
  // (avatar, boutons, etc.) absorbent les touch events et empêchent
  // la propagation vers l'overlay.
  document.addEventListener('touchstart', e => {
    const overlay = document.getElementById('introOverlay');
    if (!overlay || overlay.style.display === 'none') return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    const overlay = document.getElementById('introOverlay');
    if (!overlay || overlay.style.display === 'none') return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) introNext();
    else introPrev();
  }, { passive: true });
})();

async function liveSoundUpload(key, input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  const sulbl = document.getElementById('sulbl' + cap);
  if (sulbl) { const txt = sulbl.childNodes[0]; if (txt) txt.textContent = '⏳ Uploading…\n'; }
  try {
    await liveSoundUploadFile(key, file);
    saveConfig();
  } catch(err) {
    if (sulbl) { const txt = sulbl.childNodes[0]; if (txt) txt.textContent = '❌ Error\n'; }
    setTimeout(() => { if (sulbl) { const txt = sulbl.childNodes[0]; if (txt) txt.textContent = '📂 Upload MP3\n'; } }, 3000);
    alert('Upload error: ' + err.message);
  }
}

// Custom sound: edit name
let customEditId = null;
function liveCustomSoundEdit(id) {
  customEditId = id;
  const s = liveCustomSounds.find(s => s.id === id);
  if (!s) return;
  soundEditPendingFile = null;
  document.getElementById('soundEditName').value = s.label;
  document.getElementById('soundEditFileName').textContent = s.url ? '✅ File loaded — choose to replace' : 'Choose MP3…';
  document.getElementById('soundEditFileInput').value = '';
  // Repurpose modal for custom sound
  soundEditKey = '__custom__';
  document.getElementById('soundEditModal').style.display = 'flex';
  document.getElementById('soundEditName').focus();
}

// Override save to handle custom sound
const _origLiveSoundEditSave = liveSoundEditSave;
async function liveSoundEditSave() {
  if (soundEditKey === '__field__') {
    const id = customEditId;
    const s = liveFieldSongs.find(s => s.id === id);
    if (!s) { liveSoundEditClose(); return; }
    const newName = document.getElementById('soundEditName').value.trim();
    if (newName) s.label = newName;
    if (soundEditPendingFile) {
      const saveBtn = document.getElementById('soundEditSaveBtn');
      saveBtn.textContent = '⏳ Uploading…'; saveBtn.disabled = true;
      try { await liveFieldSongUpload(id, { files: [soundEditPendingFile], value: '' }); }
      catch(e) { saveBtn.textContent = 'Save'; saveBtn.disabled = false; alert('Upload error: ' + e.message); return; }
      saveBtn.textContent = 'Save'; saveBtn.disabled = false;
    }
    localStorage.setItem('liveFieldSongs', JSON.stringify(liveFieldSongs));
    renderFieldSongs();
    liveSoundEditClose();
    return;
  }

  if (soundEditKey === '__custom__') {
    const id = customEditId;
    const s = liveCustomSounds.find(s => s.id === id);
    if (!s) { liveSoundEditClose(); return; }
    const newName = document.getElementById('soundEditName').value.trim();
    if (newName) s.label = newName;
    if (soundEditPendingFile) {
      const saveBtn = document.getElementById('soundEditSaveBtn');
      saveBtn.textContent = '⏳ Uploading…'; saveBtn.disabled = true;
      try {
        const file = soundEditPendingFile;
        const ext = file.name.split('.').pop().toLowerCase();
        const path = `soundboard/custom_${id}.${ext}`;
        let res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' },
          body: file,
        });
        if (!res.ok && res.status === 409) {
          res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
            method: 'PUT', headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': file.type, 'x-upsert': 'true' }, body: file,
          });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        s.url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
      } catch(e) {
        saveBtn.textContent = 'Save'; saveBtn.disabled = false;
        alert('Upload error: ' + e.message); return;
      }
      saveBtn.textContent = 'Save'; saveBtn.disabled = false;
    }
    saveCustomSoundsToConfig();
    renderCustomSounds();
    liveSoundEditClose();
    return;
  }
  // Built-in sound
  const key = soundEditKey;
  if (!key) return;
  const cap = key.charAt(0).toUpperCase() + key.slice(1);
  const saveBtn = document.getElementById('soundEditSaveBtn');
  const newName = document.getElementById('soundEditName').value.trim();
  if (newName) {
    LIVE_SOUNDS[key].label = newName;
    const lbl = document.getElementById('slbl' + cap);
    if (lbl) lbl.textContent = newName;
    if (!appSettings.soundboard) appSettings.soundboard = {};
    appSettings.soundboard[key + '_label'] = newName;
  }
  if (soundEditPendingFile) {
    saveBtn.textContent = '⏳ Uploading…'; saveBtn.disabled = true;
    try { await liveSoundUploadFile(key, soundEditPendingFile); }
    catch(e) { saveBtn.textContent = 'Save'; saveBtn.disabled = false; alert('Upload error: ' + e.message); return; }
    saveBtn.textContent = 'Save'; saveBtn.disabled = false;
  }
  saveConfig();
  liveSoundEditClose();
}

async function liveCustomSoundUpload(id, input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';
  const s = liveCustomSounds.find(s => s.id === id);
  if (!s) return;
  const btn = document.getElementById('lcsBtn_' + id);
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
  }
}

// ── LIVE MODE — SOUNDBOARD ──

// [{id, label, url}]