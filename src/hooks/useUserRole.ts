import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

export function useUserRole() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { organizationId, isLoading: orgLoading } = useOrganization();

  const checkAdminStatus = useCallback(async () => {
    // Wait for organization to be determined
    if (orgLoading) {
      return;
    }

    // If no org, user is not admin
    if (!organizationId) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('is_admin_of_org', { 
        org_id: organizationId 
      });
      if (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data === true);
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, orgLoading]);

  // Run admin check when org changes
  useEffect(() => {
    checkAdminStatus();
  }, [checkAdminStatus]);

  // Stable auth subscription - only subscribe once
  const checkRef = useRef(checkAdminStatus);
  checkRef.current = checkAdminStatus;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Skip silent TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION events
      // that fire on tab refocus — they don't change the user's role and
      // would cause an unnecessary loading flip.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        checkRef.current();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return { isAdmin, isLoading: isLoading || orgLoading };
}