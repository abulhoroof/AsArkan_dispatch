import { supabase } from '@/integrations/supabase/client';

export interface ZipCodeData {
  zip: string;
  lat: number;
  lng: number;
  city: string;
  state_id: string;
  state_name: string;
  county_name: string;
  timezone: string;
}

// Bounded cache helper - evicts oldest entry when full
function boundedSet<K, V>(map: Map<K, V>, key: K, value: V, maxSize: number) {
  if (map.size >= maxSize) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, value);
}

// Cache for zip code lookups
let zipCodeCache: Map<string, ZipCodeData> = new Map();
let stateZipCache: Map<string, ZipCodeData[]> = new Map();

export async function lookupZipCode(zip: string): Promise<ZipCodeData | null> {
  if (zipCodeCache.has(zip)) {
    return zipCodeCache.get(zip) || null;
  }

  try {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('*')
      .eq('zip', zip)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const zipData: ZipCodeData = {
      zip: data.zip,
      lat: data.lat,
      lng: data.lng,
      city: data.city,
      state_id: data.state_id,
      state_name: data.state_name,
      county_name: data.county_name,
      timezone: data.timezone,
    };

    boundedSet(zipCodeCache, zip, zipData, 2000);
    return zipData;
  } catch (error) {
    console.error('Error looking up zip code:', error);
    return null;
  }
}

export async function getCityStateFromZip(zip: string): Promise<string | null> {
  const data = await lookupZipCode(zip);
  if (!data) return null;
  return `${data.city}, ${data.state_id}`;
}

export function extractZipFromLocation(location: string): string | null {
  const zipMatch = location.match(/\b\d{5}\b/);
  return zipMatch ? zipMatch[0] : null;
}

export async function getZipCodesByState(stateId: string): Promise<ZipCodeData[]> {
  const upperStateId = stateId.toUpperCase();

  if (stateZipCache.has(upperStateId)) {
    return stateZipCache.get(upperStateId) || [];
  }

  try {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('*')
      .eq('state_id', upperStateId)
      .order('city', { ascending: true })
      .limit(1000);

    if (error || !data) {
      return [];
    }

    const zipCodes: ZipCodeData[] = data.map(item => ({
      zip: item.zip,
      lat: item.lat,
      lng: item.lng,
      city: item.city,
      state_id: item.state_id,
      state_name: item.state_name,
      county_name: item.county_name,
      timezone: item.timezone,
    }));

    boundedSet(stateZipCache, upperStateId, zipCodes, 60);
    return zipCodes;
  } catch (error) {
    console.error('Error getting zip codes by state:', error);
    return [];
  }
}

export function extractStateFromLocation(location: string): string | null {
  const stateMatch = location.match(/[,\s]([A-Z]{2})(?:\s|$|,|\d)/i);
  return stateMatch ? stateMatch[1].toUpperCase() : null;
}

export function extractCityFromLocation(location: string): string | null {
  const cityMatch = location.match(/^([^,]+?)(?:\s*,\s*[A-Z]{2}|$)/i);
  return cityMatch ? cityMatch[1].trim() : location.trim();
}

// Cache for city search results
let citySearchCache: Map<string, ZipCodeData[]> = new Map();

export async function searchByZipOrCity(query: string, limit: number = 50): Promise<ZipCodeData[]> {
  const trimmedQuery = query.trim();

  if (/^\d{5}$/.test(trimmedQuery)) {
    const zipData = await lookupZipCode(trimmedQuery);
    return zipData ? [zipData] : [];
  }

  if (/^\d{1,4}$/.test(trimmedQuery)) {
    try {
      const { data, error } = await supabase
        .from('zip_codes')
        .select('*')
        .ilike('zip', `${trimmedQuery}%`)
        .order('zip', { ascending: true })
        .limit(limit);

      if (error || !data) return [];

      return data.map(item => ({
        zip: item.zip,
        lat: item.lat,
        lng: item.lng,
        city: item.city,
        state_id: item.state_id,
        state_name: item.state_name,
        county_name: item.county_name,
        timezone: item.timezone,
      }));
    } catch {
      return [];
    }
  }

  return searchZipCodesByCity(trimmedQuery, limit);
}

export async function searchZipCodesByCity(cityQuery: string, limit: number = 50): Promise<ZipCodeData[]> {
  if (!cityQuery || cityQuery.length < 2) {
    return [];
  }

  let cityPart = cityQuery.trim();
  let statePart: string | null = null;

  if (cityQuery.includes(',')) {
    const parts = cityQuery.split(',');
    cityPart = parts[0].trim();
    statePart = parts[1]?.trim()?.toUpperCase() || null;
  }

  if (cityPart.length < 2) {
    return [];
  }

  const cacheKey = `${cityPart.toLowerCase()}_${statePart || ''}`;
  if (citySearchCache.has(cacheKey)) {
    return citySearchCache.get(cacheKey) || [];
  }

  try {
    let query = supabase
      .from('zip_codes')
      .select('*')
      .ilike('city', `%${cityPart}%`);

    if (statePart && statePart.length >= 1) {
      query = query.ilike('state_id', `${statePart}%`);
    }

    const { data, error } = await query
      .order('city', { ascending: true })
      .order('zip', { ascending: true })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    const zipCodes: ZipCodeData[] = data.map(item => ({
      zip: item.zip,
      lat: item.lat,
      lng: item.lng,
      city: item.city,
      state_id: item.state_id,
      state_name: item.state_name,
      county_name: item.county_name,
      timezone: item.timezone,
    }));

    boundedSet(citySearchCache, cacheKey, zipCodes, 200);
    return zipCodes;
  } catch (error) {
    console.error('Error searching zip codes by city:', error);
    return [];
  }
}

export async function validateAndEnhanceLocation(location: string): Promise<{
  originalLocation: string;
  zipCode: string | null;
  cityState: string | null;
  isValid: boolean;
}> {
  const zipCode = extractZipFromLocation(location);

  if (!zipCode) {
    return {
      originalLocation: location,
      zipCode: null,
      cityState: null,
      isValid: false,
    };
  }

  const cityState = await getCityStateFromZip(zipCode);

  return {
    originalLocation: location,
    zipCode,
    cityState,
    isValid: !!cityState,
  };
}

// US States list for autocomplete
export const US_STATES = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
];

export async function getCitiesByState(stateId: string): Promise<{ city: string; count: number }[]> {
  const upperStateId = stateId.toUpperCase();

  try {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('city')
      .eq('state_id', upperStateId)
      .order('city', { ascending: true });

    if (error || !data) {
      return [];
    }

    const cityMap = new Map<string, number>();
    data.forEach(item => {
      const count = cityMap.get(item.city) || 0;
      cityMap.set(item.city, count + 1);
    });

    return Array.from(cityMap.entries())
      .map(([city, count]) => ({ city, count }))
      .slice(0, 100);
  } catch (error) {
    console.error('Error getting cities by state:', error);
    return [];
  }
}

export async function getZipCodesByCityState(city: string, stateId: string): Promise<ZipCodeData[]> {
  const upperStateId = stateId.toUpperCase();

  try {
    const { data, error } = await supabase
      .from('zip_codes')
      .select('*')
      .eq('state_id', upperStateId)
      .ilike('city', city)
      .order('zip', { ascending: true })
      .limit(50);

    if (error || !data) {
      return [];
    }

    return data.map(item => ({
      zip: item.zip,
      lat: item.lat,
      lng: item.lng,
      city: item.city,
      state_id: item.state_id,
      state_name: item.state_name,
      county_name: item.county_name,
      timezone: item.timezone,
    }));
  } catch (error) {
    console.error('Error getting zip codes by city and state:', error);
    return [];
  }
}

export function suggestDeliveryDate(pickupDate: string, distance: number): string {
  try {
    const date = new Date(pickupDate);
    if (isNaN(date.getTime())) return pickupDate;

    const daysNeeded = Math.ceil(distance / 550);
    date.setDate(date.getDate() + daysNeeded);

    return date.toISOString().split('T')[0];
  } catch {
    return pickupDate;
  }
}
