# AsArkan Ontology (Cognitive Blueprint)

This document serves as the **Semantic Source of Truth** for the AsArkan Transportation Management System (TMS). It defines the entities, attributes, relationships, and business rules of the domain.

**All AI Agents (Coding, Automation, ETL) must refer to this document to ensure semantic consistency and logical guardrails across the platform.**

---

## 1. Core Classes & Entities

### 1.1 Organization
The root multi-tenant entity. Everything within the TMS is scoped to an Organization.
- **Attributes:** `id`, `name`, `subdomain`

### 1.2 Dispatcher (User)
An internal employee or user operating the TMS on behalf of the Organization.
- **Attributes:** `id`, `role`

### 1.3 Driver
The individual responsible for executing a Load.
- **Attributes:**
  - `driver_id`: Unique identifier.
  - `name`: Full name.
  - `phone`: Contact number.
  - `contractType`: The payment structure (e.g., "LP GOLD", "OWNER OP.", "D.F.O", "TRAINING").
  - `truckNumber`: The ID/Number of the power unit.
  - `trailerNumber`: The ID/Number of the trailer.
  - `currentStatus`: Real-time state of the driver (mapped from Load status).
  - `fuelEnabled`: Boolean indicating if fuel surcharges/cards apply.
  - `currentLocationOverride`: Manual override for calculating deadhead miles.

### 1.4 Load
The atomic unit of work and revenue. A shipment from an origin to a destination.
- **Attributes:**
  - `id` / `LOAD #`: Identifiers.
  - `PICK UP CITY/STATE/ZIP`: Origin location.
  - `DELIVERY CITY/STATE/ZIP`: Destination location.
  - `PICK UP DATE` & `DELIVERY DATE`: Execution timeline.
  - `Status`: The lifecycle state (see *State Machines* below).
  - `LOAD $`: Gross revenue from the customer/broker.
  - `DRIVER PAY`: Payout allocated to the Driver.
  - `TOTAL MILES`: Total distance.
  - `TRIP MILES`: Loaded distance.
  - `DH MILES`: Deadhead distance (empty miles).
  - `RPM`: Rate Per Mile (`LOAD $` / `TOTAL MILES`).
  - `INVOICED`: Billing status ("Missing BOL", "Invoiced", "Not Invoiced").
  - `PAY STATUS`: Settlement status ("Unpaid", "Paid", "Overdue").

---

## 2. Relationships (Graph Schema)

- **Organization $\rightarrow$ Dispatchers:** (1:N) An Organization employs many Dispatchers.
- **Organization $\rightarrow$ Drivers:** (1:N) An Organization manages many Drivers.
- **Dispatcher $\rightarrow$ Drivers:** (1:N) A Dispatcher is assigned multiple Drivers to manage.
- **Driver $\rightarrow$ Loads:** (1:N) A Driver executes multiple Loads over time, but is assigned to **at most one active Load** at any given moment.
- **Driver $\rightarrow$ Truck/Trailer:** (1:1) A Driver operates specific equipment.
- **Load $\rightarrow$ Settlements:** (N:1) Multiple executed Loads are aggregated into a single Settlement statement for driver payout.

---

## 3. Lifecycles & State Machines

### 3.1 Load Status Lifecycle
A Load transitions through the following logical states:
1. **Searching_for_load:** Driver is available, looking for work.
2. **Covered:** Load is booked and assigned to the Driver, but not yet picked up.
3. **In transit:** Driver is actively moving the freight.
4. **Empty_34hr_reset:** Driver is off-duty (HOS reset).
5. **Broke Down:** Exception state; active movement halted.

### 3.2 Invoicing Lifecycle
1. **Not Invoiced:** Default state upon load creation.
2. **Missing BOL:** Delivery completed, but Proof of Delivery / Bill of Lading is pending.
3. **Invoiced:** Documentation submitted to broker/customer for payment.

---

## 4. Constraints & Business Logic

- **Tenant Isolation:** ALL database queries and logic MUST filter by `organization_id` (via RLS or explicit application logic).
- **Deadhead (DH) Miles Calculation:**
  - Logic MUST prioritize the Driver's `currentLocationOverride` if it is set.
  - If no override exists, fallback to the `lastDeliveryLocation` of the Driver's most recently completed Load.
- **Driver State Synchronization:** A Driver's `currentStatus` is implicitly derived from their currently active `Load`.
- **Driver Pay Independence:** `DRIVER PAY` is often calculated autonomously based on the Driver's `contractType` percentage, but CAN be flagged as `DRIVER PAY MANUALLY EDITED` if an admin overrides the calculation.

---

## 5. How to Use This Ontology

### For Human Developers
- **Vibe Coding & Prompts:** When writing prompts for an LLM (e.g., "Build a new load assignment screen"), you do not need to explain what a Load or a Driver is. The agent already knows the rules from this document. 
- **Updating:** Treat this document as the "source code" of the business. When adding new modules (e.g., Accounting, Facilities), update this markdown file first. The build step will automatically generate the JSON schema.

### For Local AI Coding Assistants (Claude Code, Cursor, Copilot)
- The system instructions (e.g., `CLAUDE.md`) explicitly point agents to read this `ontology.md` file.
- Before proposing any architectural changes, generating new TypeScript interfaces, or creating Supabase migrations, agents refer to these classes and constraints to ensure semantic consistency.

### For Backend Automation Agents (ELT, Edge Functions)
- Do not parse this markdown directly.
- Instead, read the `ontology.json` payload generated at `.claude/ontology.json`. 
- This JSON schema provides a machine-queryable format of the entities and constraints listed above, enabling automated agents to perform programmatic data validation, schema mapping, and entity resolution.
