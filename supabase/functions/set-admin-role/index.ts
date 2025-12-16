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

    // If createUser flag is set, create the admin user first
    if (createUser && email && password) {
      console.log("Creating admin user:", email);
      
      // Check if user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);
      
      if (existingUser) {
        targetUserId = existingUser.id;
        console.log("Admin user already exists:", targetUserId);
      } else {
        // Create the admin user using admin API (bypasses trigger issues)
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName || 'Admin',
            phone_number: phoneNumber || '',
          }
        });

        if (createError) {
          console.error("Error creating admin user:", createError);
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        targetUserId = newUser.user.id;
        console.log("Admin user created:", targetUserId);
      }
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
