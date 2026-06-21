import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResetPasswordRequest {
  userId: string;
  action: "send_email" | "set_password";
  newPassword?: string;
  redirectUrl?: string;
  organizationId: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with anon key to verify the caller's session
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    
    // Create admin client with service role key for password operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user's session
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      console.error("Invalid token or user not found:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid token or user not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id, user.email);

    // Parse the request body
    const { userId, action, newPassword, redirectUrl, organizationId }: ResetPasswordRequest = await req.json();

    if (!userId || !action || !organizationId) {
      return new Response(
        JSON.stringify({ error: "userId, action, and organizationId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is a member of the specified organization
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (membershipError || !membership) {
      console.error("Caller is not a member of specified organization:", membershipError);
      return new Response(
        JSON.stringify({ error: "You are not a member of this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller has admin role in this specific organization
    const { data: adminRoleInOrg, error: adminOrgError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .eq("role", "admin")
      .maybeSingle();

    if (adminOrgError || !adminRoleInOrg) {
      console.error("Caller is not admin of specified organization:", adminOrgError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Admin role required in this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Admin role verified for user:", user.email, "in org:", organizationId);

    // SECURITY: Verify the target user belongs to the same organization
    const { data: targetOrgMembership, error: targetOrgError } = await supabaseAdmin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (targetOrgError) {
      console.error("Error checking target user organization:", targetOrgError);
      return new Response(
        JSON.stringify({ error: "Failed to verify user organization" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!targetOrgMembership) {
      console.error("Target user does not belong to the same organization");
      return new Response(
        JSON.stringify({ error: "User does not belong to your organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${action} for user: ${userId}`);

    if (action === "set_password") {
      // Validate password
      if (!newPassword || newPassword.length < 6) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 6 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Set password directly using admin API
      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (error) {
        console.error("Error setting password:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Password updated successfully for user:", userId);
      return new Response(
        JSON.stringify({ success: true, message: "Password updated successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "send_email") {
      // Get user's email first
      const { data: targetUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(userId);

      if (getUserError || !targetUser.user) {
        console.error("Error getting target user:", getUserError);
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userEmail = targetUser.user.email;
      if (!userEmail) {
        return new Response(
          JSON.stringify({ error: "User has no email address" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate password reset link
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: userEmail,
        options: {
          redirectTo: redirectUrl || `${supabaseUrl.replace('.supabase.co', '')}/set-password`,
        },
      });

      if (error) {
        console.error("Error generating reset link:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resetLink = data.properties?.action_link;
      console.log("Password reset link generated for:", userEmail);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Password reset link generated",
          email: userEmail,
          resetLink: resetLink
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'send_email' or 'set_password'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Error in reset-user-password function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});