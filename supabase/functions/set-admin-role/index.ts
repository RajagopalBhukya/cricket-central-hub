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
    const { userId, adminCode, setupAdmin, email, password, fullName, phoneNumber } = await req.json();

    // Validate admin secret code from environment (server-side only)
    const ADMIN_SECRET_CODE = Deno.env.get('ADMIN_SECRET_CODE');
    
    if (!ADMIN_SECRET_CODE) {
      console.error("ADMIN_SECRET_CODE not configured in environment");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin code for new registrations
    if (adminCode) {
      if (adminCode !== ADMIN_SECRET_CODE) {
        console.log("Invalid admin code attempt");
        return new Response(
          JSON.stringify({ error: "Invalid admin code" }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log("Admin code verified successfully");
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    let targetUserId = userId;

    // One-time admin setup - only works for the specific admin email
    if (setupAdmin && email && password) {
      const ALLOWED_ADMIN_EMAIL = "rajagopalbhukya614@gmail.com";
      
      if (email !== ALLOWED_ADMIN_EMAIL) {
        return new Response(
          JSON.stringify({ error: "Unauthorized admin setup attempt" }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log("Setting up admin user:", email);
      
      // Check if admin user already exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);
      
      if (existingUser) {
        targetUserId = existingUser.id;
        console.log("Admin user already exists:", targetUserId);
        
        // Update password if needed
        await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password });
      } else {
        // Handle phone number conflict - delete or update existing profile with same phone
        if (phoneNumber) {
          const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('phone_number', phoneNumber)
            .maybeSingle();
          
          if (existingProfile) {
            console.log("Phone number conflict detected, clearing old profile phone");
            // Update the conflicting profile to have a different phone
            await supabaseAdmin
              .from('profiles')
              .update({ phone_number: `old_${phoneNumber}_${Date.now()}` })
              .eq('id', existingProfile.id);
          }
        }

        // Create the admin user - use admin API to bypass triggers
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

        // Manually create profile (since trigger might have issues)
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .upsert({
            id: targetUserId,
            full_name: fullName || 'Admin',
            phone_number: phoneNumber || '',
          }, { onConflict: 'id' });

        if (profileError) {
          console.error("Error creating admin profile:", profileError);
        }
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
        JSON.stringify({ success: true, userId: targetUserId }),
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
