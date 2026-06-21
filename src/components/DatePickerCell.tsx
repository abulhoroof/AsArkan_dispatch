import { useState, useRef, useEffect } from "react";
import { Calendar as CalendarIcon, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { parseDate, formatDateForDB, formatDateForDisplay } from "@/utils/date";

interface DatePickerCellProps {
  value: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  disabledMessage?: string;
  variant?: "pickup" | "delivery" | "default";
  hasWarning?: boolean;
  warningMessage?: string;
  isOutOfRange?: boolean;
  minDate?: Date;
}

export function DatePickerCell({ value, onSave, disabled = false, disabledMessage, variant = "default", hasWarning = false, warningMessage, isOutOfRange = false, minDate }: DatePickerCellProps) {
  // Use strict parsing to ensure valid Date or undefined
  const [date, setDate] = useState<Date | undefined>(() => parseDate(value));
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Sync internal state when value prop changes to prevent stale date highlighting
  useEffect(() => {
    setDate(parseDate(value));
  }, [value]);

  const handleSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      onSave(formatDateForDB(newDate));
      setOpen(false);
      
      // Show success animation
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 800);
    } else {
      onSave("");
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "pickup":
        return "bg-blue-50 text-blue-900 dark:bg-blue-950/30 dark:text-blue-100 hover:bg-blue-100 hover:text-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-100";
      case "delivery":
        return "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100 hover:bg-emerald-100 hover:text-emerald-900 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-100";
      default:
        return "";
    }
  };

  const buttonContent = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={buttonRef}
          variant="ghost"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal px-2 h-8 transition-all duration-200",
            !date && "text-muted-foreground",
            disabled ? "cursor-not-allowed opacity-50" : "hover:bg-muted/50",
            !disabled && variant !== "default" && !hasWarning && !isOutOfRange && getVariantStyles(),
            showSuccess && !hasWarning && "ring-2 ring-success/50 bg-success/10",
            hasWarning &&
              "ring-2 ring-warning-ring bg-warning-bg dark:bg-warning-bg-dark text-warning-text font-medium",
            isOutOfRange && "ring-2 ring-blue-300 dark:ring-blue-600 bg-blue-100 dark:bg-blue-900/40"
          )}
          title={disabled ? "Archived - restore to edit" : undefined}
        >
          {hasWarning ? (
            <AlertTriangle className="mr-2 h-4 w-4 text-red-500" />
          ) : showSuccess ? (
            <Check className="mr-2 h-4 w-4 text-success animate-scale-in" />
          ) : (
            <CalendarIcon className="mr-2 h-4 w-4" />
          )}
          {date ? formatDateForDisplay(date) : value || (disabled && disabledMessage ? disabledMessage : "Pick a date")}
        </Button>
      </PopoverTrigger>
      {!disabled && (
        <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            disabled={minDate ? (calendarDate) => calendarDate < minDate : undefined}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      )}
    </Popover>
  );

  return buttonContent;
}
