import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useUserRole } from "@/hooks/useUserRole";

export interface ActingAsTarget {
  userId: string;
  email: string;
  name: string;
  role: string;
}

interface ActingAsContextType {
  /** The dispatcher the admin is currently acting as, or null when off. */
  actingAs: ActingAsTarget | null;
  /** True if the current user is an admin (eligible to use Acting As). */
  isAdmin: boolean;
  /** All dispatchers/admins in the org (loaded for admins only). */
  dispatchers: ActingAsTarget[];
  setActingAs: (target: ActingAsTarget | null) => void;
}

const ActingAsContext = createContext<ActingAsContextType>({
  actingAs: null,
  isAdmin: false,
  dispatchers: [],
  setActingAs: () => {},
});

const storageKey = (adminId: string, orgId: string) => `actingAs:${adminId}:${orgId}`;

export function ActingAsProvider({ children }: { children: ReactNode }) {
  const { organizationId } = useOrganization();
  const { isAdmin } = useUserRole();
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [dispatchers, setDispatchers] = useState<ActingAsTarget[]>([]);
  const [actingAs, setActingAsState] = useState<ActingAsTarget | null>(null);
  const hydratedRef = useRef(false);

  // Track admin's own user id (for storage scoping).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!cancelled) setAdminUserId(user?.id ?? null);
    })();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setAdminUserId(null);
        setActingAsState(null);
      } else if (event === 'SIGNED_IN') {
        setAdminUserId(session?.user?.id ?? null);
      }
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  // Load dispatcher roster for admins.
  useEffect(() => {
    if (!isAdmin || !organizationId) {
      setDispatchers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase.rpc as any)('get_all_dispatchers', {
        p_org_id: organizationId,
      });
      if (cancelled) return;
      if (error) {
        console.error("ActingAs: failed to load dispatchers", error);
        return;
      }
      const list: ActingAsTarget[] = (data || []).map((d: any) => ({
        userId: d.id,
        email: d.email,
        name: d.name,
        role: d.role,
      }));
      setDispatchers(list);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, organizationId]);

  // Hydrate from localStorage once we know admin id + org and dispatcher list.
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!isAdmin || !adminUserId || !organizationId) return;
    if (dispatchers.length === 0) return;
    hydratedRef.current = true;
    try {
      const raw = localStorage.getItem(storageKey(adminUserId, organizationId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { userId: string };
      const match = dispatchers.find(d => d.userId === parsed.userId);
      // Don't restore "acting as self" — that's just normal mode.
      if (match && match.userId !== adminUserId) setActingAsState(match);
    } catch {
      // ignore corrupted storage
    }
  }, [isAdmin, adminUserId, organizationId, dispatchers]);

  // Reset when admin status disappears or org changes.
  useEffect(() => {
    if (!isAdmin) setActingAsState(null);
  }, [isAdmin]);
  useEffect(() => {
    hydratedRef.current = false;
    setActingAsState(null);
  }, [organizationId]);

  const setActingAs = useCallback((target: ActingAsTarget | null) => {
    if (!isAdmin || !adminUserId || !organizationId) return;
    // Acting as self is the same as turning it off.
    const next = target && target.userId !== adminUserId ? target : null;
    setActingAsState(next);
    try {
      const key = storageKey(adminUserId, organizationId);
      if (next) localStorage.setItem(key, JSON.stringify({ userId: next.userId }));
      else localStorage.removeItem(key);
    } catch {
      // ignore quota
    }
  }, [isAdmin, adminUserId, organizationId]);

  const value = useMemo(() => ({
    actingAs,
    isAdmin,
    dispatchers,
    setActingAs,
  }), [actingAs, isAdmin, dispatchers, setActingAs]);

  return <ActingAsContext.Provider value={value}>{children}</ActingAsContext.Provider>;
}

export function useActingAs() {
  return useContext(ActingAsContext);
}
