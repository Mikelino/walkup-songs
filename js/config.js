// ============================================================
//  WALK-UP SONGS — Configuration du club
//  Modifiez ce fichier avec les informations de votre club.
// ============================================================

const APP_CONFIG = {

  // ── SUPABASE ──────────────────────────────────────────────
  // Créez un projet sur https://supabase.com
  // Copiez l'URL et la clé anon depuis :
  // Project Settings > API > Project URL / anon public key

  supabaseUrl: 'https://hrsxgdxuzxcareszgmdt.supabase.co',
  supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhyc3hnZHh1enhjYXJlc3pnbWR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1ODQxMjcsImV4cCI6MjA4OTE2MDEyN30.fie59NGbhwCqCxCqtV14T8g-lXj2cbh9IvIyW6Ac7LY',

  // Nom du bucket de stockage audio (créé via setup.sql)
  bucket: 'songs',

  // ── MOT DE PASSE ADMIN ────────────────────────────────────
  // Mot de passe pour accéder à la page de configuration.
  // Changez-le immédiatement après l'installation !

  adminPassword: 'admin',

  // ── IDENTITÉ DU CLUB ──────────────────────────────────────
  // Valeurs par défaut affichées au premier chargement.
  // Elles peuvent ensuite être modifiées depuis Config > Interface.

  // Identifiant unique du club — utilisé pour isoler les sponsors en base.
  // Modifiez cette valeur si vous hébergez plusieurs clubs sur le même projet Supabase.
  clubId: 'andenne-black-bears',

  clubName:    'Andenne Black Bears',
  clubSub:     'Walk-Up Songs',
  clubWebsite: 'https://www.andenne-baseball.be/',

  // ── ÉQUIPES PAR DÉFAUT ────────────────────────────────────
  // Liste des équipes créées au premier lancement.
  // Format : { clé: 'label' }
  // Exemple : { U9: 'U9', U12: 'U12', Seniors: 'Seniors D1' }

  defaultTeams: {
    Equipe1: 'Équipe 1',
  },

  // ── DURÉE DE LECTURE (secondes) ───────────────────────────
  // Durée de lecture des walk-up songs (5 à 60 secondes).

  playDuration: 15,

};

// Supabase JS client — available globally as window.supabase
window.supabase = supabase.createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseKey);