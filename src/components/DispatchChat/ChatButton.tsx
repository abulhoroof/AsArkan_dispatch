import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatPanel } from "./ChatPanel";
import { useUserRole } from "@/hooks/useUserRole";

export function ChatButton() {
  const [open, setOpen] = useState(false);
  const { isAdmin, isLoading } = useUserRole();

  if (isLoading || !isAdmin) return null;

  return (
    <>
      <ChatPanel open={open} onClose={() => setOpen(false)} />
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="icon"
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>
      )}
    </>
  );
}
