import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // OpenAI-compatible chat completions endpoint. Override AI_GATEWAY_URL / AI_MODEL
    // to use OpenAI, OpenRouter, Together, or any other OpenAI-compatible provider.
    const AI_GATEWAY_URL =
      Deno.env.get("AI_GATEWAY_URL") || "https://api.openai.com/v1/chat/completions";
    const AI_API_KEY = Deno.env.get("AI_API_KEY");
    const AI_MODEL = Deno.env.get("AI_MODEL") || "gpt-4o-mini";
    if (!AI_API_KEY) throw new Error("AI_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages, organizationId } = await req.json();
    if (!organizationId || !messages?.length) {
      return new Response(JSON.stringify({ error: "Missing messages or organizationId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify org membership
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: membership } = await adminClient
      .from("organization_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a member of this organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Admin-only access
    const { data: adminRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .eq("role", "admin")
      .maybeSingle();

    if (!adminRole) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch org data for context
    const [driversRes, loadsRes, transactionsRes] = await Promise.all([
      adminClient
        .from("drivers")
        .select("id, driver_name, truck_number, trailer_number, trailer_type, contract_type, fuel_enabled, assigned_dispatcher_id, driver_phone")
        .eq("organization_id", organizationId)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .limit(200),
      adminClient
        .from("loads")
        .select("id, nr, driver_name, driver_id, load_number, load_amount, driver_pay, status, pick_up_location, delivery_location, pick_up_date, delivery_date, trip_miles, dh_miles, total_miles, rpm, contract_type, invoiced, pay_status, tarp_status, verified, accounting_notes, available_on, trailer_type")
        .eq("organization_id", organizationId)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .or("is_archived.is.null,is_archived.eq.false")
        .order("created_at", { ascending: false })
        .limit(500),
      adminClient
        .from("driver_transactions")
        .select("id, driver_id, transaction_type, category, amount, description, transaction_date")
        .eq("organization_id", organizationId)
        .order("transaction_date", { ascending: false })
        .limit(200),
    ]);

    // Fetch driver statuses
    const { data: driverStatuses } = await adminClient
      .from("driver_statuses")
      .select("driver_id, status, nr")
      .eq("organization_id", organizationId);

    const drivers = driversRes.data || [];
    const loads = loadsRes.data || [];
    const transactions = transactionsRes.data || [];
    const statuses = driverStatuses || [];

    // Build context summary
    const totalRevenue = loads.reduce((s, l) => s + (l.load_amount || 0), 0);
    const totalDriverPay = loads.reduce((s, l) => s + (l.driver_pay || 0), 0);
    const unpaidLoads = loads.filter((l) => l.pay_status === "Unpaid").length;
    const invoicedLoads = loads.filter((l) => l.invoiced === "Invoiced").length;

    const systemPrompt = `You are an AI assistant for a trucking dispatch company. You have access to the organization's live fleet data. Answer questions accurately and concisely using the data provided. Format numbers as currency where appropriate. Use markdown for tables and lists when helpful.

## Organization Data Summary
- Total drivers: ${drivers.length}
- Total active loads: ${loads.length}
- Total revenue: $${totalRevenue.toLocaleString()}
- Total driver pay: $${totalDriverPay.toLocaleString()}
- Profit: $${(totalRevenue - totalDriverPay).toLocaleString()}
- Unpaid loads: ${unpaidLoads}
- Invoiced loads: ${invoicedLoads}

## Drivers (${drivers.length})
${JSON.stringify(drivers.map((d) => ({
  name: d.driver_name,
  truck: d.truck_number,
  trailer: d.trailer_number,
  trailer_type: d.trailer_type,
  contract: d.contract_type,
  fuel: d.fuel_enabled,
  phone: d.driver_phone,
  id: d.id,
})), null, 0)}

## Driver Statuses
${JSON.stringify(statuses.map((s) => ({ driver_id: s.driver_id, status: s.status })), null, 0)}

## Recent Loads (${loads.length})
${JSON.stringify(loads.slice(0, 200).map((l) => ({
  nr: l.nr,
  driver: l.driver_name,
  load_num: l.load_number,
  amount: l.load_amount,
  driver_pay: l.driver_pay,
  status: l.status,
  pickup: l.pick_up_location,
  delivery: l.delivery_location,
  pickup_date: l.pick_up_date,
  delivery_date: l.delivery_date,
  miles: l.total_miles,
  rpm: l.rpm,
  invoiced: l.invoiced,
  pay_status: l.pay_status,
  tarp: l.tarp_status,
  verified: l.verified,
  available_on: l.available_on,
  notes: l.accounting_notes,
})), null, 0)}

## Driver Transactions (${transactions.length})
${JSON.stringify(transactions.slice(0, 100).map((t) => ({
  driver_id: t.driver_id,
  type: t.transaction_type,
  category: t.category,
  amount: t.amount,
  desc: t.description,
  date: t.transaction_date,
})), null, 0)}

When the user asks about driver availability or location, use the driver statuses and the most recent load delivery locations. When asked about financials, use load amounts and driver pay. For settlement questions, reference transactions.
If the data doesn't contain the answer, say so honestly.`;

    const aiResponse = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("dispatch-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
