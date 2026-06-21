import React, { useState } from "react";
import { format } from "date-fns";
import { Pencil } from "lucide-react";
import { Badge } from "./ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { cn } from "@/lib/utils";

interface PayStatusBadgeProps {
  status: "Unpaid" | "Paid" | "Overdue";
  paidAt: string | null;
  onTogglePaid: () => void;
  onUpdatePaidAt: (dateTime: string) => void;
  disabled?: boolean;
}

export const PayStatusBadge = ({
  status,
  paidAt,
  onTogglePaid,
  onUpdatePaidAt,
  disabled = false,
}: PayStatusBadgeProps) => {
  const [editOpen, setEditOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    paidAt ? new Date(paidAt) : undefined
  );
  const [selectedTime, setSelectedTime] = useState(
    paidAt ? format(new Date(paidAt), "HH:mm") : format(new Date(), "HH:mm")
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    // Combine date + time
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    onUpdatePaidAt(combined.toISOString());
    setEditOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedTime(e.target.value);
    if (selectedDate) {
      const [hours, minutes] = e.target.value.split(":").map(Number);
      const combined = new Date(selectedDate);
      combined.setHours(hours, minutes, 0, 0);
      onUpdatePaidAt(combined.toISOString());
    }
  };

  const formattedDate = paidAt
    ? format(new Date(paidAt), "MM/dd/yy HH:mm")
    : null;

  if (status === "Paid") {
    return (
      <div className="flex items-center gap-1">
        <Badge
          className={cn(
            "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800 cursor-pointer hover:opacity-80 text-[10px] px-1.5 py-0.5",
            disabled && "cursor-not-allowed opacity-50"
          )}
          onClick={disabled ? undefined : onTogglePaid}
        >
          Paid {formattedDate ? `on ${formattedDate}` : ""}
        </Badge>
        {!disabled && (
          <Popover open={editOpen} onOpenChange={setEditOpen}>
            <PopoverTrigger asChild>
              <button
                className="p-0.5 rounded hover:bg-accent transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDate(paidAt ? new Date(paidAt) : new Date());
                  setSelectedTime(
                    paidAt
                      ? format(new Date(paidAt), "HH:mm")
                      : format(new Date(), "HH:mm")
                  );
                }}
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className={cn("p-3 pointer-events-auto")}
              />
              <div className="px-3 pb-3">
                <label className="text-xs text-muted-foreground">Time</label>
                <input
                  type="time"
                  value={selectedTime}
                  onChange={handleTimeChange}
                  className="w-full mt-1 px-2 py-1 text-sm border rounded bg-background"
                />
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  if (status === "Overdue") {
    return (
      <Badge
        className={cn(
          "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800 cursor-pointer hover:opacity-80 text-[10px] px-1.5 py-0.5",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={disabled ? undefined : onTogglePaid}
      >
        Overdue
      </Badge>
    );
  }

  // Unpaid (default)
  return (
    <Badge
      className={cn(
        "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800 cursor-pointer hover:opacity-80 text-[10px] px-1.5 py-0.5",
        disabled && "cursor-not-allowed opacity-50"
      )}
      onClick={disabled ? undefined : onTogglePaid}
    >
      Unpaid
    </Badge>
  );
};
