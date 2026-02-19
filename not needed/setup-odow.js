/**
 * ODOW Setup Script
 *
 * This script parses the odow.txt file and inserts all entries into Supabase.
 * Alternatively, you can run setup-odow.sql directly in Supabase SQL Editor.
 *
 * BEFORE RUNNING:
 * 1. Create the 'odow' table in Supabase (see setup-odow.sql)
 * 2. Set your Supabase credentials below or as environment variables
 *
 * USAGE:
 *   SUPABASE_URL=your_url SUPABASE_SERVICE_KEY=your_key node setup-odow.js
 */

const fs = require('fs');

// ============ CONFIGURE THESE ============
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SERVICE_ROLE_KEY';
// ==========================================

// Parse the odow.txt file
function parseODOWFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries = [];

  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line is a date line (starts with -- and has a date)
    const dateMatch = trimmed.match(/^--?\s*(\d{1,2}\/\d{1,2}(?:-\d{1,2})?\/\d{2,4})\s*$/);

    if (dateMatch) {
      // Save previous entry
      if (currentContent.length > 0) {
        const noteText = currentContent.join('\n').trim().replace(/^\ufeff/, ''); // Remove BOM
        if (noteText) {
          entries.push({
            content: noteText,
            note_date: dateMatch[1]
          });
        }
      }
      currentContent = [];
    } else if (trimmed) {
      currentContent.push(trimmed);
    }
  }

  return entries;
}

// Insert entries into Supabase
async function insertEntries(entries) {
  console.log(`Inserting ${entries.length} entries into Supabase...`);

  const response = await fetch(`${SUPABASE_URL}/rest/v1/odow`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify(entries)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to insert: ${error}`);
  }

  console.log('Successfully inserted all ODOW entries!');
}

// Main
async function main() {
  try {
    console.log('Parsing odow.txt...');
    const entries = parseODOWFile('./odow.txt');
    console.log(`Parsed ${entries.length} entries`);

    console.log('\nSample entries:');
    entries.slice(0, 3).forEach((e, i) => {
      console.log(`\n${i + 1}. [${e.note_date}]`);
      console.log(`   ${e.content.substring(0, 60)}...`);
    });

    if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      console.log('\n⚠️  Supabase credentials not configured!');
      console.log('Options:');
      console.log('1. Run setup-odow.sql directly in Supabase SQL Editor');
      console.log('2. Set environment variables and re-run this script:');
      console.log('   SUPABASE_URL=your_url SUPABASE_SERVICE_KEY=your_key node setup-odow.js');
      return;
    }

    await insertEntries(entries);

  } catch (err) {
    console.error('Error:', err.message);
  }
}

main();
