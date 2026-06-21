import { UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActingAs } from "@/contexts/ActingAsContext";

/**
 * Sticky banner shown at the top of the app when an admin is acting as
 * another dispatcher. All writes (loads, drivers, statuses) created while
 * this banner is visible are attributed to the selected dispatcher.
 */
export function ActingAsBanner() {
  const { actingAs, setActingAs } = useActingAs();
  if (!actingAs) return null;

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-500/15 border-b border-amber-500/40 text-amber-950 dark:text-amber-100">
      <div className="max-w-screen-2xl mx-auto flex items-center justify-between gap-3 px-4 py-1.5 text-xs sm:text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <UserCog className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <span className="font-semibold">Acting as {actingAs.name}</span>
            <span className="hidden sm:inline text-amber-900/80 dark:text-amber-200/80">
              {" "}— new loads, drivers, and status changes will be attributed to this dispatcher.
            </span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs hover:bg-amber-500/25"
          onClick={() => setActingAs(null)}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Exit
        </Button>
      </div>
    </div>
  );
}
