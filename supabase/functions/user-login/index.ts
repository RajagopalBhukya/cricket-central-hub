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
    const { email, phone, username } = await req.json();
    console.log("User login attempt:", { email, phone, username });

    if (!email || !phone) {
      return new Response(
        JSON.stringify({ error: "Email and phone number are required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Block admin credentials
    const ADMIN_EMAIL = "rajagopalbhukya614@gmail.com";
    if (email === ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: "Please use admin login with password" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if user exists with this email
    const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("Error listing users:", listError);
      return new Response(
        JSON.stringify({ error: "Failed to check existing users" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingUser = existingUsers.users.find(u => u.email === email);
    
    let userId: string;
    let isNewUser = false;
    let tempPassword: string;

    if (existingUser) {
      // User exists with this email
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('phone_number, full_name')
        .eq('id', existingUser.id)
        .single();

      if (profile && profile.phone_number !== phone) {
        // Phone doesn't match - check if same name but different phone
        // This means different person or user changed phone - reject
        return new Response(
          JSON.stringify({ error: "Phone number does not match the registered account. If you changed your number, please contact support." }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check user role - block admin passwordless login
      const { data: roleData } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', existingUser.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (roleData) {
        return new Response(
          JSON.stringify({ error: "Admins must use password login" }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = existingUser.id;
      
      // Update username if provided and different
      if (username && username.trim() && profile && profile.full_name !== username.trim()) {
        await supabaseAdmin
          .from('profiles')
          .update({ full_name: username.trim() })
          .eq('id', userId);
      }
      
      tempPassword = crypto.randomUUID();
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword
      });
      
      if (updateError) {
        console.error("Error updating user password:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to process login" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log("Existing user found:", userId);
    } else {
      // No user with this email - check if phone is already used
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, phone_number, full_name')
        .eq('phone_number', phone)
        .maybeSingle();

      if (existingProfile) {
        // Phone exists with different email
        // Allow login: find the auth user by profile id and check email
        const existingAuthUser = existingUsers.users.find(u => u.id === existingProfile.id);
        
        if (existingAuthUser) {
          // Same phone, different email = different person trying same phone
          // OR same person with new email
          // We treat email as unique identifier, so reject with helpful message
          return new Response(
            JSON.stringify({ error: "This phone number is already registered with a different email address. Please use the registered email or contact support." }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Create new user - username can be same as existing users (not unique)
      tempPassword = crypto.randomUUID();
      const fullName = username?.trim() || email.split('@')[0];
      
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone_number: phone,
        }
      });

      if (createError) {
        console.error("Error creating user:", createError);
        return new Response(
          JSON.stringify({ error: "Failed to create user account" }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = newUser.user.id;
      isNewUser = true;
      console.log("New user created:", userId);
    }

    // Sign in with temporary password
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const signInClient = createClient(supabaseUrl, supabaseAnonKey);
    
    const { data: signInData, error: signInError } = await signInClient.auth.signInWithPassword({
      email,
      password: tempPassword,
    });

    if (signInError || !signInData.session) {
      console.error("Sign in error:", signInError);
      return new Response(
        JSON.stringify({ error: "Failed to sign in. Please try again." }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Session created successfully for user:", userId);

    return new Response(
      JSON.stringify({
        success: true,
        isNewUser,
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
          expires_in: signInData.session.expires_in,
          token_type: signInData.session.token_type,
          user: {
            id: userId,
            email: email,
            role: 'user'
          }
        }
      }),
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
