import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the calling user's JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to check permissions
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify calling user is admin
    const { data: isAdminData, error: adminError } = await supabaseUser.rpc("is_admin");
    if (adminError || !isAdminData) {
      console.error("Admin check failed:", adminError);
      return new Response(JSON.stringify({ error: "Only admins can invite users" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get admin's organization
    const { data: orgData, error: orgError } = await supabaseUser.rpc("get_user_organization_id");
    if (orgError || !orgData) {
      console.error("Org lookup failed:", orgError);
      return new Response(JSON.stringify({ error: "Could not determine organization" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const organizationId = orgData;

    // Fetch organization name for personalized emails
    const { data: orgDetails, error: orgDetailsError } = await supabaseAdmin
      .from("organizations")
      .select("name, slug")
      .eq("id", organizationId)
      .single();
    
    if (orgDetailsError) {
      console.error("Error fetching org details:", orgDetailsError);
    }
    const organizationName = orgDetails?.name || "AsArkan TMS";
    console.log(`Organization: ${organizationName} (${organizationId})`);

    // Parse request body
    const { email, name, role, appUrl } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRole = role === "admin" ? "admin" : "dispatcher";
    console.log(`Inviting user: ${email} with role: ${userRole} to org: ${organizationId}`);

    // Check if user already exists
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(JSON.stringify({ error: "Failed to check existing users" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingUser = existingUsers.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;
    let isReturningUser = false;

    if (existingUser) {
      // User exists in auth.users
      userId = existingUser.id;

      // Check if already in THIS specific organization (multi-org support)
      const { data: memberData } = await supabaseAdmin
        .from("organization_members")
        .select("id")
        .eq("user_id", userId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (memberData) {
        return new Response(JSON.stringify({ error: "Unable to send invitation. Please verify the email and try again." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // User exists but not in this org - this is now allowed (multi-org)
      isReturningUser = true;
      console.log(`Existing user detected, adding to new org: ${email}`);
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: name || email.split("@")[0] },
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userId = newUser.user.id;
      console.log(`New user created: ${userId}`);
    }

    // Add to organization_members
    const { error: memberError } = await supabaseAdmin
      .from("organization_members")
      .insert({ user_id: userId, organization_id: organizationId });

    if (memberError) {
      console.error("Error adding to organization:", memberError);
      return new Response(JSON.stringify({ error: "Failed to add user to organization" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Set user role for THIS organization - always insert since roles are per-org now
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: userRole, organization_id: organizationId });

    if (roleError) {
      console.error("Error setting role:", roleError);
      return new Response(JSON.stringify({ error: "Failed to set user role" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate invite/reset link - validate appUrl against allowed hosts.
    // Configure via ALLOWED_REDIRECT_HOSTS (comma-separated) and APP_URL secrets.
    const defaultAppUrl = Deno.env.get("APP_URL") || "http://localhost:8080";
    const allowedHosts = (Deno.env.get("ALLOWED_REDIRECT_HOSTS") || "localhost")
      .split(",")
      .map(h => h.trim())
      .filter(Boolean);
    let safeAppUrl = appUrl || defaultAppUrl;
    try {
      const parsed = new URL(safeAppUrl);
      const isAllowed = allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h));
      if (!isAllowed) {
        safeAppUrl = defaultAppUrl;
      }
    } catch {
      safeAppUrl = defaultAppUrl;
    }
    console.log(`Using redirect URL: ${safeAppUrl}/set-password`);
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${safeAppUrl}/set-password` },
    });

    if (linkError) {
      console.error("Error generating link:", linkError);
      return new Response(JSON.stringify({ error: "Failed to generate invite link" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build the proper invite URL
    const actionLink = linkData.properties?.action_link;
    console.log(`Invite link generated for ${email}`);

    // Send invite email via Resend
    let emailSent = false;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey && actionLink) {
      try {
        const resend = new Resend(resendApiKey);
        const displayName = name || email.split("@")[0];
        const roleLabel = userRole === "admin" ? "Administrator" : "Dispatcher";
        
        const { error: emailError } = await resend.emails.send({
          from: `${organizationName} <${Deno.env.get("EMAIL_FROM") || "noreply@example.com"}>`,
          to: [email],
          subject: isReturningUser 
            ? `Welcome to ${organizationName}` 
            : `You've been invited to ${organizationName}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #1a1a2e;">Welcome${isReturningUser ? "" : ""}, ${displayName}!</h1>
              <p>You've been invited to join ${organizationName} as a <strong>${roleLabel}</strong>.</p>
              <p>Click the button below to ${isReturningUser ? "access" : "set your password and access"} your account:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${actionLink}" 
                   style="background-color: #3b82f6; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                  ${isReturningUser ? "Access Your Account" : "Set Your Password"}
                </a>
              </div>
              <p style="color: #666; font-size: 14px;">
                This link expires in 24 hours. If it expires, use "Forgot password" on the login page.
              </p>
              <p style="color: #666; font-size: 14px;">
                If you didn't expect this invitation, you can safely ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              <p style="color: #999; font-size: 12px;">${organizationName}</p>
            </div>
          `,
        });

        if (emailError) {
          console.error("Error sending email:", emailError);
        } else {
          emailSent = true;
          console.log(`Invite email sent to ${email}`);
        }
      } catch (emailErr) {
        console.error("Resend error:", emailErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inviteLink: actionLink,
        emailSent,
        isReturningUser,
        message: emailSent
          ? `Invitation email sent to ${email}`
          : isReturningUser
            ? `${email} has been added to ${organizationName} (copy the link to share)`
            : `Invitation created for ${email} (copy the link to share)`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
