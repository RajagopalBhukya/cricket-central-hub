import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, createUser, email, password, fullName, phoneNumber } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let targetUserId = userId;

    // IMPORTANT: Admin login must NEVER create new users.
    // This function is only for role assignment to an already-existing user.
    if (createUser) {
      return new Response(
        JSON.stringify({
          error: "Admin provisioning is disabled from the login flow. Create the admin account separately, then sign in normally."
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if role already exists
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (existingRole?.role === 'admin') {
      console.log("User already has admin role:", targetUserId);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update or insert admin role
    if (existingRole) {
      const { error } = await supabaseAdmin
        .from('user_roles')
        .update({ role: 'admin' })
        .eq('user_id', targetUserId);

      if (error) {
        console.error("Error updating admin role:", error);
        return new Response(
          JSON.stringify({ error: "Failed to set admin role" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      const { error } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: targetUserId, role: 'admin' });

      if (error) {
        console.error("Error inserting admin role:", error);
        return new Response(
          JSON.stringify({ error: "Failed to set admin role" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log("Admin role set for user:", targetUserId);

    return new Response(
      JSON.stringify({ success: true, userId: targetUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
