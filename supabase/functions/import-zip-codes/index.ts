import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Constants for validation
const MAX_RECORDS = 50000;
const MAX_ZIP_LENGTH = 10;
const MAX_CITY_LENGTH = 100;
const MAX_STATE_ID_LENGTH = 5;
const MAX_STATE_NAME_LENGTH = 50;
const MAX_COUNTY_LENGTH = 100;
const MAX_TIMEZONE_LENGTH = 50;

// Validate latitude (-90 to 90)
function isValidLatitude(lat: number): boolean {
  return !isNaN(lat) && lat >= -90 && lat <= 90;
}

// Validate longitude (-180 to 180)
function isValidLongitude(lng: number): boolean {
  return !isNaN(lng) && lng >= -180 && lng <= 180;
}

// Sanitize string input
function sanitizeString(str: string | undefined, maxLength: number): string | null {
  if (!str) return null;
  return str.trim().slice(0, maxLength);
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting zip code import...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get the JWT token from the request header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's JWT to check their role
    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is an admin using the has_role function
    const { data: isAdmin, error: roleError } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (roleError) {
      console.error('Role check error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify permissions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!isAdmin) {
      console.log('Non-admin user attempted zip code import:', user.id);
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin user verified:', user.id);
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get the CSV data from the request body
    const { csvData } = await req.json();
    
    if (!csvData || typeof csvData !== 'string') {
      throw new Error('No CSV data provided or invalid format');
    }

    console.log('Parsing CSV data...');
    const lines = csvData.split('\n').filter((line: string) => line.trim());
    
    // Skip header line and limit records
    const dataLines = lines.slice(1, MAX_RECORDS + 1);
    
    if (lines.length - 1 > MAX_RECORDS) {
      console.log(`Warning: CSV has ${lines.length - 1} records, limiting to ${MAX_RECORDS}`);
    }
    
    const zipCodes = [];
    
    for (const line of dataLines) {
      const parts = parseCSVLine(line);
      const [zip, lat, lng, city, state_id, state_name, county_name, timezone] = parts;
      
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      
      // Validate required fields and coordinate ranges
      if (zip && city && state_id && state_name && 
          isValidLatitude(parsedLat) && isValidLongitude(parsedLng)) {
        zipCodes.push({
          zip: sanitizeString(zip, MAX_ZIP_LENGTH)!,
          lat: parsedLat,
          lng: parsedLng,
          city: sanitizeString(city, MAX_CITY_LENGTH)!,
          state_id: sanitizeString(state_id, MAX_STATE_ID_LENGTH)!,
          state_name: sanitizeString(state_name, MAX_STATE_NAME_LENGTH)!,
          county_name: sanitizeString(county_name, MAX_COUNTY_LENGTH),
          timezone: sanitizeString(timezone, MAX_TIMEZONE_LENGTH)
        });
      }
    }
    
    console.log(`Parsed ${zipCodes.length} valid zip codes`);
    
    // Insert in batches of 1000
    const batchSize = 1000;
    let imported = 0;
    
    for (let i = 0; i < zipCodes.length; i += batchSize) {
      const batch = zipCodes.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('zip_codes')
        .upsert(batch, { onConflict: 'zip' });
      
      if (error) {
        console.error(`Error importing batch ${Math.floor(i / batchSize) + 1}:`, error.message);
        throw error;
      } else {
        imported += batch.length;
        console.log(`Imported ${imported} / ${zipCodes.length} zip codes`);
      }
    }
    
    console.log(`Import complete! Total imported: ${imported} zip codes`);
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        imported,
        total: zipCodes.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
    
  } catch (error) {
    console.error('Error during import:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
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
