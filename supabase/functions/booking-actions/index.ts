import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BookingActionRequest {
  action: 'cancel' | 'reject' | 'confirm';
  bookingId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user from the token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid authorization token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { action, bookingId }: BookingActionRequest = await req.json();
    console.log(`Processing ${action} for booking ${bookingId} by user ${user.id}`);

    if (!action || !bookingId) {
      return new Response(
        JSON.stringify({ error: 'Missing action or bookingId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the booking
    const { data: booking, error: fetchError } = await supabaseClient
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      console.error('Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Booking not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    const isAdmin = !!roleData;

    // Validate permissions based on action
    if (action === 'cancel') {
      // Only the booking owner can cancel their own booking
      if (booking.user_id !== user.id && !isAdmin) {
        return new Response(
          JSON.stringify({ error: 'You can only cancel your own bookings' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Can only cancel pending bookings (for users)
      if (!isAdmin && booking.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: 'Only pending bookings can be cancelled' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update to cancelled
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to cancel booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Booking ${bookingId} cancelled successfully`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Booking cancelled successfully. Slot is now available.',
          status: 'cancelled'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'reject') {
      // Only admins can reject
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can reject bookings' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Can only reject pending bookings
      if (booking.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: 'Only pending bookings can be rejected' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update to rejected
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update({ 
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to reject booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Booking ${bookingId} rejected successfully`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Booking rejected. Slot is now available.',
          status: 'rejected'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'confirm') {
      // Only admins can confirm
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can confirm bookings' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Can only confirm pending bookings
      if (booking.status !== 'pending') {
        return new Response(
          JSON.stringify({ error: 'Only pending bookings can be confirmed' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update to confirmed
      const { error: updateError } = await supabaseClient
        .from('bookings')
        .update({ 
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      if (updateError) {
        console.error('Update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to confirm booking' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Booking ${bookingId} confirmed successfully`);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Booking confirmed. Slot is now locked.',
          status: 'confirmed'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
