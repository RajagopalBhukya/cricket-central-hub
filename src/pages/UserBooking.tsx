import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedDate, setSelectedGround, clearSelection } from "@/store/slices/bookingSlice";
import Navbar from "@/components/Navbar";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { MapPin, Clock, User, Calendar as CalendarIcon, LogOut, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

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
  isPast: boolean;
  price: number;
}

interface UserProfile {
  full_name: string;
  phone_number: string;
}

interface UserBooking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_amount: number;
  ground_name?: string;
}

const UserBooking = () => {
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [bookedSlots, setBookedSlots] = useState<{ start_time: string; end_time: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<TimeSlot[]>([]);
  const [bookingMessage, setBookingMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [userBookings, setUserBookings] = useState<UserBooking[]>([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [bookingToCancel, setBookingToCancel] = useState<UserBooking | null>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [bookingToReschedule, setBookingToReschedule] = useState<UserBooking | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleSlot, setRescheduleSlot] = useState<TimeSlot | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { selectedDate, selectedGround } = useAppSelector((state) => state.booking);

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
    
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, phone_number")
      .eq("id", session.user.id)
      .single();
    
    if (profileData) {
      setProfile(profileData);
    }
    
    fetchGrounds();
    fetchUserBookings(session.user.id);
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

  const fetchUserBookings = async (userId: string) => {
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active"])
      .order("booking_date", { ascending: true });

    if (bookingsData) {
      const groundIds = [...new Set(bookingsData.map(b => b.ground_id))];
      const { data: groundsData } = await supabase
        .from("grounds")
        .select("id, name")
        .in("id", groundIds);

      const groundsMap = new Map(groundsData?.map(g => [g.id, g]) || []);

      const enrichedBookings: UserBooking[] = bookingsData.map(booking => ({
        ...booking,
        ground_name: groundsMap.get(booking.ground_id)?.name || "N/A",
      }));

      setUserBookings(enrichedBookings);
    }
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

  // Price calculation: Day (7AM-6PM): ₹600, Night (6PM-11PM): ₹800
  const getSlotPrice = (hour: number): number => {
    if (hour >= 7 && hour < 18) {
      return 600; // Day rate
    } else {
      return 800; // Night rate
    }
  };

  const generateTimeSlots = useCallback((): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const now = new Date();
    const isToday = selectedDate && format(new Date(selectedDate), "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
    const currentHour = now.getHours();

    for (let hour = 7; hour < 23; hour++) {
      const start = `${hour.toString().padStart(2, "0")}:00`;
      const end = `${(hour + 1).toString().padStart(2, "0")}:00`;
      const isBooked = bookedSlots.some(
        (slot) => slot.start_time === start || (slot.start_time < end && slot.end_time > start)
      );
      const isPast = isToday && hour <= currentHour;
      const price = getSlotPrice(hour);
      slots.push({ start, end, available: !isBooked && !isPast, isPast, price });
    }
    return slots;
  }, [selectedDate, bookedSlots]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      dispatch(setSelectedDate(date.toISOString()));
      setSelectedSlots([]);
      setBookingMessage(null);
    }
  };

  const handleGroundSelect = (groundId: string) => {
    dispatch(setSelectedGround(groundId));
    setSelectedSlots([]);
    setBookingMessage(null);
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    setBookingMessage(null);
    
    const isAlreadySelected = selectedSlots.some(s => s.start === slot.start);
    
    if (isAlreadySelected) {
      setSelectedSlots(selectedSlots.filter(s => s.start !== slot.start));
    } else {
      setSelectedSlots([...selectedSlots, slot]);
    }
  };

  const handleBooking = async () => {
    if (!selectedGround || !selectedDate || selectedSlots.length === 0 || !user) {
      setBookingMessage({ type: 'error', text: "Please select a ground, date, and at least one time slot." });
      return;
    }

    // Clear any previous messages
    setBookingMessage(null);
    setBookingLoading(true);

    const formattedDate = format(new Date(selectedDate), "yyyy-MM-dd");
    const requestTimestamp = Date.now(); // Millisecond precision timestamp
    
    // Create bookings for all selected slots with timestamp
    const bookings = selectedSlots.map(slot => ({
      ground_id: selectedGround,
      user_id: user.id,
      booking_date: formattedDate,
      start_time: slot.start,
      end_time: slot.end,
      hours: 1,
      total_amount: slot.price,
      status: "active" as const,
      payment_status: "unpaid" as const,
      created_at: new Date(requestTimestamp).toISOString(),
    }));

    // Check for conflicts before inserting
    for (const booking of bookings) {
      const { data: conflict } = await supabase.rpc('check_booking_conflict', {
        _ground_id: booking.ground_id,
        _booking_date: booking.booking_date,
        _start_time: booking.start_time,
        _end_time: booking.end_time,
      });

      if (conflict) {
        setBookingLoading(false);
        setBookingMessage({ 
          type: 'error', 
          text: "Booking failed. Slot already booked. Please try another slot." 
        });
        fetchBookedSlots(selectedGround, new Date(selectedDate));
        return;
      }
    }

    const { data: insertedBookings, error } = await supabase
      .from("bookings")
      .insert(bookings)
      .select("id");

    setBookingLoading(false);

    if (error || !insertedBookings || insertedBookings.length === 0) {
      if (error?.code === '23505') { // Unique constraint violation
        setBookingMessage({ 
          type: 'error', 
          text: "Booking failed. Slot already booked. Please try another slot." 
        });
      } else {
        setBookingMessage({ 
          type: 'error', 
          text: error?.message || "Failed to create booking(s)" 
        });
      }
      fetchBookedSlots(selectedGround, new Date(selectedDate));
      return;
    }

    setBookingMessage({ 
      type: 'success', 
      text: "Booking request sent, will be confirmed soon" 
    });

    dispatch(clearSelection());
    setSelectedSlots([]);
    
    if (user) {
      fetchUserBookings(user.id);
    }
    
    // Navigate to success page after a short delay
    setTimeout(() => {
      navigate(`/booking-success?id=${insertedBookings[0].id}&count=${insertedBookings.length}`);
    }, 1500);
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingToCancel.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to cancel booking",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully.",
      });
      if (user) {
        fetchUserBookings(user.id);
      }
    }
    setCancelDialogOpen(false);
    setBookingToCancel(null);
  };

  const handleRescheduleBooking = async () => {
    if (!bookingToReschedule || !rescheduleDate || !rescheduleSlot) return;

    const formattedDate = format(rescheduleDate, "yyyy-MM-dd");

    // Check for conflicts
    const { data: conflict } = await supabase.rpc('check_booking_conflict', {
      _ground_id: bookingToReschedule.id,
      _booking_date: formattedDate,
      _start_time: rescheduleSlot.start,
      _end_time: rescheduleSlot.end,
      _exclude_booking_id: bookingToReschedule.id,
    });

    if (conflict) {
      toast({
        title: "Reschedule Failed",
        description: "The selected slot is already booked. Please choose another time.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("bookings")
      .update({
        booking_date: formattedDate,
        start_time: rescheduleSlot.start,
        end_time: rescheduleSlot.end,
        total_amount: rescheduleSlot.price,
      })
      .eq("id", bookingToReschedule.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reschedule booking",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Booking Rescheduled",
        description: "Your booking has been rescheduled successfully.",
      });
      if (user) {
        fetchUserBookings(user.id);
      }
    }
    setRescheduleDialogOpen(false);
    setBookingToReschedule(null);
    setRescheduleDate(undefined);
    setRescheduleSlot(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const timeSlots = generateTimeSlots();
  const totalAmount = selectedSlots.reduce((sum, slot) => sum + slot.price, 0);

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
            <div className="flex items-center justify-between flex-wrap gap-4">
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

        {/* Active Bookings */}
        {userBookings.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Your Active Bookings</CardTitle>
              <CardDescription>You can cancel or reschedule your bookings below</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {userBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium">{booking.ground_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(booking.booking_date), "PPP")} | {booking.start_time} - {booking.end_time}
                      </p>
                      <p className="text-sm font-medium text-primary">₹{booking.total_amount}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setBookingToReschedule(booking);
                          setRescheduleDialogOpen(true);
                        }}
                      >
                        Reschedule
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setBookingToCancel(booking);
                          setCancelDialogOpen(true);
                        }}
                      >
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <h1 className="text-4xl font-bold text-center mb-8 text-primary">Book a Slot</h1>

        {/* Booking Message */}
        {bookingMessage && (
          <div
            className={`mb-6 p-4 rounded-lg text-center border ${
              bookingMessage.type === "success"
                ? "bg-primary/10 text-foreground border-primary/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            }`}
            role="status"
            aria-live="polite"
          >
            {bookingMessage.text}
          </div>
        )}

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
                    <div className="text-sm text-muted-foreground">
                      <p>Day (7AM-6PM): <span className="font-bold text-primary">₹600/hr</span></p>
                      <p>Night (6PM-11PM): <span className="font-bold text-primary">₹800/hr</span></p>
                    </div>
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
                  <p className="text-sm text-muted-foreground mb-3">
                    Select multiple slots to book at once
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((slot) => {
                      const isSelected = selectedSlots.some(s => s.start === slot.start);
                      const isNight = parseInt(slot.start) >= 18;
                      const isBooked = !slot.available && !slot.isPast;
                      
                      const handleSlotClick = () => {
                        if (isBooked) {
                          setBookingMessage({
                            type: 'error',
                            text: 'Slot already booked. Please book another slot.'
                          });
                          return;
                        }
                        if (slot.available) {
                          handleTimeSlotSelect(slot);
                        }
                      };
                      
                      return (
                        <Button
                          key={slot.start}
                          variant={
                            isSelected
                              ? "default"
                              : isBooked
                              ? "destructive"
                              : slot.available
                              ? "outline"
                              : "secondary"
                          }
                          disabled={slot.isPast}
                          onClick={handleSlotClick}
                          className={`text-sm flex flex-col h-auto py-2 ${slot.isPast ? "line-through opacity-50" : ""} ${isBooked ? "cursor-not-allowed" : ""}`}
                        >
                          <span>{slot.start} - {slot.end}</span>
                          <span className={`text-xs ${isSelected ? 'text-primary-foreground' : isBooked ? 'text-destructive-foreground' : 'text-muted-foreground'}`}>
                            {isBooked ? "Booked" : `₹${slot.price}`}
                          </span>
                          {slot.isPast && <span className="text-xs">(Past)</span>}
                        </Button>
                      );
                    })}
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
        {selectedGround && selectedDate && selectedSlots.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Booking Summary ({selectedSlots.length} slot{selectedSlots.length > 1 ? "s" : ""})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Ground</p>
                  <p className="font-semibold">{grounds.find(g => g.id === selectedGround)?.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p className="font-semibold">{format(new Date(selectedDate), "PPP")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Selected Slots</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedSlots.sort((a, b) => a.start.localeCompare(b.start)).map(slot => (
                      <Badge key={slot.start} variant="secondary" className="text-xs">
                        {slot.start}-{slot.end} (₹{slot.price})
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-semibold text-primary text-xl">₹{totalAmount}</p>
                </div>
              </div>
              <Button
                size="lg"
                className="w-full"
                onClick={handleBooking}
                disabled={bookingLoading}
              >
                {bookingLoading ? "Booking..." : `Confirm ${selectedSlots.length} Booking${selectedSlots.length > 1 ? "s" : ""}`}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cancel Booking Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to cancel this booking?</p>
          {bookingToCancel && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">{bookingToCancel.ground_name}</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(bookingToCancel.booking_date), "PPP")} | {bookingToCancel.start_time} - {bookingToCancel.end_time}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Booking
            </Button>
            <Button variant="destructive" onClick={handleCancelBooking}>
              Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Booking Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reschedule Booking</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium mb-2">Select New Date</p>
              <Calendar
                mode="single"
                selected={rescheduleDate}
                onSelect={setRescheduleDate}
                disabled={(date) =>
                  isBefore(startOfDay(date), startOfDay(new Date())) ||
                  isBefore(addDays(new Date(), 30), date)
                }
                className="rounded-md border"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Select New Time</p>
              <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                {timeSlots.filter(s => s.available).map((slot) => (
                  <Button
                    key={slot.start}
                    variant={rescheduleSlot?.start === slot.start ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRescheduleSlot(slot)}
                  >
                    {slot.start}-{slot.end}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRescheduleBooking}
              disabled={!rescheduleDate || !rescheduleSlot}
            >
              Confirm Reschedule
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

export default UserBooking;
