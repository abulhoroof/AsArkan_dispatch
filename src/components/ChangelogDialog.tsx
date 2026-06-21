import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { APP_VERSION } from "@/config/version";

interface ChangelogEntry {
  version: string;
  date: string;
  sections: {
    type: "Added" | "Changed" | "Fixed" | "Removed" | "Technical";
    items: string[];
  }[];
}

const changelog: ChangelogEntry[] = [
  {
    version: "0.1.0",
    date: "2026-06-20",
    sections: [
      {
        type: "Added",
        items: ["Initial open-source release"],
      },
    ],
  },
];

const getTypeBadgeVariant = (type: string) => {
  switch (type) {
    case "Added":
      return "default";
    case "Fixed":
      return "destructive";
    case "Changed":
      return "secondary";
    case "Removed":
      return "outline";
    default:
      return "secondary";
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "Added":
      return "text-green-500";
    case "Fixed":
      return "text-red-400";
    case "Changed":
      return "text-blue-400";
    case "Removed":
      return "text-orange-400";
    default:
      return "text-muted-foreground";
  }
};

interface ChangelogDialogProps {
  children: React.ReactNode;
}

export const ChangelogDialog = ({ children }: ChangelogDialogProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Changelog
            <Badge variant="outline" className="font-mono">
              v{APP_VERSION}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {changelog.map((entry) => (
              <div key={entry.version} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-foreground">
                    v{entry.version}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {entry.date}
                  </span>
                  {entry.version === APP_VERSION && (
                    <Badge variant="default" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                <div className="border-l-2 border-border pl-4 space-y-3">
                  {entry.sections.map((section, idx) => (
                    <div key={idx} className="space-y-1">
                      <span
                        className={`text-sm font-medium ${getTypeColor(
                          section.type
                        )}`}
                      >
                        {section.type}
                      </span>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {section.items.map((item, itemIdx) => (
                          <li key={itemIdx} className="flex items-start gap-2">
                            <span className="text-muted-foreground/50">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
