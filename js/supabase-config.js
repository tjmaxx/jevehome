/* ============================================
   SUPABASE CLIENT INITIALIZATION
   ============================================
   Replace the placeholder values below with your
   actual Supabase project URL and anon (public) key.
   These are safe to expose in frontend code — RLS
   policies protect your data server-side.
   ============================================ */

(function () {
  'use strict';

  // ── Supabase credentials ──────────────────
  // IMPORTANT: Replace these with your real Supabase project values.
  // Find them at: https://supabase.com/dashboard → Project Settings → API
  var SUPABASE_URL  = 'https://sytogitulennckeismie.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5dG9naXR1bGVubmNrZWlzbWllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTM4NzQsImV4cCI6MjA4NTYyOTg3NH0.6mUH9nBSoWShkH463a48cx6iMLLYk2bOMPV3A-KYmwI';

  // ── Initialize Supabase client ────────────
  // The supabase-js library is loaded via CDN in index.html
  if (typeof supabase === 'undefined' || !supabase.createClient) {
    console.error('[jevehome] Supabase JS library not loaded. Check the CDN script tag.');
    return;
  }

  window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  console.log('[jevehome] Supabase client initialized.');
})();
