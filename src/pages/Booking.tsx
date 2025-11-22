import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedGround, setSelectedDate, setSelectedTimeSlot, clearSelection } from "@/store/slices/bookingSlice";
import { format } from "date-fns";

interface Ground {
  id: string;
  name: string;
  location: string;
  price_per_hour: number;
  image_url: string | null;
}

const Booking = () => {
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [date, setDate] = useState<Date>();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  
  const dispatch = useAppDispatch();
  const { selectedGround, selectedTimeSlot } = useAppSelector((state) => state.booking);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    checkUser();
    fetchGrounds();
  }, []);

  useEffect(() => {
    if (selectedGround && date) {
      checkAvailability();
    }
  }, [selectedGround, date]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?mode=login");
      return;
    }
    setUser(session.user);
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
      return;
    }

    setGrounds(data || []);
  };

  const checkAvailability = async () => {
    if (!selectedGround || !date) return;

    const formattedDate = format(date, "yyyy-MM-dd");
    
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("start_time, end_time")
      .eq("ground_id", selectedGround)
      .eq("booking_date", formattedDate)
      .in("status", ["active", "completed"]);

    if (error) {
      console.error("Error checking availability:", error);
      return;
    }

    // Generate time slots from 6 AM to 11 PM
    const allSlots = [];
    for (let hour = 6; hour <= 22; hour++) {
      allSlots.push(`${hour.toString().padStart(2, "0")}:00`);
    }

    // Filter out booked slots - check for any time overlap
    const bookedTimes = new Set(bookings?.map(b => b.start_time) || []);
    const available = allSlots.filter(slot => !bookedTimes.has(slot));
    
    setAvailableSlots(available);
  };

  const handleBooking = async () => {
    if (!selectedGround || !date || !selectedTimeSlot || !user) {
      toast({
        title: "Missing Information",
        description: "Please select ground, date, and time slot",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    // Double-check availability before booking
    const formattedDate = format(date, "yyyy-MM-dd");
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("id")
      .eq("ground_id", selectedGround)
      .eq("booking_date", formattedDate)
      .eq("start_time", selectedTimeSlot.start)
      .in("status", ["active", "completed"]);

    if (existingBookings && existingBookings.length > 0) {
      setLoading(false);
      toast({
        title: "Slot Already Booked",
        description: "This time slot was just booked. Please select another slot.",
        variant: "destructive",
      });
      // Refresh availability
      checkAvailability();
      return;
    }

    const selectedGroundData = grounds.find(g => g.id === selectedGround);
    const hours = 1; // Default 1 hour booking
    const totalAmount = selectedGroundData ? selectedGroundData.price_per_hour * hours : 0;

    const { error } = await supabase.from("bookings").insert({
      ground_id: selectedGround,
      user_id: user.id,
      booking_date: formattedDate,
      start_time: selectedTimeSlot.start,
      end_time: selectedTimeSlot.end,
      hours,
      total_amount: totalAmount,
      status: "active",
      payment_status: "unpaid",
    });

    setLoading(false);

    if (error) {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Booking Successful!",
      description: "Your ground has been booked successfully.",
    });

    dispatch(clearSelection());
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold text-center mb-12">Book Your Ground</h1>

        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Select Ground</CardTitle>
              <CardDescription>Choose from our available grounds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select
                value={selectedGround || ""}
                onValueChange={(value) => dispatch(setSelectedGround(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a ground" />
                </SelectTrigger>
                <SelectContent>
                  {grounds.map((ground) => (
                    <SelectItem key={ground.id} value={ground.id}>
                      {ground.name} - ₹{ground.price_per_hour}/hr
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedGround && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Select Date</label>
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={(newDate) => {
                        setDate(newDate);
                        if (newDate) {
                          dispatch(setSelectedDate(format(newDate, "yyyy-MM-dd")));
                        }
                      }}
                      disabled={(date) => date < new Date()}
                      className="rounded-md border"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Available Time Slots</CardTitle>
              <CardDescription>
                {availableSlots.length} slots available
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedGround || !date ? (
                <p className="text-muted-foreground text-center py-8">
                  Please select a ground and date first
                </p>
              ) : availableSlots.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No slots available for this date
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => {
                    const endHour = parseInt(slot.split(":")[0]) + 1;
                    const endTime = `${endHour.toString().padStart(2, "0")}:00`;
                    const isSelected = selectedTimeSlot?.start === slot;
                    
                    return (
                      <Button
                        key={slot}
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => dispatch(setSelectedTimeSlot({ start: slot, end: endTime }))}
                        className="text-sm"
                      >
                        {slot}
                      </Button>
                    );
                  })}
                </div>
              )}

              {selectedGround && date && selectedTimeSlot && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <h3 className="font-semibold mb-2">Booking Summary</h3>
                    <p className="text-sm text-muted-foreground">
                      Ground: {grounds.find(g => g.id === selectedGround)?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Date: {format(date, "PPP")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Time: {selectedTimeSlot.start} - {selectedTimeSlot.end}
                    </p>
                    <p className="text-sm font-semibold mt-2">
                      Total: ₹{grounds.find(g => g.id === selectedGround)?.price_per_hour}
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleBooking}
                    disabled={loading}
                  >
                    {loading ? "Booking..." : "Confirm Booking"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="bg-card border-t border-border py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Box Cricket. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Booking;
