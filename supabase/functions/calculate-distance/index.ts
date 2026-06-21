import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.80.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { fromPlace, toPlace } = await req.json();

    if (!fromPlace || !toPlace) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing fromPlace or toPlace' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Calculating distance from "${fromPlace}" to "${toPlace}"`);

    // Initialize Supabase client with service role for zip code lookups
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract zip codes from locations
    const extractZip = (location: string): string | null => {
      const matches = location.match(/\b\d{5}\b/g);
      // Use the LAST 5-digit match — zip codes appear at the end of addresses
      return matches && matches.length > 0 ? matches[matches.length - 1] : null;
    };

    const fromZip = extractZip(fromPlace);
    const toZip = extractZip(toPlace);

    if (!fromZip || !toZip) {
      return new Response(
        JSON.stringify({ success: false, error: 'Could not extract zip codes from locations' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Look up coordinates for both zip codes
    const { data: fromData, error: fromError } = await supabase
      .from('zip_codes')
      .select('lat, lng')
      .eq('zip', fromZip)
      .single();

    const { data: toData, error: toError } = await supabase
      .from('zip_codes')
      .select('lat, lng')
      .eq('zip', toZip)
      .single();

    if (fromError || !fromData) {
      console.warn(`Could not find coordinates for zip ${fromZip}:`, fromError);
      return new Response(
        JSON.stringify({ success: false, error: `Zip code ${fromZip} not found in database`, distance: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (toError || !toData) {
      console.warn(`Could not find coordinates for zip ${toZip}:`, toError);
      return new Response(
        JSON.stringify({ success: false, error: `Zip code ${toZip} not found in database`, distance: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`From coordinates: ${fromData.lng}, ${fromData.lat}`);
    console.log(`To coordinates: ${toData.lng}, ${toData.lat}`);

    // Use OSRM (Open Source Routing Machine) API for driving distance
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromData.lng},${fromData.lat};${toData.lng},${toData.lat}?overview=false`;
    
    console.log(`Fetching from OSRM: ${osrmUrl}`);

    // Add timeout to prevent infinite hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    // Haversine fallback helper
    const haversineDistance = (lat1d: number, lng1d: number, lat2d: number, lng2d: number): number => {
      const R = 3958.8;
      const lat1 = lat1d * Math.PI / 180;
      const lat2 = lat2d * Math.PI / 180;
      const deltaLat = (lat2d - lat1d) * Math.PI / 180;
      const deltaLng = (lng2d - lng1d) * Math.PI / 180;
      const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    let osrmResponse: Response;
    try {
      osrmResponse = await fetch(osrmUrl, { signal: controller.signal });
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      console.warn('OSRM fetch failed or timed out:', fetchErr);
      const straightLineDistance = haversineDistance(fromData.lat, fromData.lng, toData.lat, toData.lng);
      console.log(`Fallback straight-line distance: ${straightLineDistance.toFixed(2)} miles`);
      
      return new Response(
        JSON.stringify({
          success: true,
          distance: straightLineDistance,
          formatted: `~${Math.round(straightLineDistance)} mi`,
          isEstimate: true,
          note: 'OSRM timeout - straight-line distance shown'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    clearTimeout(timeoutId);
    
    const contentType = osrmResponse.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const textBody = await osrmResponse.text();
      console.warn('OSRM returned non-JSON response:', textBody.substring(0, 200));
      const straightLineDistance = haversineDistance(fromData.lat, fromData.lng, toData.lat, toData.lng);
      
      return new Response(
        JSON.stringify({
          success: true,
          distance: straightLineDistance,
          formatted: `~${Math.round(straightLineDistance)} mi`,
          isEstimate: true,
          note: 'OSRM unavailable - straight-line distance shown'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const osrmData = await osrmResponse.json();

    if (!osrmResponse.ok || osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
      console.log('OSRM could not find a driving route, calculating straight-line distance');
      const straightLineDistance = haversineDistance(fromData.lat, fromData.lng, toData.lat, toData.lng);
      console.log(`Straight-line distance: ${straightLineDistance.toFixed(2)} miles (no driving route available)`);

      return new Response(
        JSON.stringify({
          success: true,
          distance: straightLineDistance,
          formatted: `~${Math.round(straightLineDistance)} mi`,
          isEstimate: true,
          note: 'No driving route available - straight-line distance shown'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const distanceMeters = osrmData.routes[0].distance;
    const distanceMiles = distanceMeters * 0.000621371;

    console.log(`Distance calculated: ${distanceMiles.toFixed(2)} miles`);

    return new Response(
      JSON.stringify({
        success: true,
        distance: distanceMiles,
        formatted: `${Math.round(distanceMiles)} mi`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error calculating distance:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An error occurred while calculating distance'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
