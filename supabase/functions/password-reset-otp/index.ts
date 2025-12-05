import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate a cryptographically secure 6-digit OTP
function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, '0');
}

// Hash OTP for secure storage (using SHA-256)
async function hashOTP(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Use service role client to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, email, otp, newPassword } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (action === "generate") {
      console.log(`Generating OTP for email: ${normalizedEmail}`);

      // Check if user exists in auth.users
      const { data: users, error: userError } = await supabase.auth.admin.listUsers();
      
      if (userError) {
        console.error("Error checking user:", userError);
        // Don't reveal if user exists or not for security
        return new Response(
          JSON.stringify({ success: true, message: "If an account exists with this email, an OTP has been generated." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      const userExists = users.users.some(u => u.email?.toLowerCase() === normalizedEmail);
      
      if (!userExists) {
        // Don't reveal if user exists - return same response
        console.log("User not found, returning generic success message");
        return new Response(
          JSON.stringify({ success: true, message: "If an account exists with this email, an OTP has been generated." }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Invalidate any existing unused OTPs for this email
      await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("email", normalizedEmail)
        .eq("used", false);

      // Generate new OTP
      const plainOtp = generateOTP();
      const hashedOtp = await hashOTP(plainOtp);
      
      // OTP expires in 10 minutes
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Store hashed OTP
      const { error: insertError } = await supabase
        .from("password_reset_otps")
        .insert({
          email: normalizedEmail,
          otp: hashedOtp,
          expires_at: expiresAt,
          used: false,
        });

      if (insertError) {
        console.error("Error storing OTP:", insertError);
        return new Response(
          JSON.stringify({ error: "Failed to generate OTP" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // In production, send OTP via email using Resend or similar
      // For now, we'll log it (REMOVE IN PRODUCTION)
      console.log(`OTP generated for ${normalizedEmail}: ${plainOtp}`);

      // Return the OTP in development - REMOVE THIS IN PRODUCTION
      // In production, send via email and just return success message
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "OTP has been generated. Check your email.",
          // DEVELOPMENT ONLY - remove in production
          otp: plainOtp 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "verify") {
      if (!otp) {
        return new Response(
          JSON.stringify({ error: "OTP is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate OTP format
      if (!/^\d{6}$/.test(otp)) {
        return new Response(
          JSON.stringify({ error: "Invalid OTP format" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Verifying OTP for email: ${normalizedEmail}`);

      const hashedOtp = await hashOTP(otp);

      // Find matching OTP
      const { data: otpRecord, error: fetchError } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("otp", hashedOtp)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !otpRecord) {
        console.log("OTP verification failed - invalid or expired");
        return new Response(
          JSON.stringify({ error: "Invalid or expired OTP" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "OTP verified successfully" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (action === "reset") {
      if (!otp || !newPassword) {
        return new Response(
          JSON.stringify({ error: "OTP and new password are required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Validate password
      if (newPassword.length < 6 || newPassword.length > 100) {
        return new Response(
          JSON.stringify({ error: "Password must be between 6 and 100 characters" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Resetting password for email: ${normalizedEmail}`);

      const hashedOtp = await hashOTP(otp);

      // Verify OTP one more time
      const { data: otpRecord, error: fetchError } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("email", normalizedEmail)
        .eq("otp", hashedOtp)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError || !otpRecord) {
        console.log("Password reset failed - invalid or expired OTP");
        return new Response(
          JSON.stringify({ error: "Invalid or expired OTP" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Mark OTP as used
      await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

      // Get user by email and update password
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users.find(u => u.email?.toLowerCase() === normalizedEmail);

      if (!user) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Update the user's password
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        user.id,
        { password: newPassword }
      );

      if (updateError) {
        console.error("Error updating password:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update password" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Password reset successful for ${normalizedEmail}`);

      return new Response(
        JSON.stringify({ success: true, message: "Password reset successfully" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'generate', 'verify', or 'reset'" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    console.error("Error in password-reset-otp function:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
