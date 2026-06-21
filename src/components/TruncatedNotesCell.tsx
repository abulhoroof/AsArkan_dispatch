import { useState, useRef, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { validateInput, textFieldSchema } from "@/utils/validation";
import { toast } from "@/hooks/use-toast";

interface TruncatedNotesCellProps {
  value: string | null;
  onSave: (value: string) => void;
  disabled?: boolean;
}

export const TruncatedNotesCell = ({ value, onSave, disabled = false }: TruncatedNotesCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  const words = (value || "").split(/\s+/).filter(Boolean);
  const needsTruncation = words.length > 6;

  const handleSave = () => {
    const validationResult = validateInput(textFieldSchema, editValue);
    if (!validationResult.success) {
      toast({
        title: "Invalid Input",
        description: validationResult.error,
        variant: "destructive",
      });
      return;
    }
    onSave(validationResult.data);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value || "");
      setIsEditing(false);
    }
  };

  const startEdit = useCallback(() => {
    if (disabled) return;
    setEditValue(value || "");
    setIsEditing(true);
  }, [disabled, value]);

  const handleClick = () => {
    if (disabled || isLongPress.current) return;
    if (needsTruncation) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    startEdit();
  };

  // Long-press for mobile
  const handleTouchStart = () => {
    if (disabled) return;
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      startEdit();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  if (isEditing) {
    return (
      <Textarea
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="min-h-[60px] px-2 py-1 text-sm w-full resize-none"
        autoFocus
      />
    );
  }

  return (
    <div className="w-full min-w-0">
      <div
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchMove={handleTouchMove}
        className={`px-2 py-1 rounded transition-colors text-sm ${
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/50"
        }`}
        style={{
          wordWrap: "break-word",
          overflowWrap: "break-word",
          whiteSpace: isExpanded ? "normal" : "nowrap",
          overflow: isExpanded ? "visible" : "hidden",
          textOverflow: isExpanded ? "clip" : "ellipsis",
          maxWidth: "100%",
        }}
        title={disabled ? "Archived - restore to edit" : "Double-click or long-press to edit"}
      >
        {value || "-"}
      </div>
    </div>
  );
};
