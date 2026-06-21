import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface SubdomainInfo {
  subdomain: string | null;
  organization: Organization | null;
  isOrgSpecificDomain: boolean;
  isLoading: boolean;
}

// Cache the subdomain detection result to prevent re-fetching on tab switch
let cachedResult: { subdomain: string | null; organization: Organization | null } | null = null;

export function clearSubdomainCache() {
  cachedResult = null;
}

export function useSubdomain(): SubdomainInfo {
  const [subdomain, setSubdomain] = useState<string | null>(cachedResult?.subdomain ?? null);
  const [organization, setOrganization] = useState<Organization | null>(cachedResult?.organization ?? null);
  const [isLoading, setIsLoading] = useState(!cachedResult);
  const hasRun = useRef(false);

  useEffect(() => {
    // If we already have cached data, don't re-run detection
    if (cachedResult || hasRun.current) {
      return;
    }
    hasRun.current = true;

    const detectSubdomain = async () => {
      const hostname = window.location.hostname;

      // Extract subdomain from hostname
      // e.g., "acme.example.com" → "acme"
      // e.g., "localhost"        → null
      const parts = hostname.split('.');

      // Skip detection for localhost or IP addresses
      if (hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        cachedResult = { subdomain: null, organization: null };
        setIsLoading(false);
        return;
      }

      // For domain like "acme.example.com", parts = ["acme", "example", "com"]
      // The subdomain is the first part if we have at least 3 parts
      if (parts.length >= 3) {
        const extractedSubdomain = parts[0];
        setSubdomain(extractedSubdomain);

        // Query organization by slug (including "app" if it exists)
        const { data, error } = await supabase
          .rpc('get_organization_by_slug', { p_slug: extractedSubdomain })
          .maybeSingle();

        if (!error && data) {
          setOrganization(data);
          cachedResult = { subdomain: extractedSubdomain, organization: data };
        } else {
          cachedResult = { subdomain: extractedSubdomain, organization: null };
        }
        // If no org found for the subdomain (including "app"), 
        // organization stays null and isOrgSpecificDomain will be false
      } else {
        cachedResult = { subdomain: null, organization: null };
      }

      setIsLoading(false);
    };

    detectSubdomain();
  }, []);

  return {
    subdomain,
    organization,
    isOrgSpecificDomain: organization !== null,
    isLoading,
  };
}
