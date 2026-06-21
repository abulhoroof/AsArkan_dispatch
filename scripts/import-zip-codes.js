/**
 * Script to import zip codes from CSV into Supabase
 * 
 * Usage: node scripts/import-zip-codes.js
 * 
 * Make sure you have SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY set in your environment
 * or create a .env file with these values.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
function loadEnvFile() {
  try {
    const envPath = join(__dirname, '../.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const match = line.match(/^([^=]+)=["']?([^"'\n]+)["']?$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          env[key] = value;
        }
      }
    });
    
    return env;
  } catch (e) {
    return {};
  }
}

const env = loadEnvFile();

// Get Supabase URL from .env file (automatically uses VITE_SUPABASE_URL)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.SUPABASE_URL;

// Get Service Role Key (must be added to .env file)
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('Error: SUPABASE_URL not found');
  console.error('Please set VITE_SUPABASE_URL in your .env file');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('You can find it in your Supabase dashboard: Settings → API → Service Role Key');
  console.error('Add it to your .env file as: SUPABASE_SERVICE_ROLE_KEY="your-key-here"');
  console.error('\nNote: The Service Role Key is different from the Publishable Key');
  console.error('      It has elevated permissions needed for bulk imports');
  process.exit(1);
}

console.log(`Connecting to Supabase: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function parseCSVLine(line) {
  const parts = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  
  return parts;
}

async function importZipCodes() {
  try {
    console.log('Reading CSV file...');
    const csvPath = join(__dirname, '../src/data/zip_codes_usa.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    
    console.log('Parsing CSV...');
    const lines = csvContent.split('\n');
    const zipCodes = [];
    
    // Skip header line (index 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = parseCSVLine(line);
      if (parts.length >= 8) {
        zipCodes.push({
          zip: parts[0],
          lat: parseFloat(parts[1]),
          lng: parseFloat(parts[2]),
          city: parts[3],
          state_id: parts[4],
          state_name: parts[5],
          county_name: parts[6],
          timezone: parts[7]
        });
      }
    }

    console.log(`Found ${zipCodes.length} zip codes to import`);

    // Insert in batches of 1000
    const batchSize = 1000;
    let imported = 0;
    let errors = 0;

    console.log('Importing zip codes...');
    for (let i = 0; i < zipCodes.length; i += batchSize) {
      const batch = zipCodes.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('zip_codes')
        .upsert(batch, {
          onConflict: 'zip',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`Error importing batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        errors += batch.length;
      } else {
        imported += batch.length;
        console.log(`Imported ${imported} / ${zipCodes.length} zip codes...`);
      }
    }

    console.log('\n✅ Import complete!');
    console.log(`   Imported: ${imported}`);
    console.log(`   Errors: ${errors}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

importZipCodes();

