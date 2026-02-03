#!/usr/bin/env node

/* ============================================
   ONE-TIME UPLOAD SCRIPT
   ============================================
   Reads all files from the local photos/ directory
   and uploads them to the Supabase Storage "photos"
   bucket (private). Uses the service role key to
   bypass RLS.

   Usage:
     1. Set environment variables (or create a .env):
        SUPABASE_URL=https://your-project.supabase.co
        SUPABASE_SERVICE_ROLE_KEY=eyJ...
     2. Run:
        node scripts/upload-photos.js
   ============================================ */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ── Load .env if present ──────────────────
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (_) {
  // dotenv not installed — rely on env vars
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('Set them in a .env file or export them before running this script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BUCKET = 'photos';
const PHOTOS_DIR = path.resolve(__dirname, '..', 'photos');

// MIME types for common image formats
const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.heic': 'image/heic',
};

async function main() {
  // Verify photos directory exists
  if (!fs.existsSync(PHOTOS_DIR)) {
    console.error('photos/ directory not found at:', PHOTOS_DIR);
    process.exit(1);
  }

  // Read all files
  const files = fs.readdirSync(PHOTOS_DIR).filter(function (f) {
    const ext = path.extname(f).toLowerCase();
    return MIME_TYPES[ext] !== undefined;
  });

  console.log('Found', files.length, 'image files to upload.');

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filename of files) {
    const filePath = path.join(PHOTOS_DIR, filename);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const fileBuffer = fs.readFileSync(filePath);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filename, fileBuffer, {
        contentType: contentType,
        upsert: true, // overwrite if exists
      });

    if (error) {
      console.error('  FAIL:', filename, '-', error.message);
      failed++;
    } else {
      uploaded++;
      if (uploaded % 10 === 0 || uploaded === files.length) {
        console.log('  Uploaded', uploaded, '/', files.length);
      }
    }
  }

  console.log('\nDone!');
  console.log('  Uploaded:', uploaded);
  console.log('  Failed:', failed);
  console.log('  Total:', files.length);
}

main().catch(function (err) {
  console.error('Unexpected error:', err);
  process.exit(1);
});
