import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export type ViewMode = "auto" | "desktop" | "mobile";

interface ViewModeContextValue {
  /** User preference (what the toggle shows). */
  viewMode: ViewMode;
  /** Resolved layout — what components should actually render. */
  effectiveMode: "desktop" | "mobile";
  isMobile: boolean;
  isDesktop: boolean;
  setViewMode: (mode: ViewMode) => void;
}

const STORAGE_KEY = "asarkan.viewMode";

const ViewModeContext = React.createContext<ViewModeContextValue | undefined>(
  undefined,
);

function readStored(): ViewMode {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "desktop" || v === "mobile" || v === "auto") return v;
  return "auto";
}

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  const autoIsMobile = useIsMobile();
  const [viewMode, setViewModeState] = React.useState<ViewMode>(() => readStored());

  const setViewMode = React.useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, []);

  const effectiveMode: "desktop" | "mobile" =
    viewMode === "auto" ? (autoIsMobile ? "mobile" : "desktop") : viewMode;

  const value: ViewModeContextValue = React.useMemo(
    () => ({
      viewMode,
      effectiveMode,
      isMobile: effectiveMode === "mobile",
      isDesktop: effectiveMode === "desktop",
      setViewMode,
    }),
    [viewMode, effectiveMode, setViewMode],
  );

  return (
    <ViewModeContext.Provider value={value}>{children}</ViewModeContext.Provider>
  );
}

export function useViewMode(): ViewModeContextValue {
  const ctx = React.useContext(ViewModeContext);
  if (!ctx) {
    // Safe fallback: behave like auto-detect, so isolated trees (tests, storybook)
    // still work without the provider.
    const autoIsMobile = useIsMobile();
    return {
      viewMode: "auto",
      effectiveMode: autoIsMobile ? "mobile" : "desktop",
      isMobile: autoIsMobile,
      isDesktop: !autoIsMobile,
      setViewMode: () => {},
    };
  }
  return ctx;
}