import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useOrganizationContext } from "@/contexts/OrganizationContext";
import { AccessDenied } from "@/components/AccessDenied";
import { clearAllDrafts } from "@/hooks/useDraftPersistence";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { isLoading: orgLoading, accessDenied, accessDeniedReason } = useOrganizationContext();
  // Once we've successfully rendered children at least once, never show the
  // full-screen spinner again for transient org re-validations. This protects
  // open forms, scroll position, and filter state from being unmounted on
  // background events (e.g. TOKEN_REFRESHED on tab refocus).
  const hasRenderedOnce = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
      if (event === 'SIGNED_OUT') {
        clearAllDrafts();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Show loading only on the very first auth/org check.
  const stillBooting =
    isAuthenticated === null || (isAuthenticated && orgLoading && !hasRenderedOnce.current);

  if (stillBooting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check organization access after authentication
  if (accessDenied) {
    return <AccessDenied reason={accessDeniedReason} />;
  }

  hasRenderedOnce.current = true;
  return <>{children}</>;
}
