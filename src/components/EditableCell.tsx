import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { validateInput, milesSchema, textFieldSchema, filterCurrencyInput, filterIntegerInput } from "@/utils/validation";
import { toast } from "@/hooks/use-toast";

interface EditableCellProps {
  value: string | number | boolean | null;
  onSave: (value: string | number | boolean) => void;
  type?: "text" | "number" | "boolean" | "currency";
  className?: string;
  disabled?: boolean;
}

export const EditableCell = ({ value, onSave, type = "text", className = "", disabled = false }: EditableCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  // For currency type, show the raw number value for editing
  const getInitialEditValue = () => {
    if (type === "currency" && typeof value === "number") {
      return value.toString();
    }
    return value?.toString() || "";
  };
  const [editValue, setEditValue] = useState(getInitialEditValue());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress = useRef(false);

  // Sync editValue when value prop changes (from external updates)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(getInitialEditValue());
    }
  }, [value, isEditing]);

  const startEdit = useCallback(() => {
    if (disabled) return;
    setEditValue(getInitialEditValue());
    setIsEditing(true);
  }, [disabled, value]);

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

  // Format number as currency for display (with $ and commas)
  const formatCurrencyDisplay = (val: number | null): string => {
    if (val === null || val === undefined) return "-";
    return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleSave = () => {
    let validationResult;
    
    if (type === "number") {
      const numValue = parseFloat(editValue) || 0;
      validationResult = validateInput(milesSchema, numValue);
      if (!validationResult.success) {
        toast({
          title: "Invalid Input",
          description: validationResult.error,
          variant: "destructive",
        });
        return;
      }
      onSave(validationResult.data);
    } else if (type === "boolean") {
      onSave(editValue === "true");
    } else if (type === "currency") {
      // Parse the input string to a number
      const numericValue = editValue.replace(/[^0-9.]/g, "");
      const numValue = parseFloat(numericValue);
      if (isNaN(numValue) || numValue < 0) {
        toast({
          title: "Invalid Input",
          description: "Please enter a valid positive number",
          variant: "destructive",
        });
        return;
      }
      // Save as pure number
      onSave(numValue);
    } else {
      // For text fields, use appropriate schema based on context
      validationResult = validateInput(textFieldSchema, editValue);
      if (!validationResult.success) {
        toast({
          title: "Invalid Input",
          description: validationResult.error,
          variant: "destructive",
        });
        return;
      }
      onSave(validationResult.data);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(getInitialEditValue());
      setIsEditing(false);
    }
  };

  if (type === "boolean") {
    return (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={value as boolean}
          onCheckedChange={(checked) => onSave(checked as boolean)}
          disabled={disabled}
        />
      </div>
    );
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    
    // Apply real-time filtering based on type
    if (type === "currency") {
      newValue = filterCurrencyInput(newValue);
    } else if (type === "number") {
      newValue = filterIntegerInput(newValue);
    }
    
    setEditValue(newValue);
  };

  const getInputMode = (): "text" | "decimal" | "numeric" | "tel" => {
    if (type === "currency") return "decimal";
    if (type === "number") return "numeric";
    return "text";
  };

  if (isEditing) {
    return (
      <Input
        value={editValue}
        onChange={handleChange}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className="h-8 px-2 text-sm"
        autoFocus
        inputMode={getInputMode()}
        placeholder={type === "currency" ? "0.00" : type === "number" ? "0" : ""}
      />
    );
  }

  // For currency type, format the number with $ and commas
  const displayValue = type === "currency" 
    ? formatCurrencyDisplay(value as number | null)
    : value?.toString() || "-";

  return (
    <div
      onClick={() => {
        if (disabled || isLongPress.current) return;
        setIsEditing(true);
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={`px-1 py-0.5 rounded transition-colors min-h-[32px] flex items-center ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/50 active:bg-muted'} ${className}`}
      title={disabled ? "Archived - restore to edit" : "Double-click or long-press to edit"}
    >
      {displayValue}
    </div>
  );
};
