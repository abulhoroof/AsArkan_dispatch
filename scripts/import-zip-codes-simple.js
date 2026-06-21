import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get Supabase credentials from environment
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

async function importZipCodes() {
  console.log('📍 Starting zip code import...\n');
  
  try {
    // Read the CSV file
    const csvPath = join(__dirname, '..', 'src', 'data', 'zip_codes_usa.csv');
    const csvContent = readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log(`📄 Found ${lines.length - 1} zip codes to import\n`);
    
    // Skip header line
    const dataLines = lines.slice(1);
    const zipCodes = [];
    
    for (const line of dataLines) {
      const [zip, lat, lng, city, state_id, state_name, county_name, timezone] = parseCSVLine(line);
      
      if (zip && lat && lng && city && state_id && state_name) {
        zipCodes.push({
          zip: zip.trim(),
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          city: city.trim(),
          state_id: state_id.trim(),
          state_name: state_name.trim(),
          county_name: county_name?.trim() || null,
          timezone: timezone?.trim() || null
        });
      }
    }
    
    console.log(`✅ Parsed ${zipCodes.length} valid zip codes\n`);
    
    // Insert in batches of 1000
    const batchSize = 1000;
    let imported = 0;
    
    for (let i = 0; i < zipCodes.length; i += batchSize) {
      const batch = zipCodes.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('zip_codes')
        .upsert(batch, { onConflict: 'zip' });
      
      if (error) {
        console.error(`❌ Error importing batch ${Math.floor(i / batchSize) + 1}:`, error.message);
      } else {
        imported += batch.length;
        console.log(`✅ Imported ${imported} / ${zipCodes.length} zip codes`);
      }
    }
    
    console.log(`\n🎉 Import complete! Total imported: ${imported} zip codes`);
    
  } catch (error) {
    console.error('❌ Error during import:', error.message);
    process.exit(1);
  }
}

// Run the import
importZipCodes();
