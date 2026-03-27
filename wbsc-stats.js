/* ============================================================
   Diamond Pulse — js/audio.js
   Lecture audio, TTS, navigation par onglets, drag & drop

   Fonctions :
   - switchTeam(teamId)
   - togglePlay(entryIndex, e)
   - startPlayback(entry, entryIndex)
   - stopPlayback()
   - showCheer(name)
   - initSortable()
   - mainSwitchTab(tab)
   - ttsUnlock(), ttsSpeak(text)
   - ttsWebSpeech(), ttsOpenAI(), ttsElevenLabs()
   - ttsBuildText(entry), ttsBuildIntroText(entry, idx)
   - ttsInitPanel(), ttsSave(), ttsTest()
   - spellJersey(num, lang)

   Dépend de (globals) :
   - allPlayers, teams, currentTeamId, currentAudio, currentPid
   - progressInterval, sortable, isEditMode, appSettings, PLAY_DURATION
   - saveConfig(), render(), renderLiveLineup(), renderLiveVisitors()
   - renderVisitorsLineup(), matchRenderPanel(), initLiveMobileTabs()
   - liveSoundEditClose(), showCfgSaveIndicator()
   ============================================================ */

function switchTeam(teamId) {
  stopPlayback();
  currentTeamId = teamId;
  localStorage.setItem('lastTeamId', teamId);
  document.getElementById('sectionLabel').textContent = '⚾ Batting Order — ' + teams[teamId].label;
  document.getElementById('addForm').classList.remove('open');
  render();
}

// ── PLAY ──
function togglePlay(entryIndex, e) {
  // ✅ BLOQUAGE en mode édition (AJOUT)
  if (isEditMode) { if (e) e.stopPropagation(); return; }

  e.stopPropagation();
  const entry = currentLineup()[entryIndex];
  if (!entry) return;

  if (currentPid === entry.pid) { stopPlayback(); return; }

  stopPlayback();
  startPlayback(entry, entryIndex);
}

async function startPlayback(entry, entryIndex) {
  ttsUnlock();
  const player = allPlayers[entry.pid];
  if (!player) return;

  currentPid = entry.pid;

  const np = document.getElementById('nowPlaying');
  np.classList.add('active');

  document.getElementById('nowLabel').textContent = '▶ Batter up!';
  document.getElementById('nowName').textContent = player.name;
  document.getElementById('nowSong').textContent = (entry.song || '') + (entry.artist ? ' — ' + entry.artist : '');
  document.getElementById('progressWrap').style.display = 'block';

  const icon = document.getElementById('nowIcon');
  icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>';
  icon.classList.remove('spinning');
  void icon.offsetWidth;
  icon.classList.add('spinning');

  showCheer(player.name.split(' ')[0].toUpperCase());

  const t = appSettings.tts || {};
  const audioSrc = entry.blobUrl || entry.url;

  // ── Phase 1 : démarrer la walk-up song ──
  if (audioSrc && currentPid === entry.pid) {
    currentAudio = new Audio(audioSrc);
    currentAudio.currentTime = entry.start || 0;
    currentAudio.volume = 1;
    currentAudio.play().catch(() => {});
  }

  if (t.enabled) {
    // ── Phase 2 : attendre 2s puis TTS en simultané avec duck volume ──
    document.getElementById('nowLabel').textContent = '▶ Batter up!';
    await new Promise(r => setTimeout(r, 2000));
    if (currentPid !== entry.pid) return;

    document.getElementById('nowLabel').textContent = '🎙️ Announcing…';

    // Duck: baisser le volume progressivement vers 0.15
    const DUCK_VOLUME = 0.15;
    const DUCK_STEPS  = 15;
    const DUCK_MS     = 400;
    if (currentAudio) {
      let step = 0;
      const startVol = currentAudio.volume;
      const duckInterval = setInterval(() => {
        step++;
        if (currentAudio) currentAudio.volume = Math.max(startVol - (startVol - DUCK_VOLUME) * (step / DUCK_STEPS), DUCK_VOLUME);
        if (step >= DUCK_STEPS) clearInterval(duckInterval);
      }, DUCK_MS / DUCK_STEPS);
    }

    // TTS en simultané
    try {
      const text = ttsBuildText(entry);
      await ttsSpeak(text);
    } catch(e) {
      console.warn('TTS failed:', e);
    }

    if (currentPid !== entry.pid) return;
    document.getElementById('nowLabel').textContent = '▶ Batter up!';

    // Unduck: remonter le volume vers 1
    if (currentAudio) {
      let step = 0;
      const startVol = currentAudio.volume;
      const unduckInterval = setInterval(() => {
        step++;
        if (currentAudio) currentAudio.volume = Math.min(startVol + (1 - startVol) * (step / DUCK_STEPS), 1);
        if (step >= DUCK_STEPS) clearInterval(unduckInterval);
      }, DUCK_MS / DUCK_STEPS);
    }
  } else {
    document.getElementById('nowLabel').textContent = '▶ Batter up!';
  }

  let elapsed = 0;
  document.getElementById('progressFill').style.width = '0%';

  progressInterval = setInterval(() => {
    elapsed += 0.1;
    const pct = Math.min((elapsed / PLAY_DURATION) * 100, 100);
    document.getElementById('progressFill').style.width = pct + '%';

    const s = Math.floor(elapsed);
    document.getElementById('progressTime').textContent =
      `0:${String(s).padStart(2,'0')} / 0:${PLAY_DURATION}`;

    if (elapsed >= PLAY_DURATION) stopPlayback();
  }, 100);

  render();
}

function stopPlayback() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  clearInterval(progressInterval);
  if (window.speechSynthesis) speechSynthesis.cancel();
  currentPid = null;

  document.getElementById('nowPlaying').classList.remove('active');
  document.getElementById('nowLabel').textContent = 'Waiting';
  document.getElementById('nowName').textContent = 'Select a player';
  document.getElementById('nowSong').textContent = '';
  document.getElementById('progressWrap').style.display = 'none';
  document.getElementById('progressFill').style.width = '0%';
  document.getElementById('nowIcon').innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>';

  render();
}

// ── CHEER ──
function showCheer(name) {
  const ov = document.getElementById('cheerOverlay');
  const ct = document.getElementById('cheerText');
  const cs = document.getElementById('cheerSub');

  ct.textContent = name + '!';
  ov.classList.add('show');

  ct.style.animation = 'none';
  cs.style.animation = 'none';
  void ct.offsetWidth;

  ct.style.animation = 'cheer-in 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards';
  cs.style.animation = 'sub-in 0.3s 0.3s ease forwards';

  setTimeout(() => {
    ov.classList.remove('show');
    ct.style.animation = 'none';
    cs.style.animation = 'none';
    ct.style.transform = 'scale(0)';
    ct.style.opacity = '0';
    cs.style.opacity = '0';
  }, 1400);
}

// ── ADD PLAYER ──

// ── SORTABLE ──
function initSortable() {
  if (sortable) { sortable.destroy(); sortable = null; }

  const isMobile = window.matchMedia('(max-width: 640px)').matches;

  // Sur mobile hors édition : pas de Sortable (évite d'intercepter les taps)
  if (isMobile && !isEditMode) return;

  const handle = (isMobile && isEditMode) ? '.player-card' : '.drag-handle';

  sortable = Sortable.create(document.getElementById('lineup'), {
    disabled: false,

    handle: handle,
    animation: 150,
    delay: isMobile ? 400 : 150,
    delayOnTouchOnly: true,
    touchStartThreshold: 4,
    forceFallback: true,
    fallbackTolerance: 5,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',

    onChoose() {
      if (isMobile && navigator.vibrate) navigator.vibrate(40);
    },

    onEnd() {
      const newOrder = [...document.querySelectorAll('.player-card')]
        .map(card => parseInt(card.dataset.index));

      const oldLineup = [...currentLineup()];
      teams[currentTeamId].lineup = newOrder.map(i => oldLineup[i]);

      // Mettre à jour les numéros sans re-render complet
      document.querySelectorAll('.player-card').forEach((card, i) => {
        const entry = currentLineup()[i];
        const isAbsent = entry && entry.present === false;
        const presentCount = currentLineup().slice(0, i + 1).filter(e => e.present !== false).length;
        const orderNum = isAbsent ? '—' : presentCount;
        card.querySelector('.order-num').textContent = orderNum;
        card.dataset.index = i;
      });

      saveConfig();
    }
  });
}

// ═══════════════════════════════════════════
// NAVIGATION PRINCIPALE
// ═══════════════════════════════════════════
function mainSwitchTab(tab) {
  document.querySelectorAll('.main-nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('mainNav' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  document.querySelectorAll('.main-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('mainPanel' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  if (tab !== 'batting') document.getElementById('addForm').classList.remove('open');
  if (tab === 'live') { renderLiveLineup(); renderLiveVisitors(); initLiveMobileTabs(); }
  if (tab === 'batting') renderVisitorsLineup();
  if (tab === 'match') matchRenderPanel();
  liveSoundEditClose(); // always close modal on tab switch
}

// ═══════════════════════════════════════════
// PAGE CONFIGURATION — JS
// ═══════════════════════════════════════════
let cfgAdminUnlocked = false;
let cfgRenameTargetKey = null;
let cfgDeleteTargetKey = null;


// ── TTS ──

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

const ORDINALS_FR = ['Premier','Deuxième','Troisième','Quatrième','Cinquième','Sixième','Septième','Huitième','Neuvième'];
const ORDINALS_EN = ['First','Second','Third','Fourth','Fifth','Sixth','Seventh','Eighth','Ninth'];

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
let _cachedVoices = [];
function ttsPreloadVoices() {
  if (!window.speechSynthesis) return;
  const v = speechSynthesis.getVoices();
  if (v.length > 0) { _cachedVoices = v; return; }
  speechSynthesis.onvoiceschanged = () => {
    _cachedVoices = speechSynthesis.getVoices();
  };
}
ttsPreloadVoices();

let _ttsUnlocked = false;
let _sharedAudioCtx = null;
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

const TTS_TEMPLATES = {
  'en':       'Now batting, number {jersey}, {name}!',
  'en-short': '{name}!',
  'fr':       'Au bâton, numéro {jersey}, {name} !',
  'fr-short': '{name} !',
};

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
