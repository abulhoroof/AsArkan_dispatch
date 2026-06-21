import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ReassignmentEmailRequest {
  driverName: string;
  newDispatcherId: string;
  oldDispatcherId: string | null;
  newDispatcherName: string;
  oldDispatcherName: string | null;
  organizationId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's auth token for verification
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the caller's session
    const { data: { user: caller }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !caller) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.log("Caller authenticated:", caller.id);

    // Admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { driverName, newDispatcherId, oldDispatcherId, newDispatcherName, oldDispatcherName, organizationId }: ReassignmentEmailRequest = await req.json();

    if (!organizationId) {
      return new Response(JSON.stringify({ error: "Organization ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verify caller is a member of the specified organization
    const { data: callerOrgData, error: callerOrgError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", caller.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (callerOrgError || !callerOrgData) {
      console.error("Caller not in specified org:", callerOrgError);
      return new Response(JSON.stringify({ error: "You are not a member of this organization" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const callerOrgId = organizationId;

    // Verify caller is an admin of the organization
    const { data: callerRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("organization_id", callerOrgId)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !callerRole) {
      console.error("Caller is not an admin:", roleError);
      return new Response(JSON.stringify({ error: "Only admins can send reassignment emails" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    console.log("Caller organization:", callerOrgId);

    console.log("Sending reassignment emails for driver:", driverName);

    // Verify new dispatcher belongs to same organization
    const { data: newDispatcherOrg, error: newDispatcherOrgError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", newDispatcherId)
      .eq("organization_id", callerOrgId)
      .maybeSingle();

    if (newDispatcherOrgError || !newDispatcherOrg) {
      console.error("New dispatcher not in caller's org:", newDispatcherOrgError);
      return new Response(JSON.stringify({ error: "New dispatcher not in your organization" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Check if old dispatcher belongs to same organization (if provided)
    // If not found, we'll simply skip sending email to old dispatcher rather than failing
    let oldDispatcherValid = false;
    if (oldDispatcherId) {
      const { data: oldDispatcherOrg, error: oldDispatcherOrgError } = await supabaseAdmin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", oldDispatcherId)
        .eq("organization_id", callerOrgId)
        .maybeSingle();

      if (oldDispatcherOrgError || !oldDispatcherOrg) {
        console.log("Old dispatcher not in org (may have left), skipping their email:", oldDispatcherId);
      } else {
        oldDispatcherValid = true;
      }
    }

    // Fetch organization name for email branding
    const { data: orgDetails } = await supabaseAdmin
      .from("organizations")
      .select("name")
      .eq("id", callerOrgId)
      .single();
    const organizationName = orgDetails?.name || "Dispatch System";

    // Get dispatcher emails from auth.users
    const emails: Promise<any>[] = [];

    // Get new dispatcher email
    const { data: newDispatcher, error: newError } = await supabaseAdmin.auth.admin.getUserById(newDispatcherId);
    if (newError) {
      console.error("Error fetching new dispatcher:", newError);
    }

    // Send email to new dispatcher (destination)
    if (newDispatcher?.user?.email) {
      console.log("Sending email to new dispatcher:", newDispatcher.user.email);
      emails.push(
        resend.emails.send({
          from: `${organizationName} <${Deno.env.get("EMAIL_FROM") || "noreply@example.com"}>`,
          to: [newDispatcher.user.email],
          subject: `Driver Assigned: ${driverName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Driver Assigned to You</h2>
              <p>Hello ${newDispatcherName},</p>
              <p><strong>${driverName}</strong> has been assigned to you${oldDispatcherName ? ` from ${oldDispatcherName}` : ''}.</p>
              <p>Please log in to your dispatch dashboard to view and manage this driver.</p>
              <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #6b7280; font-size: 12px;">This is an automated notification from ${organizationName}.</p>
            </div>
          `,
        })
      );
    }

    // Send email to old dispatcher (source) if exists AND is still in org
    if (oldDispatcherId && oldDispatcherValid) {
      const { data: oldDispatcher, error: oldError } = await supabaseAdmin.auth.admin.getUserById(oldDispatcherId);
      if (oldError) {
        console.error("Error fetching old dispatcher:", oldError);
      }

      if (oldDispatcher?.user?.email) {
        console.log("Sending email to old dispatcher:", oldDispatcher.user.email);
        emails.push(
          resend.emails.send({
            from: `${organizationName} <${Deno.env.get("EMAIL_FROM") || "noreply@example.com"}>`,
            to: [oldDispatcher.user.email],
            subject: `Driver Reassigned: ${driverName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #f59e0b;">Driver Reassigned</h2>
                <p>Hello ${oldDispatcherName || 'Dispatcher'},</p>
                <p><strong>${driverName}</strong> has been reassigned to ${newDispatcherName}.</p>
                <p>This driver is no longer assigned to you.</p>
                <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
                <p style="color: #6b7280; font-size: 12px;">This is an automated notification from ${organizationName}.</p>
              </div>
            `,
          })
        );
      }
    }

    const results = await Promise.allSettled(emails);
    console.log("Email results:", results);

    return new Response(JSON.stringify({ success: true, emailsSent: emails.length }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-reassignment-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
