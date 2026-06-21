/**
 * Complete setup script for zip codes table
 * This will:
 * 1. Apply the migration to create the table
 * 2. Import all zip codes from CSV
 * 
 * Usage: node scripts/setup-zip-codes.js
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
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('❌ Error: SUPABASE_URL not found');
  console.error('Please set VITE_SUPABASE_URL in your .env file');
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('\n📝 To get your Service Role Key:');
  console.error('   1. Go to your Supabase dashboard: https://supabase.com/dashboard');
  console.error('   2. Select your project');
  console.error('   3. Go to Settings → API');
  console.error('   4. Copy the "service_role" key (NOT the anon key)');
  console.error('   5. Add it to your .env file as:');
  console.error('      SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-here"');
  console.error('\n⚠️  Keep this key secret! It has elevated permissions.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applyMigration() {
  console.log('\n📋 Step 1: Applying migration to create zip_codes table...\n');
  
  const migrationSQL = `
-- Create zip_codes table
CREATE TABLE IF NOT EXISTS public.zip_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  zip TEXT NOT NULL UNIQUE,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  city TEXT NOT NULL,
  state_id TEXT NOT NULL,
  state_name TEXT NOT NULL,
  county_name TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_zip_codes_zip ON public.zip_codes(zip);
CREATE INDEX IF NOT EXISTS idx_zip_codes_state_id ON public.zip_codes(state_id);
CREATE INDEX IF NOT EXISTS idx_zip_codes_city ON public.zip_codes(city);

-- Enable Row Level Security (read-only for all authenticated users)
ALTER TABLE public.zip_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can read zip codes" ON public.zip_codes;

-- Create policy: All authenticated users can read zip codes
CREATE POLICY "Anyone can read zip codes"
  ON public.zip_codes
  FOR SELECT
  USING (true);
`;

  try {
    // Execute migration using RPC or direct SQL
    // Note: Supabase JS client doesn't support raw SQL directly
    // We'll check if table exists first, then create it via a function call
    const { data: tableExists, error: checkError } = await supabase
      .rpc('exec_sql', { sql: 'SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = \'public\' AND table_name = \'zip_codes\')' })
      .catch(() => ({ data: null, error: { message: 'RPC not available' } }));

    // Alternative: Try to query the table to see if it exists
    const { error: queryError } = await supabase
      .from('zip_codes')
      .select('zip')
      .limit(1);

    if (!queryError) {
      console.log('✅ zip_codes table already exists');
      return true;
    }

    // Table doesn't exist, need to create it
    // Since we can't run raw SQL directly, we'll guide the user
    console.log('⚠️  Cannot create table programmatically (Supabase JS client limitation)');
    console.log('\n📝 Please apply the migration manually:');
    console.log('   1. Go to your Supabase dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log('   3. Run the migration from: supabase/migrations/20251122000000_create_zip_codes_table.sql');
    console.log('\n   Or use Supabase CLI:');
    console.log('   supabase db push');
    console.log('\n⏭️  Continuing with import (will fail if table doesn\'t exist)...\n');
    return false;
  } catch (error) {
    console.error('❌ Error applying migration:', error.message);
    return false;
  }
}

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
  console.log('📦 Step 2: Importing zip codes from CSV...\n');
  
  try {
    const csvPath = join(__dirname, '../src/data/zip_codes_usa.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n');
    const zipCodes = [];
    
    console.log('📄 Parsing CSV file...');
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

    console.log(`✅ Found ${zipCodes.length} zip codes to import\n`);

    // Insert in batches of 1000
    const batchSize = 1000;
    let imported = 0;
    let errors = 0;
    const totalBatches = Math.ceil(zipCodes.length / batchSize);

    console.log('🚀 Starting import...\n');
    for (let i = 0; i < zipCodes.length; i += batchSize) {
      const batch = zipCodes.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      const { data, error } = await supabase
        .from('zip_codes')
        .upsert(batch, {
          onConflict: 'zip',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`❌ Error importing batch ${batchNum}/${totalBatches}:`, error.message);
        errors += batch.length;
      } else {
        imported += batch.length;
        const percentage = ((imported / zipCodes.length) * 100).toFixed(1);
        console.log(`✅ Batch ${batchNum}/${totalBatches}: Imported ${imported}/${zipCodes.length} (${percentage}%)`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Import complete!');
    console.log(`   ✅ Imported: ${imported}`);
    if (errors > 0) {
      console.log(`   ❌ Errors: ${errors}`);
    }
    console.log('='.repeat(50) + '\n');
    
    return imported > 0;
  } catch (error) {
    console.error('❌ Fatal error during import:', error.message);
    if (error.message.includes('does not exist') || error.message.includes('relation')) {
      console.error('\n💡 The zip_codes table does not exist yet.');
      console.error('   Please apply the migration first (see Step 1 above).');
    }
    return false;
  }
}

async function main() {
  console.log('🚀 Zip Codes Setup Script');
  console.log('='.repeat(50));
  console.log(`📡 Connecting to: ${SUPABASE_URL}\n`);

  // Try to apply migration (may not work programmatically)
  await applyMigration();
  
  // Import data
  const success = await importZipCodes();
  
  if (success) {
    console.log('🎉 Setup complete! You can now use zip code lookups from Supabase.');
  } else {
    console.log('\n⚠️  Setup incomplete. Please check the errors above.');
    process.exit(1);
  }
}

main();

