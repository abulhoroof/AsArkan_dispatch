import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubdomain } from "@/hooks/useSubdomain";

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationContextType {
  organization: Organization | null;
  isLoading: boolean;
  accessDenied: boolean;
  accessDeniedReason: string | null;
}

const OrganizationContext = createContext<OrganizationContextType>({
  organization: null,
  isLoading: true,
  accessDenied: false,
  accessDeniedReason: null,
});

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { subdomain, organization: subdomainOrg, isOrgSpecificDomain, isLoading: subdomainLoading } = useSubdomain();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [accessDeniedReason, setAccessDeniedReason] = useState<string | null>(null);

  useEffect(() => {
    const validateAccess = async () => {
      if (subdomainLoading) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setIsLoading(false);
          return;
        }

        // If we're on an org-specific subdomain, check membership for that specific org
        if (isOrgSpecificDomain && subdomainOrg) {
          const { data: memberData, error: memberError } = await supabase
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', user.id)
            .eq('organization_id', subdomainOrg.id)
            .maybeSingle();

          if (memberError) {
            console.error("Error checking organization membership:", memberError);
            setIsLoading(false);
            return;
          }

          if (!memberData) {
            // User is not a member of the subdomain's org
            setAccessDenied(true);
            setAccessDeniedReason(
              `You don't have access to ${subdomainOrg.name}. ` +
              `Please contact your administrator to get access.`
            );
            setOrganization(null);
          } else {
            // User belongs to the subdomain's org - grant access
            setOrganization(subdomainOrg);
            setAccessDenied(false);
            setAccessDeniedReason(null);
          }
        } else if (subdomain && !subdomainOrg) {
          // Subdomain detected but no matching organization found
          // e.g. "app.example.com" where there is no "app" org
          setAccessDenied(true);
          setAccessDeniedReason(
            `Organization "${subdomain}" not found. ` +
            `Please check the URL or contact your administrator.`
          );
          setOrganization(null);
        } else {
          // No subdomain enforcement (localhost, direct domain, etc.)
          // Get user's first org membership
          const { data: memberData, error: memberError } = await supabase
            .from('organization_members')
            .select('organization_id, organizations(id, name, slug)')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

          if (memberError) {
            console.error("Error fetching organization membership:", memberError);
            setIsLoading(false);
            return;
          }

          const userOrg = memberData?.organizations as Organization | null;
          setOrganization(userOrg);
          setAccessDenied(false);
          setAccessDeniedReason(null);
        }
      } catch (error) {
        console.error("Error validating organization access:", error);
      } finally {
        setIsLoading(false);
      }
    };

    validateAccess();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Only re-validate on real sign-in/sign-out. Ignore TOKEN_REFRESHED,
      // USER_UPDATED, INITIAL_SESSION — those fire on tab refocus and would
      // otherwise unmount the entire authenticated subtree (wiping forms,
      // scroll position, filters).
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setIsLoading(true);
        validateAccess();
      }
    });

    return () => subscription.unsubscribe();
  }, [subdomainLoading, isOrgSpecificDomain, subdomainOrg]);

  return (
    <OrganizationContext.Provider value={{ organization, isLoading, accessDenied, accessDeniedReason }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganizationContext() {
  return useContext(OrganizationContext);
}
