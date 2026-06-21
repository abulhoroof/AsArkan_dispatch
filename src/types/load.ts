export interface Load {
  id?: string; // Database ID for reliable updates
  user_id?: string; // Owner dispatcher's user ID
  NR: number; // Hidden from UI, used internally
  driver_id: string;
  "DRIVER NAME": string;
  "DRIVER PHONE": string;
  "CONTRACT TYPE": "LP GOLD" | "LP PLATINUM" | "LP STANDARD" | "CD GOLD" | "CD PLATINUM" | "OWNER OP." | "D.F.O" | "TRAINING" | "CD C.P.M." | "RENT" | "LP G.NEW" | "LP P.NEW";
  "TRUCK #": number;
  "Trailer number": string;
  "TRAILER TYPE": "Flat Bed" | "Drop Deck" | "Double Drop" | null;
  "PICK UP CITY/STATE/ZIP": string;
  Status: "In transit" | "Covered" | "Broke Down" | "Empty_34hr_reset" | "Searching_for_load";
  "DELIVERY CITY/STATE/ZIP": string;
  "PICK UP DATE": string;
  "DELIVERY DATE": string;
  "LOAD #": string;
  "LOAD  $": number | null;
  "DRIVER PAY ": number | null;
  "DRIVER PAY MANUALLY EDITED": boolean;
  "TOTAL MILES": number;
  "TRIP MILES": number | null;
  "DH MILES": number | null;
  RPM: number | null;
  VERIFIED: boolean;
  "TARP STATUS": "Tarped" | "Untarped";
  INVOICED: "Missing BOL" | "Invoiced" | "Not Invoiced";
  "ACCOUNTING NOTES": string | null;
  "ZIP CODE": string | null;
  "AVAILABLE ON": string | null;
  "EXTRA STOPS": number;
  "PAY STATUS": "Unpaid" | "Paid" | "Overdue";
  "PAID AT": string | null;
  "ADMIN ACCOUNTING NOTES": string | null;
  isArchived?: boolean;
}
