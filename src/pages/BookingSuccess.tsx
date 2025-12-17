import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { CheckCircle, Calendar, Clock, MapPin, User, Home, X } from "lucide-react";

interface BookingDetails {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  grounds: {
    name: string;
    location: string;
  };
  profiles: {
    full_name: string;
    phone_number: string;
  };
}

const BookingSuccess = () => {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get("id");
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (bookingId) {
      fetchBookingDetails();
    } else {
      navigate("/");
    }
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?mode=login");
      return;
    }

    // First fetch booking with ground info
    const { data: bookingData, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        status,
        payment_status,
        total_amount,
        user_id,
        grounds (
          name,
          location
        )
      `)
      .eq("id", bookingId)
      .eq("user_id", session.user.id)
      .single();

    if (bookingError || !bookingData) {
      toast({
        title: "Error",
        description: "Booking not found",
        variant: "destructive",
      });
      navigate("/user/booking");
      return;
    }

    // Fetch profile separately
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, phone_number")
      .eq("id", session.user.id)
      .single();

    const enrichedBooking = {
      ...bookingData,
      profiles: profileData || { full_name: "N/A", phone_number: "" },
    };

    setBooking(enrichedBooking as any);
    setLoading(false);
  };

  const handleCancelBooking = async () => {
    if (!booking) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to cancel booking. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully.",
      });
      navigate("/dashboard");
    }
    setCancelDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-20">
        <div className="max-w-2xl mx-auto">
          {/* Success Icon */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-green-600 mb-2">Booking Successful!</h1>
            <p className="text-muted-foreground">
              Your slot for {format(new Date(booking.booking_date), "PPP")} at {booking.start_time} is successfully booked!
            </p>
          </div>

          {/* Booking Details Card */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Booking Details</span>
                <Badge className={booking.status === "active" ? "bg-green-500" : "bg-red-500"}>
                  {booking.status === "active" ? "✔ Booked Successfully" : booking.status}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Booking ID</p>
                    <p className="font-mono text-sm">{booking.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">User Name</p>
                      <p className="font-medium">{booking.profiles?.full_name || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Ground</p>
                      <p className="font-medium">{booking.grounds.name}</p>
                      <p className="text-xs text-muted-foreground">{booking.grounds.location}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Date</p>
                      <p className="font-medium">{format(new Date(booking.booking_date), "PPPP")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Time Slot</p>
                      <p className="font-medium">{booking.start_time} - {booking.end_time}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <Badge variant={booking.payment_status === "paid" ? "default" : "secondary"}>
                      {booking.payment_status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium">Total Amount</span>
                  <span className="text-2xl font-bold text-primary">₹{booking.total_amount}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {booking.status === "active" && (
              <Button
                variant="destructive"
                size="lg"
                onClick={() => setCancelDialogOpen(true)}
                className="flex items-center gap-2"
              >
                <X className="w-4 h-4" /> Cancel Booking
              </Button>
            )}
            <Link to="/">
              <Button variant="outline" size="lg" className="flex items-center gap-2 w-full sm:w-auto">
                <Home className="w-4 h-4" /> Back to Home
              </Button>
            </Link>
            <Link to="/dashboard">
              <Button size="lg" className="w-full sm:w-auto">
                View All Bookings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to cancel this booking? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={handleCancelBooking}>
              Yes, Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <footer className="bg-card border-t border-border py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Box Cricket. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default BookingSuccess;
