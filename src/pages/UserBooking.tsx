import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedDate, setSelectedGround, setSelectedTimeSlot, clearSelection } from "@/store/slices/bookingSlice";
import Navbar from "@/components/Navbar";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { MapPin, Clock, User, Calendar as CalendarIcon, LogOut } from "lucide-react";

interface Ground {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  price_per_hour: number;
  is_active: boolean;
}

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
}

interface UserProfile {
  full_name: string;
  phone_number: string;
}

const UserBooking = () => {
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [bookedSlots, setBookedSlots] = useState<{ start_time: string; end_time: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { selectedDate, selectedGround, selectedTimeSlot } = useAppSelector((state) => state.booking);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
    
    // Fetch user profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, phone_number")
      .eq("id", session.user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
    }
    
    fetchGrounds();
  };

  const fetchGrounds = async () => {
    const { data, error } = await supabase
      .from("grounds")
      .select("*")
      .eq("is_active", true);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load grounds",
        variant: "destructive",
      });
    } else {
      setGrounds(data || []);
    }
    setLoading(false);
  };

  const fetchBookedSlots = async (groundId: string, date: Date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("bookings")
      .select("start_time, end_time")
      .eq("ground_id", groundId)
      .eq("booking_date", formattedDate)
      .in("status", ["active", "completed"]);

    if (!error && data) {
      setBookedSlots(data);
    }
  };

  useEffect(() => {
    if (selectedGround && selectedDate) {
      fetchBookedSlots(selectedGround, new Date(selectedDate));
    }
  }, [selectedGround, selectedDate]);

  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    for (let hour = 6; hour < 23; hour++) {
      const start = `${hour.toString().padStart(2, "0")}:00`;
      const end = `${(hour + 1).toString().padStart(2, "0")}:00`;
      const isBooked = bookedSlots.some(
        (slot) => slot.start_time === start || (slot.start_time < end && slot.end_time > start)
      );
      slots.push({ start, end, available: !isBooked });
    }
    return slots;
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      dispatch(setSelectedDate(date.toISOString()));
      dispatch(setSelectedTimeSlot(null));
    }
  };

  const handleGroundSelect = (groundId: string) => {
    dispatch(setSelectedGround(groundId));
    dispatch(setSelectedTimeSlot(null));
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    if (slot.available) {
      dispatch(setSelectedTimeSlot({ start: slot.start, end: slot.end }));
    }
  };

  const handleBooking = async () => {
    if (!selectedGround || !selectedDate || !selectedTimeSlot || !user) {
      toast({
        title: "Missing Information",
        description: "Please select a ground, date, and time slot.",
        variant: "destructive",
      });
      return;
    }

    setBookingLoading(true);

    const formattedDate = format(new Date(selectedDate), "yyyy-MM-dd");
    const selectedGroundData = grounds.find((g) => g.id === selectedGround);
    const hours = 1;
    const totalAmount = selectedGroundData ? selectedGroundData.price_per_hour * hours : 0;

    const { data: insertedBooking, error } = await supabase
      .from("bookings")
      .insert({
        ground_id: selectedGround,
        user_id: user.id,
        booking_date: formattedDate,
        start_time: selectedTimeSlot.start,
        end_time: selectedTimeSlot.end,
        hours,
        total_amount: totalAmount,
        status: "active",
        payment_status: "unpaid",
      })
      .select("id")
      .single();

    setBookingLoading(false);

    if (error || !insertedBooking) {
      toast({
        title: "Booking Failed",
        description: error?.message || "Failed to create booking",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Booking Successful!",
      description: "Your slot has been booked successfully.",
    });

    dispatch(clearSelection());
    navigate(`/booking-success?id=${insertedBooking.id}`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const selectedGroundData = grounds.find((g) => g.id === selectedGround);
  const timeSlots = generateTimeSlots();

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-20">
        {/* User Profile Header */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{profile?.full_name || "User"}</h2>
                  <p className="text-muted-foreground">{user?.email}</p>
                  {profile?.phone_number && (
                    <p className="text-sm text-muted-foreground">{profile.phone_number}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => navigate("/dashboard")}>
                  My Bookings
                </Button>
                <Button variant="ghost" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <h1 className="text-4xl font-bold text-center mb-8 text-primary">Book a Slot</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Ground Selection */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" /> Select Ground
            </h2>
            <div className="space-y-4">
              {grounds.map((ground) => (
                <Card
                  key={ground.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedGround === ground.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleGroundSelect(ground.id)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{ground.name}</CardTitle>
                    <CardDescription>{ground.location}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold text-primary">₹{ground.price_per_hour}/hr</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" /> Select Date
            </h2>
            <Card>
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate ? new Date(selectedDate) : undefined}
                  onSelect={handleDateSelect}
                  disabled={(date) =>
                    isBefore(startOfDay(date), startOfDay(new Date())) ||
                    isBefore(addDays(new Date(), 30), date)
                  }
                  className="rounded-md"
                />
              </CardContent>
            </Card>
          </div>

          {/* Time Slot Selection */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Select Time
            </h2>
            {selectedGround && selectedDate ? (
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((slot) => (
                      <Button
                        key={slot.start}
                        variant={
                          selectedTimeSlot?.start === slot.start
                            ? "default"
                            : slot.available
                            ? "outline"
                            : "secondary"
                        }
                        disabled={!slot.available}
                        onClick={() => handleTimeSlotSelect(slot)}
                        className="text-sm"
                      >
                        {slot.start} - {slot.end}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  Please select a ground and date first
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Booking Summary */}
        {selectedGroundData && selectedDate && selectedTimeSlot && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Ground</p>
                  <p className="font-semibold">{selectedGroundData.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold">{format(new Date(selectedDate), "PPP")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-semibold">
                    {selectedTimeSlot.start} - {selectedTimeSlot.end}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-semibold text-primary text-xl">
                    ₹{selectedGroundData.price_per_hour}
                  </p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={handleBooking}
                disabled={bookingLoading}
              >
                {bookingLoading ? "Booking..." : "Confirm Booking"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <footer className="bg-card border-t border-border py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Box Cricket. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default UserBooking;
