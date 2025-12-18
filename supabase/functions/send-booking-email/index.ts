import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingEmailRequest {
  type: "confirmed" | "cancelled" | "rejected" | "rescheduled";
  userEmail: string;
  userName: string;
  groundName: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
  isAdminNotification?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.log("RESEND_API_KEY not configured, skipping email");
      return new Response(
        JSON.stringify({ success: true, message: "Email skipped - API key not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data: BookingEmailRequest = await req.json();
    console.log("Sending email notification:", data.type, "to:", data.userEmail);

    let subject = "";
    let htmlContent = "";

    const baseInfo = `
      <p><strong>Ground:</strong> ${data.groundName}</p>
      <p><strong>Date:</strong> ${data.bookingDate}</p>
      <p><strong>Time:</strong> ${data.startTime} - ${data.endTime}</p>
      <p><strong>Amount:</strong> ₹${data.totalAmount}</p>
    `;

    switch (data.type) {
      case "confirmed":
        subject = data.isAdminNotification 
          ? "Admin Booking Confirmed - Box Cricket" 
          : "Booking Confirmed - Box Cricket";
        htmlContent = `
          <h1>Booking Confirmed!</h1>
          <p>Hello ${data.userName},</p>
          <p>Your booking has been confirmed. Here are the details:</p>
          ${baseInfo}
          <p>Thank you for choosing Box Cricket!</p>
        `;
        break;

      case "cancelled":
        subject = "Booking Cancelled - Box Cricket";
        htmlContent = `
          <h1>Booking Cancelled</h1>
          <p>Hello ${data.userName},</p>
          <p>Your booking has been cancelled. Here were the details:</p>
          ${baseInfo}
          <p>The time slot is now available for rebooking.</p>
          <p>We hope to see you again soon!</p>
        `;
        break;

      case "rejected":
        subject = "Booking Request Rejected - Box Cricket";
        htmlContent = `
          <h1>Booking Request Rejected</h1>
          <p>Hello ${data.userName},</p>
          <p>We're sorry, but your booking request has been rejected. Here were the details:</p>
          ${baseInfo}
          <p>The time slot is now available for others to book.</p>
          <p>Please try booking a different time slot or contact us for assistance.</p>
        `;
        break;

      case "rescheduled":
        subject = "Booking Rescheduled - Box Cricket";
        htmlContent = `
          <h1>Booking Rescheduled</h1>
          <p>Hello ${data.userName},</p>
          <p>Your booking has been rescheduled.</p>
          <h3>Previous Details:</h3>
          ${baseInfo}
          <h3>New Details:</h3>
          <p><strong>Ground:</strong> ${data.groundName}</p>
          <p><strong>New Date:</strong> ${data.newDate || data.bookingDate}</p>
          <p><strong>New Time:</strong> ${data.newStartTime || data.startTime} - ${data.newEndTime || data.endTime}</p>
          <p>Thank you for your patience!</p>
        `;
        break;
    }

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Box Cricket <onboarding@resend.dev>",
        to: [data.userEmail],
        subject,
        html: htmlContent,
      }),
    });

    const result = await emailResponse.json();
    console.log("Email sent:", result);

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-booking-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
