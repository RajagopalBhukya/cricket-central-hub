import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useBookingNotifications } from "@/hooks/useBookingNotifications";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setSelectedDate, setSelectedGround, clearSelection } from "@/store/slices/bookingSlice";
import Navbar from "@/components/Navbar";
import BookingConfirmationDialog from "@/components/BookingConfirmationDialog";
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
  status?: string;
  userId?: string;
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
  const [bookedSlots, setBookedSlots] = useState<{ start_time: string; end_time: string; status?: string; user_id?: string }[]>([]);
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
  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { selectedDate, selectedGround } = useAppSelector((state) => state.booking);

  // Real-time booking notifications
  useBookingNotifications({
    userId: user?.id || null,
    onBookingConfirmed: () => {
      setConfirmationDialogOpen(true);
      if (user) fetchUserBookings(user.id);
      if (selectedGround && selectedDate) {
        fetchBookedSlots(selectedGround, new Date(selectedDate));
      }
    },
    onBookingRejected: () => {
      if (user) fetchUserBookings(user.id);
      if (selectedGround && selectedDate) {
        fetchBookedSlots(selectedGround, new Date(selectedDate));
      }
    },
    onBookingUpdated: () => {
      if (selectedGround && selectedDate) {
        fetchBookedSlots(selectedGround, new Date(selectedDate));
      }
    },
  });

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
      .in("status", ["pending", "confirmed", "active"])
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
    
    // First fetch from booking_slots (public, fast, for UI)
    const { data: slotsData, error: slotsError } = await supabase
      .from("booking_slots")
      .select("start_time, end_time, status, booking_id")
      .eq("ground_id", groundId)
      .eq("booking_date", formattedDate);

    if (slotsError) {
      console.error("Error fetching booking_slots:", slotsError);
    }

    // Also fetch user_id from bookings for the current user's own bookings
    const { data: bookingsData, error: bookingsError } = await supabase
      .from("bookings")
      .select("id, start_time, end_time, status, user_id")
      .eq("ground_id", groundId)
      .eq("booking_date", formattedDate)
      .in("status", ["pending", "confirmed", "active", "completed"]);

    if (bookingsError) {
      console.error("Error fetching bookings:", bookingsError);
    }

    // Merge: use booking_slots for availability but add user_id from bookings
    const mergedSlots = (slotsData || []).map(slot => {
      const matchingBooking = bookingsData?.find(b => b.id === slot.booking_id);
      return {
        start_time: slot.start_time,
        end_time: slot.end_time,
        status: slot.status,
        user_id: matchingBooking?.user_id
      };
    });

    setBookedSlots(mergedSlots);
  };

  useEffect(() => {
    if (selectedGround && selectedDate) {
      fetchBookedSlots(selectedGround, new Date(selectedDate));
    }
  }, [selectedGround, selectedDate]);

  // Real-time subscription for booking_slots updates (fast, public table)
  useEffect(() => {
    if (!selectedGround || !selectedDate) return;

    const channel = supabase
      .channel('booking-slot-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'booking_slots',
          filter: `ground_id=eq.${selectedGround}`
        },
        (payload) => {
          console.log('Real-time booking_slots update:', payload);
          // Refetch booked slots when any slot changes
          fetchBookedSlots(selectedGround, new Date(selectedDate));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedGround, selectedDate]);

  // Check if selected ground is day or night based on ground name
  const isDayGround = useCallback((): boolean => {
    const ground = grounds.find(g => g.id === selectedGround);
    return ground?.name?.toLowerCase().includes('day') ?? false;
  }, [grounds, selectedGround]);

  // Get price based on ground type
  const getSlotPrice = (): number => {
    return isDayGround() ? 600 : 800;
  };

  const generateTimeSlots = useCallback((): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const now = new Date();
    const isToday = selectedDate && format(new Date(selectedDate), "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    // Determine slot range based on ground type
    const isDay = isDayGround();
    const startHour = isDay ? 7 : 18;  // Day: 7AM, Night: 6PM
    const endHour = isDay ? 18 : 23;   // Day: 6PM, Night: 11PM
    const pricePerSlot = isDay ? 300 : 400; // Half of hourly rate for 30-min slots

    // Generate 30-minute slots
    for (let hour = startHour; hour < endHour; hour++) {
      for (let halfHour = 0; halfHour < 2; halfHour++) {
        const startMinutes = halfHour * 30;
        const endMinutes = (halfHour + 1) * 30;
        const endHourAdjusted = endMinutes === 60 ? hour + 1 : hour;
        const endMinutesAdjusted = endMinutes === 60 ? 0 : endMinutes;
        
        const start = `${hour.toString().padStart(2, "0")}:${startMinutes.toString().padStart(2, "0")}`;
        const end = `${endHourAdjusted.toString().padStart(2, "0")}:${endMinutesAdjusted.toString().padStart(2, "0")}`;
        
        const bookedSlot = bookedSlots.find(
          (slot) => slot.start_time === start || (slot.start_time < end && slot.end_time > start)
        );
        const isBooked = !!bookedSlot;
        
        // Check if slot is in the past (compare both hour and minutes for today)
        const isPast = isToday && (hour < currentHour || (hour === currentHour && startMinutes <= currentMinutes));
        
        slots.push({ 
          start, 
          end, 
          available: !isBooked && !isPast, 
          isPast, 
          price: pricePerSlot, 
          status: bookedSlot?.status,
          userId: bookedSlot?.user_id  // Pass the user_id so TimeSlotCard can check if it's booked by others
        });
      }
    }
    return slots;
  }, [selectedDate, bookedSlots, isDayGround]);

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

  // Helper to check if a slot is consecutive to the current selection
  const isSlotConsecutive = (slot: TimeSlot, currentSelection: TimeSlot[]): boolean => {
    if (currentSelection.length === 0) return true;
    
    const sortedSelection = [...currentSelection].sort((a, b) => a.start.localeCompare(b.start));
    const firstSlot = sortedSelection[0];
    const lastSlot = sortedSelection[sortedSelection.length - 1];
    
    // Check if slot is immediately before the first selected slot
    if (slot.end === firstSlot.start) return true;
    // Check if slot is immediately after the last selected slot
    if (slot.start === lastSlot.end) return true;
    
    return false;
  };

  // Helper to check if removing a slot would break consecutive chain
  const canRemoveSlot = (slot: TimeSlot, currentSelection: TimeSlot[]): boolean => {
    if (currentSelection.length <= 1) return true;
    
    const sortedSelection = [...currentSelection].sort((a, b) => a.start.localeCompare(b.start));
    const firstSlot = sortedSelection[0];
    const lastSlot = sortedSelection[sortedSelection.length - 1];
    
    // Can only remove from the ends to maintain consecutive chain
    return slot.start === firstSlot.start || slot.start === lastSlot.start;
  };

  const handleTimeSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    setBookingMessage(null);
    
    const isAlreadySelected = selectedSlots.some(s => s.start === slot.start);
    
    if (isAlreadySelected) {
      if (canRemoveSlot(slot, selectedSlots)) {
        setSelectedSlots(selectedSlots.filter(s => s.start !== slot.start));
      } else {
        setBookingMessage({ 
          type: 'error', 
          text: 'You can only deselect slots from the start or end of your selection.' 
        });
      }
    } else {
      if (isSlotConsecutive(slot, selectedSlots)) {
        setSelectedSlots([...selectedSlots, slot]);
      } else {
        setBookingMessage({ 
          type: 'error', 
          text: 'Please select consecutive time slots only.' 
        });
      }
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
    
    // Sort selected slots by start time
    const sortedSlots = [...selectedSlots].sort((a, b) => a.start.localeCompare(b.start));
    
    // Combine consecutive slots into a single booking
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    const totalHours = sortedSlots.length * 0.5; // Each slot is 30 minutes
    
    const booking = {
      ground_id: selectedGround,
      user_id: user.id,
      booking_date: formattedDate,
      start_time: firstSlot.start,
      end_time: lastSlot.end,
      hours: totalHours,
      total_amount: totalAmount,
      status: "pending" as const,
      payment_status: "unpaid" as const,
      created_at: new Date(requestTimestamp).toISOString(),
    };

    // Check for conflicts before inserting
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
        text: "❌ Slot is not available" 
      });
      fetchBookedSlots(selectedGround, new Date(selectedDate));
      return;
    }

    const { data: insertedBookings, error } = await supabase
      .from("bookings")
      .insert([booking])
      .select("id");

    setBookingLoading(false);

    if (error || !insertedBookings || insertedBookings.length === 0) {
      if (error?.code === '23505') { // Unique constraint violation
        setBookingMessage({ 
          type: 'error', 
          text: "❌ Slot is not available" 
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
      text: "📩 Request sent. Please check your My Bookings section." 
    });

    dispatch(clearSelection());
    setSelectedSlots([]);
    
    if (user) {
      fetchUserBookings(user.id);
    }
    
    // Refresh booked slots immediately
    if (selectedGround && selectedDate) {
      fetchBookedSlots(selectedGround, new Date(selectedDate));
    }
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;

    // Use edge function for proper validation
    const { data, error } = await supabase.functions.invoke('booking-actions', {
      body: { action: 'cancel', bookingId: bookingToCancel.id }
    });

    if (error || data?.error) {
      toast({
        title: "Error",
        description: data?.error || error?.message || "Failed to cancel booking",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled. The slot is now available for others.",
      });
      if (user) {
        fetchUserBookings(user.id);
      }
      // Immediately refresh booked slots so the slot becomes available
      if (selectedGround && selectedDate) {
        fetchBookedSlots(selectedGround, new Date(selectedDate));
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

      <div className="container mx-auto px-4 py-16 sm:py-20">
        {/* User Profile Header */}
        <Card className="mb-6 sm:mb-8">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg sm:text-xl font-semibold truncate">{profile?.full_name || "User"}</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{user?.email}</p>
                  {profile?.phone_number && (
                    <p className="text-xs text-muted-foreground">{profile.phone_number}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 sm:gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="text-xs sm:text-sm">
                  My Bookings
                </Button>
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs sm:text-sm">
                  <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Bookings */}
        {userBookings.length > 0 && (
          <Card className="mb-6 sm:mb-8">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Your Active Bookings</CardTitle>
              <CardDescription className="text-xs sm:text-sm">You can cancel or reschedule your bookings below</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="space-y-2 sm:space-y-3">
                {userBookings.map((booking) => (
                  <div key={booking.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-muted rounded-lg gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base truncate">{booking.ground_name}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {format(new Date(booking.booking_date), "PPP")} | {booking.start_time} - {booking.end_time}
                      </p>
                      <p className="text-xs sm:text-sm font-medium text-primary">₹{booking.total_amount}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs sm:text-sm"
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
                        className="text-xs sm:text-sm"
                        onClick={() => {
                          setBookingToCancel(booking);
                          setCancelDialogOpen(true);
                        }}
                      >
                        <X className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <h1 className="text-2xl sm:text-4xl font-bold text-center mb-6 sm:mb-8 text-primary">Book a Slot</h1>

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
          {/* Ground Selection */}
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5" /> Select Ground
            </h2>
            <div className="space-y-3 sm:space-y-4">
              {grounds.map((ground) => (
                <Card
                  key={ground.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedGround === ground.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleGroundSelect(ground.id)}
                >
                  <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
                    <CardTitle className="text-base sm:text-lg">{ground.name}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">{ground.location}</CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                    <div className="text-xs sm:text-sm text-muted-foreground">
                      {ground.name.toLowerCase().includes('day') ? (
                        <p>Day Slots (7AM - 6PM): <span className="font-bold text-primary">₹600/hr</span></p>
                      ) : (
                        <p>Night Slots (6PM - 11PM): <span className="font-bold text-primary">₹800/hr</span></p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Date Selection */}
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
              <CalendarIcon className="w-5 h-5" /> Select Date
            </h2>
            <Card>
              <CardContent className="p-2 sm:p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate ? new Date(selectedDate) : undefined}
                  onSelect={handleDateSelect}
                  disabled={(date) =>
                    isBefore(startOfDay(date), startOfDay(new Date())) ||
                    isBefore(addDays(new Date(), 30), date)
                  }
                  className="rounded-md w-full"
                />
              </CardContent>
            </Card>
          </div>

          {/* Time Slot Selection with Opacity Transition */}
          <div className={`transition-all duration-300 ease-in-out ${
            selectedGround && selectedDate ? 'opacity-100' : 'opacity-30 pointer-events-none'
          }`}>
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" /> Select Time
            </h2>
            <Card>
              <CardContent className="p-3 sm:p-4">
                {/* Legend */}
                <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-destructive rounded"></div>
                    <span>Pending</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-pink-500 rounded"></div>
                    <span>Booked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-primary rounded"></div>
                    <span>Your Booking</span>
                  </div>
                </div>

                {/* Time Slots Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {timeSlots.map((slot) => {
                    const isSelected = selectedSlots.some(s => s.start === slot.start);
                    const isBooked = !slot.available && !slot.isPast;
                    const isPending = isBooked && slot.status === "pending";
                    const isConfirmed = isBooked && (slot.status === "confirmed" || slot.status === "active");
                    
                    const getSlotClass = () => {
                      if (slot.isPast) return "bg-muted text-muted-foreground cursor-not-allowed opacity-50 line-through";
                      if (isPending) return "!bg-destructive !text-destructive-foreground cursor-not-allowed";
                      if (isConfirmed) return "!bg-pink-500 !text-white cursor-not-allowed";
                      if (isSelected) return "bg-primary text-primary-foreground";
                      return "bg-blue-500/10 border-2 border-blue-500 text-blue-700 hover:bg-blue-500/20";
                    };
                    
                    const handleSlotClick = () => {
                      if (isBooked) {
                        setBookingMessage({
                          type: 'error',
                          text: '❌ Slot is not available'
                        });
                        return;
                      }
                      if (slot.available && !slot.isPast) {
                        handleTimeSlotSelect(slot);
                      }
                    };
                    
                    return (
                      <Button
                        key={slot.start}
                        variant="ghost"
                        disabled={slot.isPast}
                        onClick={handleSlotClick}
                        className={`text-sm flex flex-col h-auto py-2 px-2 sm:px-3 transition-all duration-200 ${getSlotClass()}`}
                      >
                        <span className="font-medium text-xs sm:text-sm">{slot.start} - {slot.end}</span>
                        <span className="text-[10px] sm:text-xs opacity-90">
                          {slot.isPast ? "(Past)" : isBooked ? (isPending ? "Pending" : "Booked") : `₹${slot.price}`}
                        </span>
                      </Button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Booking Summary */}
        {selectedGround && selectedDate && selectedSlots.length > 0 && (() => {
          const sortedSlots = [...selectedSlots].sort((a, b) => a.start.localeCompare(b.start));
          const firstSlot = sortedSlots[0];
          const lastSlot = sortedSlots[sortedSlots.length - 1];
          const totalHours = sortedSlots.length * 0.5;
          
          return (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground">Ground</p>
                    <p className="font-semibold">{grounds.find(g => g.id === selectedGround)?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-semibold">{format(new Date(selectedDate), "PPP")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time</p>
                    <p className="font-semibold">{firstSlot.start} - {lastSlot.end}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-semibold">{totalHours} hour{totalHours !== 1 ? 's' : ''} ({sortedSlots.length} slot{sortedSlots.length > 1 ? 's' : ''})</p>
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
                  {bookingLoading ? "Booking..." : "Confirm Booking"}
                </Button>
              </CardContent>
            </Card>
          );
        })()}
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

export default UserBooking;
