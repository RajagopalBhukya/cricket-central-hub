import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useBookingNotifications } from "@/hooks/useBookingNotifications";
import BookingConfirmationDialog from "@/components/BookingConfirmationDialog";
import Navbar from "@/components/Navbar";
import { format } from "date-fns";
import { Calendar, Clock, MapPin } from "lucide-react";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_status: string;
  total_amount: number;
  ground_id: string;
  ground_name?: string;
  ground_location?: string;
}

const MyBookings = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const navigate = useNavigate();

  // Real-time booking notifications
  useBookingNotifications({
    userId,
    onBookingConfirmed: () => {
      setConfirmationDialogOpen(true);
      if (userId) fetchBookings(userId);
    },
    onBookingRejected: () => {
      if (userId) fetchBookings(userId);
    },
    onBookingUpdated: () => {
      if (userId) fetchBookings(userId);
    },
  });

  useEffect(() => {
    checkUserAndFetchBookings();
  }, []);

  const checkUserAndFetchBookings = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?mode=login");
      return;
    }

    setUserId(session.user.id);
    await fetchBookings(session.user.id);
  };

  const fetchBookings = async (uid: string) => {
    // Fetch bookings
    const { data: bookingsData, error } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", uid)
      .order("booking_date", { ascending: false });

    if (error || !bookingsData) {
      setLoading(false);
      return;
    }

    // Fetch ground details
    const groundIds = [...new Set(bookingsData.map(b => b.ground_id))];
    const { data: groundsData } = await supabase
      .from("grounds")
      .select("id, name, location")
      .in("id", groundIds);

    const groundsMap = new Map(groundsData?.map(g => [g.id, g]) || []);

    const enrichedBookings: Booking[] = bookingsData.map(booking => ({
      ...booking,
      ground_name: groundsMap.get(booking.ground_id)?.name || "N/A",
      ground_location: groundsMap.get(booking.ground_id)?.location || "",
    }));

    setBookings(enrichedBookings);
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-destructive hover:bg-destructive/90";
      case "confirmed":
      case "active":
        return "bg-primary hover:bg-primary/90";
      case "completed":
        return "bg-blue-500 hover:bg-blue-600";
      case "cancelled":
        return "bg-muted-foreground hover:bg-muted-foreground/90";
      default:
        return "bg-muted-foreground hover:bg-muted-foreground/90";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Pending Approval";
      case "confirmed":
        return "Confirmed";
      case "active":
        return "Active";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-16 sm:py-20">
        <h1 className="text-2xl sm:text-4xl font-bold text-center mb-8 sm:mb-12">My Bookings</h1>

        {loading ? (
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : bookings.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">You haven't made any bookings yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {bookings.map((booking) => (
              <Card key={booking.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-base sm:text-lg">{booking.ground_name}</span>
                    <Badge className={`${getStatusColor(booking.status)} w-fit`}>
                      {getStatusLabel(booking.status)}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0 space-y-2 sm:space-y-3">
                  <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                    <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">{booking.ground_location}</span>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                    {format(new Date(booking.booking_date), "PPP")}
                  </div>
                  <div className="flex items-center text-xs sm:text-sm text-muted-foreground">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-2 flex-shrink-0" />
                    {booking.start_time} - {booking.end_time}
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-xs sm:text-sm font-medium">Total Amount:</span>
                      <span className="text-base sm:text-lg font-bold text-primary">
                        ₹{booking.total_amount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-[10px] sm:text-xs text-muted-foreground">Payment:</span>
                      <Badge variant={booking.payment_status === "paid" ? "default" : "secondary"} className="text-xs">
                        {booking.payment_status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Booking Confirmation Dialog */}
      <BookingConfirmationDialog
        open={confirmationDialogOpen}
        onClose={() => setConfirmationDialogOpen(false)}
      />

      <footer className="bg-card border-t border-border py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Box Cricket. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default MyBookings;
