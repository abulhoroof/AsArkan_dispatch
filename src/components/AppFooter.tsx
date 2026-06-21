import { APP_VERSION } from "@/config/version";
import { ChangelogDialog } from "./ChangelogDialog";
import { Button } from "./ui/button";

export const AppFooter = () => {
  return (
    <footer className="border-t border-border bg-card/50 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div>
            © {new Date().getFullYear()} AsArkan TMS. All rights reserved.
          </div>
          <ChangelogDialog>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs hover:text-foreground"
            >
              <span>Version</span>
              <span className="font-mono font-medium text-foreground ml-1">
                v{APP_VERSION}
              </span>
            </Button>
          </ChangelogDialog>
        </div>
      </div>
    </footer>
  );
};
