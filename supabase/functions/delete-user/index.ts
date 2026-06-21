import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Create client with user's auth to verify they're an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get the calling user
    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !callingUser) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the calling user is an admin
    const { data: isAdminData, error: isAdminError } = await supabaseClient.rpc('is_admin');
    
    if (isAdminError || !isAdminData) {
      console.error('User is not an admin:', isAdminError);
      return new Response(
        JSON.stringify({ error: 'Only admins can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the caller's organization ID
    const { data: callerOrgData, error: callerOrgError } = await supabaseClient.rpc('get_user_organization_id');
    if (callerOrgError || !callerOrgData) {
      console.error('Could not get caller organization:', callerOrgError);
      return new Response(
        JSON.stringify({ error: 'Could not determine your organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const callerOrgId = callerOrgData;
    console.log('Caller organization ID:', callerOrgId);

    const { userId, email, reassignToUserId } = await req.json();
    
    let targetUserId = userId;
    
    // If email is provided instead of userId, look up the user
    if (!targetUserId && email) {
      const { data: users } = await supabaseAdmin.auth.admin.listUsers();
      const foundUser = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (foundUser) {
        targetUserId = foundUser.id;
      } else {
        console.log(`No auth user found for email ${email}`);
        return new Response(
          JSON.stringify({ error: 'User not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    if (!targetUserId) {
      console.error('No userId or email provided');
      return new Response(
        JSON.stringify({ error: 'userId or email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-deletion
    if (callingUser.id === targetUserId) {
      console.error('User tried to delete themselves');
      return new Response(
        JSON.stringify({ error: 'You cannot delete yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify the target user belongs to the same organization
    const { data: targetOrgMembership, error: targetOrgError } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', targetUserId)
      .eq('organization_id', callerOrgId)
      .maybeSingle();

    if (targetOrgError) {
      console.error('Error checking target user organization:', targetOrgError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify user organization' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetOrgMembership) {
      console.error('Target user does not belong to the same organization');
      return new Response(
        JSON.stringify({ error: 'User does not belong to your organization' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Deleting user ${targetUserId}, reassigning loads to ${reassignToUserId || 'none'}`);
    
    // If reassignToUserId is provided, verify they belong to the same organization and reassign loads
    if (reassignToUserId) {
      // Verify reassign target belongs to same org
      const { data: reassignOrgMembership, error: reassignOrgError } = await supabaseAdmin
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', reassignToUserId)
        .eq('organization_id', callerOrgId)
        .maybeSingle();

      if (reassignOrgError || !reassignOrgMembership) {
        console.error('Reassign target user does not belong to the same organization');
        return new Response(
          JSON.stringify({ error: 'Cannot reassign to a user outside your organization' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Reassigning loads from ${targetUserId} to ${reassignToUserId}`);
      const { error: reassignError } = await supabaseAdmin
        .from('loads')
        .update({ user_id: reassignToUserId })
        .eq('user_id', targetUserId)
        .eq('organization_id', callerOrgId); // Only reassign loads within the org
      
      if (reassignError) {
        console.error('Error reassigning loads:', reassignError);
        return new Response(
          JSON.stringify({ error: 'Failed to reassign loads: ' + reassignError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Delete all loads for this user within the organization
      console.log(`Deleting all loads for user ${targetUserId} in org ${callerOrgId}`);
      const { error: deleteLoadsError } = await supabaseAdmin
        .from('loads')
        .delete()
        .eq('user_id', targetUserId)
        .eq('organization_id', callerOrgId);
      
      if (deleteLoadsError) {
        console.error('Error deleting loads:', deleteLoadsError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete loads: ' + deleteLoadsError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Clear driver_statuses user_id references
    console.log(`Clearing driver_statuses references for user ${targetUserId}`);
    const { error: clearDriverStatusError } = await supabaseAdmin
      .from('driver_statuses')
      .update({ user_id: null })
      .eq('user_id', targetUserId);
    
    if (clearDriverStatusError) {
      console.error('Error clearing driver statuses:', clearDriverStatusError);
    }

    // Delete notifications for the user
    console.log(`Deleting notifications for user ${targetUserId}`);
    const { error: deleteNotifError } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', targetUserId);
    
    if (deleteNotifError) {
      console.error('Error deleting notifications:', deleteNotifError);
    }

    // Delete user roles within this organization only
    console.log(`Deleting roles for user ${targetUserId} in org ${callerOrgId}`);
    const { error: deleteRolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId)
      .eq('organization_id', callerOrgId);
    
    if (deleteRolesError) {
      console.error('Error deleting user roles:', deleteRolesError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete user roles: ' + deleteRolesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Delete organization membership
    console.log(`Deleting organization membership for user ${targetUserId}`);
    const { error: deleteOrgMemberError } = await supabaseAdmin
      .from('organization_members')
      .delete()
      .eq('user_id', targetUserId)
      .eq('organization_id', callerOrgId); // Only delete membership in this org
    
    if (deleteOrgMemberError) {
      console.error('Error deleting org membership:', deleteOrgMemberError);
    }
    

    // Only delete from auth.users if the user has no remaining memberships in other orgs
    const { data: remainingMemberships, error: remainingErr } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', targetUserId)
      .limit(1);

    if (remainingErr) {
      console.error('Error checking remaining memberships:', remainingErr);
    }

    if (!remainingMemberships || remainingMemberships.length === 0) {
      console.log(`Deleting user ${targetUserId} from auth (no remaining org memberships)`);
      const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

      if (deleteUserError) {
        if (deleteUserError.message?.includes('not found') || (deleteUserError as any).code === 'user_not_found') {
          console.log(`User ${targetUserId} already deleted or not found - treating as success`);
        } else {
          console.error('Error deleting user:', deleteUserError);
          return new Response(
            JSON.stringify({ error: 'Failed to delete user: ' + deleteUserError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      console.log(`User ${targetUserId} still has memberships in other orgs; skipping auth deletion`);
    }

    console.log(`Successfully deleted user ${targetUserId}`);
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
