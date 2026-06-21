import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "admin" | "dispatcher";

interface UpdateUserRoleRequest {
  userId: string;
  role: Role;
  organizationId: string; // Required: the org context from the frontend
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    // Validate user session
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError?.message || "No user");
      throw new Error("Your session has expired. Please refresh and log in again.");
    }

    const body: UpdateUserRoleRequest = await req.json();
    if (!body?.userId || !body?.role || !body?.organizationId) {
      throw new Error("Missing required fields: userId, role, organizationId");
    }

    if (body.role !== "admin" && body.role !== "dispatcher") {
      throw new Error("Invalid role");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Use the organization ID passed from the frontend (subdomain context)
    const callerOrgId = body.organizationId;
    console.log("Organization ID from request:", callerOrgId);

    // Verify the caller is a member of this organization
    const { data: callerMembership, error: callerMemberError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", callerOrgId)
      .maybeSingle();

    if (callerMemberError || !callerMembership) {
      console.error("Caller is not a member of the specified organization");
      throw new Error("You are not a member of this organization");
    }

    // Server-side authorization: caller must be admin in THIS org
    const { data: callerAdminRole, error: callerRoleError } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("organization_id", callerOrgId)
      .maybeSingle();

    if (callerRoleError) {
      console.error("Caller role lookup error:", callerRoleError);
      throw new Error("Failed to verify permissions");
    }

    if (!callerAdminRole) {
      throw new Error("Not authorized");
    }

    const targetUserId = body.userId;

    // SECURITY: Verify the target user belongs to the same organization
    const { data: targetOrgMembership, error: targetOrgError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", targetUserId)
      .eq("organization_id", callerOrgId)
      .maybeSingle();

    if (targetOrgError) {
      console.error("Error checking target user organization:", targetOrgError);
      throw new Error("Failed to verify user organization");
    }

    if (!targetOrgMembership) {
      console.error("Target user does not belong to the same organization");
      throw new Error("User does not belong to your organization");
    }

    console.log(`Updating role for user ${targetUserId} to ${body.role} in org ${callerOrgId}`);

    if (body.role === "admin") {
      // Promote: ensure admin role exists for this org
      const { error: insertError } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: targetUserId, role: "admin", organization_id: callerOrgId });

      if (insertError && insertError.code !== "23505") {
        console.error("Insert admin role error:", insertError);
        throw new Error(insertError.message);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Demote: delete admin role for this org
    const { error: deleteError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId)
      .eq("role", "admin")
      .eq("organization_id", callerOrgId);

    if (deleteError) {
      console.error("Delete admin role error:", deleteError);
      throw new Error(deleteError.message);
    }

    // Ensure dispatcher role exists for this org
    const { error: insertDispatcherError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: targetUserId, role: "dispatcher", organization_id: callerOrgId });

    if (insertDispatcherError && insertDispatcherError.code !== "23505") {
      console.error("Insert dispatcher role error:", insertDispatcherError);
      throw new Error(insertDispatcherError.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in update-user-role:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
