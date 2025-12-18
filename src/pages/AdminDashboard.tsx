import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, isWithinInterval, isBefore } from "date-fns";
import { 
  Users, Calendar as CalendarIcon, MapPin, DollarSign, Trash2, Edit, Plus, 
  LayoutDashboard, UserCog, CalendarDays, Settings, BarChart3,
  Search, Download, TrendingUp, TrendingDown, LogOut, Bell, Clock,
  CheckCircle, XCircle, Home
} from "lucide-react";

interface User {
  id: string;
  full_name: string;
  phone_number: string;
  created_at: string;
  email?: string;
}

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: "pending" | "confirmed" | "active" | "cancelled" | "completed" | "expired";
  payment_status: "paid" | "unpaid";
  total_amount: number;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  ground_name?: string;
  ground_id?: string;
  created_at?: string;
  booked_by?: string;
  confirmed_at?: string;
}

interface Ground {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  price_per_hour: number;
  is_active: boolean;
  image_url: string | null;
}

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
  isPast: boolean;
  price: number;
  status?: string;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  booking: Booking;
  read: boolean;
  timestamp: Date;
}

const AdminDashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingGround, setEditingGround] = useState<Ground | null>(null);
  const [newGround, setNewGround] = useState({
    name: "",
    description: "",
    location: "",
    price_per_hour: 500,
    image_url: "",
  });
  const [isAddGroundOpen, setIsAddGroundOpen] = useState(false);
  const [isEditGroundOpen, setIsEditGroundOpen] = useState(false);
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  
  // Admin booking state
  const [adminBookingGround, setAdminBookingGround] = useState<string>("");
  const [adminBookingDate, setAdminBookingDate] = useState<Date | undefined>(undefined);
  const [adminBookingSlots, setAdminBookingSlots] = useState<TimeSlot[]>([]);
  const [selectedAdminSlots, setSelectedAdminSlots] = useState<TimeSlot[]>([]);
  const [bookedSlotsForAdmin, setBookedSlotsForAdmin] = useState<{ start_time: string; end_time: string; status: string }[]>([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  // Real-time subscription for new bookings
  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('admin-booking-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bookings'
        },
        async (payload) => {
          console.log('New booking notification:', payload);
          const newBooking = payload.new as any;
          
          // Fetch user and ground details
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', newBooking.user_id)
            .single();
          
          const { data: ground } = await supabase
            .from('grounds')
            .select('name')
            .eq('id', newBooking.ground_id)
            .single();

          const notification: Notification = {
            id: newBooking.id,
            type: 'new_booking',
            message: `New booking from ${profile?.full_name || 'User'} for ${ground?.name || 'Ground'} on ${format(new Date(newBooking.booking_date), 'PPP')} at ${newBooking.start_time}`,
            booking: {
              ...newBooking,
              user_name: profile?.full_name || 'N/A',
              ground_name: ground?.name || 'N/A',
            },
            read: false,
            timestamp: new Date(),
          };

          setNotifications(prev => [notification, ...prev]);
          
          // Show toast notification
          toast({
            title: "New Booking Request!",
            description: notification.message,
          });

          // Refresh bookings
          fetchBookings();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings'
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  const checkAdminAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?mode=login");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
      navigate("/");
      return;
    }

    setIsAdmin(true);
    setAdminUserId(session.user.id);
    fetchAllData();
  };

  const fetchAllData = async () => {
    await Promise.all([fetchUsers(), fetchBookings(), fetchGrounds()]);
    setLoading(false);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setUsers(data);
  };

  const fetchBookings = async () => {
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("*")
      .order("booking_date", { ascending: false });

    if (bookingsData) {
      const userIds = [...new Set(bookingsData.map(b => b.user_id))];
      const groundIds = [...new Set(bookingsData.map(b => b.ground_id))];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number")
        .in("id", userIds);

      const { data: groundsData } = await supabase
        .from("grounds")
        .select("id, name")
        .in("id", groundIds);

      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const groundsMap = new Map(groundsData?.map(g => [g.id, g]) || []);

      const enrichedBookings: Booking[] = bookingsData.map(booking => ({
        ...booking,
        user_name: profilesMap.get(booking.user_id)?.full_name || "N/A",
        user_phone: profilesMap.get(booking.user_id)?.phone_number || "",
        ground_name: groundsMap.get(booking.ground_id)?.name || "N/A",
      }));

      setBookings(enrichedBookings);
    }
  };

  const fetchGrounds = async () => {
    const { data } = await supabase
      .from("grounds")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setGrounds(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  // Stats calculations
  const today = new Date();
  const todayBookings = bookings.filter(b => b.booking_date === format(today, "yyyy-MM-dd"));
  const thisMonthBookings = bookings.filter(b => {
    const bookingDate = new Date(b.booking_date);
    return isWithinInterval(bookingDate, { start: startOfMonth(today), end: endOfMonth(today) });
  });
  const totalRevenue = bookings.filter(b => b.payment_status === "paid").reduce((sum, b) => sum + b.total_amount, 0);
  const thisMonthRevenue = thisMonthBookings.filter(b => b.payment_status === "paid").reduce((sum, b) => sum + b.total_amount, 0);
  const cancelledBookings = bookings.filter(b => b.status === "cancelled");
  const activeBookings = bookings.filter(b => b.status === "active" || b.status === "confirmed");
  const pendingBookings = bookings.filter(b => b.status === "pending");

  // Filtered data
  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.phone_number.includes(searchQuery)
  );

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = 
      booking.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.ground_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesDate = true;
    if (dateFilter === "today") {
      matchesDate = booking.booking_date === format(today, "yyyy-MM-dd");
    } else if (dateFilter === "week") {
      const weekAgo = subDays(today, 7);
      matchesDate = isWithinInterval(new Date(booking.booking_date), { start: weekAgo, end: today });
    } else if (dateFilter === "month") {
      matchesDate = isWithinInterval(new Date(booking.booking_date), { start: startOfMonth(today), end: endOfMonth(today) });
    }

    const matchesStatus = statusFilter === "all" || booking.status === statusFilter;

    return matchesSearch && matchesDate && matchesStatus;
  });

  const updateBookingStatus = async (bookingId: string, status: "pending" | "confirmed" | "active" | "cancelled" | "completed" | "expired") => {
    const updateData: any = { status };
    
    if (status === "confirmed" && adminUserId) {
      updateData.confirmed_at = new Date().toISOString();
      updateData.confirmed_by = adminUserId;
    }

    const { error } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Booking status updated" });
      fetchBookings();
    }
  };

  const confirmBooking = async (bookingId: string) => {
    await updateBookingStatus(bookingId, "confirmed");
  };

  const rejectBooking = async (bookingId: string) => {
    await updateBookingStatus(bookingId, "cancelled");
  };

  const updatePaymentStatus = async (bookingId: string, payment_status: "paid" | "unpaid") => {
    const { error } = await supabase
      .from("bookings")
      .update({ payment_status })
      .eq("id", bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Payment status updated" });
      fetchBookings();
    }
  };

  const deleteBooking = async (bookingId: string) => {
    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Booking deleted" });
      fetchBookings();
    }
  };

  const addGround = async () => {
    const { error } = await supabase.from("grounds").insert({
      name: newGround.name,
      description: newGround.description,
      location: newGround.location,
      price_per_hour: newGround.price_per_hour,
      image_url: newGround.image_url || null,
      is_active: true,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Ground added successfully" });
      setNewGround({ name: "", description: "", location: "", price_per_hour: 500, image_url: "" });
      setIsAddGroundOpen(false);
      fetchGrounds();
    }
  };

  const updateGround = async () => {
    if (!editingGround) return;

    const { error } = await supabase
      .from("grounds")
      .update({
        name: editingGround.name,
        description: editingGround.description,
        location: editingGround.location,
        price_per_hour: editingGround.price_per_hour,
        is_active: editingGround.is_active,
        image_url: editingGround.image_url,
      })
      .eq("id", editingGround.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Ground updated successfully" });
      setIsEditGroundOpen(false);
      setEditingGround(null);
      fetchGrounds();
    }
  };

  const deleteGround = async (groundId: string) => {
    const { error } = await supabase
      .from("grounds")
      .delete()
      .eq("id", groundId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Ground deleted" });
      fetchGrounds();
    }
  };

  const toggleGroundStatus = async (groundId: string, is_active: boolean) => {
    const { error } = await supabase
      .from("grounds")
      .update({ is_active })
      .eq("id", groundId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: `Ground ${is_active ? "enabled" : "disabled"}` });
      fetchGrounds();
    }
  };

  const deleteUser = async (userId: string) => {
    // First delete user's bookings
    const { error: bookingsError } = await supabase
      .from("bookings")
      .delete()
      .eq("user_id", userId);

    if (bookingsError) {
      toast({ title: "Error", description: "Failed to delete user bookings", variant: "destructive" });
      return;
    }

    // Delete user roles
    const { error: rolesError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (rolesError) {
      toast({ title: "Error", description: "Failed to delete user roles", variant: "destructive" });
      return;
    }

    // Delete profile
    const { error: profileError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId);

    if (profileError) {
      toast({ title: "Error", description: profileError.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "User and all their data deleted successfully" });
      setIsDeleteUserOpen(false);
      setUserToDelete(null);
      fetchAllData();
    }
  };

  // Admin booking functions
  const fetchBookedSlotsForAdmin = async (groundId: string, date: Date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    const { data, error } = await supabase
      .from("bookings")
      .select("start_time, end_time, status")
      .eq("ground_id", groundId)
      .eq("booking_date", formattedDate)
      .in("status", ["pending", "confirmed", "active", "completed"]);

    if (!error && data) {
      setBookedSlotsForAdmin(data);
    }
  };

  useEffect(() => {
    if (adminBookingGround && adminBookingDate) {
      fetchBookedSlotsForAdmin(adminBookingGround, adminBookingDate);
    }
  }, [adminBookingGround, adminBookingDate]);

  const isDayGround = useCallback((groundId: string): boolean => {
    const ground = grounds.find(g => g.id === groundId);
    return ground?.name?.toLowerCase().includes('day') ?? false;
  }, [grounds]);

  const generateAdminTimeSlots = useCallback((): TimeSlot[] => {
    if (!adminBookingGround || !adminBookingDate) return [];
    
    const slots: TimeSlot[] = [];
    const now = new Date();
    const isToday = format(adminBookingDate, "yyyy-MM-dd") === format(now, "yyyy-MM-dd");
    const currentHour = now.getHours();

    const isDay = isDayGround(adminBookingGround);
    const startHour = isDay ? 7 : 18;
    const endHour = isDay ? 18 : 23;
    const price = isDay ? 600 : 800;

    for (let hour = startHour; hour < endHour; hour++) {
      const start = `${hour.toString().padStart(2, "0")}:00`;
      const end = `${(hour + 1).toString().padStart(2, "0")}:00`;
      const bookedSlot = bookedSlotsForAdmin.find(
        (slot) => slot.start_time === start || (slot.start_time < end && slot.end_time > start)
      );
      const isBooked = !!bookedSlot;
      const isPast = isToday && hour <= currentHour;
      slots.push({ 
        start, 
        end, 
        available: !isBooked && !isPast, 
        isPast, 
        price,
        status: bookedSlot?.status 
      });
    }
    return slots;
  }, [adminBookingDate, adminBookingGround, bookedSlotsForAdmin, isDayGround]);

  useEffect(() => {
    setAdminBookingSlots(generateAdminTimeSlots());
  }, [generateAdminTimeSlots]);

  const handleAdminSlotSelect = (slot: TimeSlot) => {
    if (!slot.available) return;
    
    const isAlreadySelected = selectedAdminSlots.some(s => s.start === slot.start);
    
    if (isAlreadySelected) {
      setSelectedAdminSlots(selectedAdminSlots.filter(s => s.start !== slot.start));
    } else {
      setSelectedAdminSlots([...selectedAdminSlots, slot]);
    }
  };

  const handleAdminBooking = async () => {
    if (!adminBookingGround || !adminBookingDate || selectedAdminSlots.length === 0 || !adminUserId) {
      toast({
        title: "Error",
        description: "Please select ground, date and time slots",
        variant: "destructive",
      });
      return;
    }

    const formattedDate = format(adminBookingDate, "yyyy-MM-dd");
    
    // Admin bookings are auto-confirmed
    const bookingsToInsert = selectedAdminSlots.map(slot => ({
      ground_id: adminBookingGround,
      user_id: adminUserId,
      booking_date: formattedDate,
      start_time: slot.start,
      end_time: slot.end,
      hours: 1,
      total_amount: slot.price,
      status: "confirmed" as const,
      payment_status: "unpaid" as const,
      booked_by: "admin",
      confirmed_at: new Date().toISOString(),
      confirmed_by: adminUserId,
    }));

    // Check for conflicts
    for (const booking of bookingsToInsert) {
      const { data: conflict } = await supabase.rpc('check_booking_conflict', {
        _ground_id: booking.ground_id,
        _booking_date: booking.booking_date,
        _start_time: booking.start_time,
        _end_time: booking.end_time,
      });

      if (conflict) {
        toast({
          title: "Conflict",
          description: "One or more slots are already booked",
          variant: "destructive",
        });
        fetchBookedSlotsForAdmin(adminBookingGround, adminBookingDate);
        return;
      }
    }

    const { error } = await supabase.from("bookings").insert(bookingsToInsert);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Booking created successfully" });
      setSelectedAdminSlots([]);
      fetchBookedSlotsForAdmin(adminBookingGround, adminBookingDate);
      fetchBookings();
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-red-500 hover:bg-red-600";
      case "confirmed": return "bg-green-500 hover:bg-green-600";
      case "active": return "bg-green-500 hover:bg-green-600";
      case "completed": return "bg-blue-500 hover:bg-blue-600";
      case "cancelled": return "bg-gray-500 hover:bg-gray-600";
      default: return "bg-gray-500 hover:bg-gray-600";
    }
  };

  const getSlotColor = (slot: TimeSlot) => {
    if (slot.isPast) return "bg-gray-200 text-gray-400 cursor-not-allowed";
    if (!slot.available) {
      if (slot.status === "pending") return "bg-red-500 text-white cursor-not-allowed";
      if (slot.status === "confirmed" || slot.status === "active") return "bg-green-500 text-white cursor-not-allowed";
      return "bg-gray-300 text-gray-500 cursor-not-allowed";
    }
    return "bg-white border-2 border-primary hover:bg-primary/10 cursor-pointer";
  };

  const unreadNotifications = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="bg-primary text-primary-foreground py-3 px-3 sm:py-4 sm:px-6 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <LayoutDashboard className="w-6 h-6 sm:w-8 sm:h-8" />
            <div>
              <h1 className="text-base sm:text-xl font-bold">Box Cricket Admin</h1>
              <p className="text-[10px] sm:text-xs opacity-80 hidden sm:block">Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-primary-foreground hover:bg-primary-foreground/20 h-8 w-8 sm:h-10 sm:w-10"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                    {unreadNotifications}
                  </span>
                )}
              </Button>
              
              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-card rounded-lg shadow-lg border z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b">
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">Notifications</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 10).map((notification) => (
                      <div 
                        key={notification.id} 
                        className={`p-3 border-b hover:bg-muted cursor-pointer ${!notification.read ? 'bg-primary/5' : ''}`}
                        onClick={() => {
                          setNotifications(prev => 
                            prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
                          );
                          setActiveTab("pending");
                          setShowNotifications(false);
                        }}
                      >
                        <p className="text-xs sm:text-sm text-foreground">{notification.message}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                          {format(notification.timestamp, 'PPp')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/20 h-8 px-2 sm:h-10 sm:px-4 text-xs sm:text-sm">
              <LogOut className="w-4 h-4 sm:mr-2" /> 
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Hidden on mobile */}
        <aside className="w-64 bg-card border-r min-h-[calc(100vh-56px)] sm:min-h-[calc(100vh-73px)] p-4 hidden lg:block">
          <nav className="space-y-2">
            <Button
              variant={activeTab === "dashboard" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("dashboard")}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
            </Button>
            <Button
              variant={activeTab === "pending" ? "secondary" : "ghost"}
              className="w-full justify-start relative"
              onClick={() => setActiveTab("pending")}
            >
              <Clock className="w-4 h-4 mr-2" /> Pending Approvals
              {pendingBookings.length > 0 && (
                <Badge className="ml-auto bg-destructive">{pendingBookings.length}</Badge>
              )}
            </Button>
            <Button
              variant={activeTab === "admin-booking" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("admin-booking")}
            >
              <CalendarIcon className="w-4 h-4 mr-2" /> Book Slot
            </Button>
            <Button
              variant={activeTab === "bookings" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("bookings")}
            >
              <CalendarDays className="w-4 h-4 mr-2" /> Bookings
            </Button>
            <Button
              variant={activeTab === "users" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("users")}
            >
              <UserCog className="w-4 h-4 mr-2" /> Users
            </Button>
            <Button
              variant={activeTab === "grounds" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("grounds")}
            >
              <MapPin className="w-4 h-4 mr-2" /> Grounds
            </Button>
            <Button
              variant={activeTab === "reports" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("reports")}
            >
              <BarChart3 className="w-4 h-4 mr-2" /> Reports
            </Button>
            <div className="pt-4 border-t mt-4">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => navigate("/dashboard")}
              >
                <Home className="w-4 h-4 mr-2" /> User Dashboard
              </Button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-3 sm:p-6 overflow-x-hidden">
          {/* Mobile Tab Navigation - Horizontal scroll */}
          <div className="lg:hidden mb-4 sm:mb-6 -mx-3 px-3 overflow-x-auto">
            <div className="flex gap-1 min-w-max pb-2">
              <Button
                variant={activeTab === "dashboard" ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0"
                onClick={() => setActiveTab("dashboard")}
              >
                <LayoutDashboard className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTab === "pending" ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0 relative"
                onClick={() => setActiveTab("pending")}
              >
                <Clock className="w-4 h-4" />
                {pendingBookings.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                    {pendingBookings.length}
                  </span>
                )}
              </Button>
              <Button
                variant={activeTab === "admin-booking" ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0"
                onClick={() => setActiveTab("admin-booking")}
              >
                <CalendarIcon className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTab === "bookings" ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0"
                onClick={() => setActiveTab("bookings")}
              >
                <CalendarDays className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTab === "users" ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0"
                onClick={() => setActiveTab("users")}
              >
                <UserCog className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTab === "grounds" ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0"
                onClick={() => setActiveTab("grounds")}
              >
                <MapPin className="w-4 h-4" />
              </Button>
              <Button
                variant={activeTab === "reports" ? "default" : "outline"}
                size="sm"
                className="flex-shrink-0"
                onClick={() => setActiveTab("reports")}
              >
                <BarChart3 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="space-y-4 sm:space-y-6">
              <h2 className="text-xl sm:text-2xl font-bold">Dashboard Overview</h2>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <Card>
                  <CardContent className="p-3 sm:pt-6 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Total Users</p>
                        <p className="text-xl sm:text-3xl font-bold">{users.length}</p>
                      </div>
                      <Users className="w-6 h-6 sm:w-10 sm:h-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 sm:pt-6 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Today's Bookings</p>
                        <p className="text-xl sm:text-3xl font-bold">{todayBookings.length}</p>
                      </div>
                      <CalendarIcon className="w-6 h-6 sm:w-10 sm:h-10 text-primary" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 sm:pt-6 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-lg sm:text-3xl font-bold">₹{totalRevenue.toLocaleString()}</p>
                      </div>
                      <DollarSign className="w-6 h-6 sm:w-10 sm:h-10 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card className={pendingBookings.length > 0 ? "border-destructive border-2" : ""}>
                  <CardContent className="p-3 sm:pt-6 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                        <p className="text-xl sm:text-3xl font-bold text-destructive">{pendingBookings.length}</p>
                      </div>
                      <Clock className="w-6 h-6 sm:w-10 sm:h-10 text-destructive" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                <Card>
                  <CardContent className="p-3 sm:pt-6 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Confirmed Bookings</p>
                        <p className="text-lg sm:text-2xl font-bold text-primary">{activeBookings.length}</p>
                      </div>
                      <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 sm:pt-6 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Cancelled Bookings</p>
                        <p className="text-lg sm:text-2xl font-bold text-destructive">{cancelledBookings.length}</p>
                      </div>
                      <TrendingDown className="w-6 h-6 sm:w-8 sm:h-8 text-destructive" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3 sm:pt-6 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">This Month Revenue</p>
                        <p className="text-lg sm:text-2xl font-bold text-primary">₹{thisMonthRevenue.toLocaleString()}</p>
                      </div>
                      <DollarSign className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Bookings */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Bookings</CardTitle>
                  <CardDescription>Latest 5 bookings</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Ground</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.slice(0, 5).map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>{booking.user_name}</TableCell>
                          <TableCell>{booking.ground_name}</TableCell>
                          <TableCell>{format(new Date(booking.booking_date), "PP")}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadgeColor(booking.status)}>
                              {booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell>₹{booking.total_amount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pending Approvals Tab */}
          {activeTab === "pending" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Pending Booking Approvals</h2>
              
              {pendingBookings.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">No pending bookings to approve</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {pendingBookings.map((booking) => (
                    <Card key={booking.id} className="border-red-200 border-2">
                      <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-red-500">PENDING</Badge>
                              <span className="text-sm text-muted-foreground">
                                {booking.created_at && format(new Date(booking.created_at), 'PPp')}
                              </span>
                            </div>
                            <h3 className="text-lg font-semibold">{booking.user_name}</h3>
                            <p className="text-muted-foreground">{booking.user_phone}</p>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span>{booking.ground_name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <CalendarIcon className="w-4 h-4" />
                                <span>{format(new Date(booking.booking_date), 'PPP')}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>{booking.start_time} - {booking.end_time}</span>
                              </div>
                            </div>
                            <p className="font-bold text-primary mt-2">₹{booking.total_amount}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => confirmBooking(booking.id)}
                              className="bg-green-500 hover:bg-green-600"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" /> Confirm
                            </Button>
                            <Button 
                              variant="destructive"
                              onClick={() => rejectBooking(booking.id)}
                            >
                              <XCircle className="w-4 h-4 mr-2" /> Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Admin Booking Tab */}
          {activeTab === "admin-booking" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Book Slot (Admin)</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Select Ground</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-2">
                      {grounds.filter(g => g.is_active).map((ground) => (
                        <Button
                          key={ground.id}
                          variant={adminBookingGround === ground.id ? "default" : "outline"}
                          className="justify-start h-auto py-3"
                          onClick={() => {
                            setAdminBookingGround(ground.id);
                            setSelectedAdminSlots([]);
                          }}
                        >
                          <div className="text-left">
                            <p className="font-medium">{ground.name}</p>
                            <p className="text-xs opacity-70">{ground.location} • ₹{ground.price_per_hour}/hr</p>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Select Date</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      selected={adminBookingDate}
                      onSelect={(date) => {
                        setAdminBookingDate(date);
                        setSelectedAdminSlots([]);
                      }}
                      disabled={(date) => isBefore(date, startOfDay(new Date()))}
                      className="rounded-md border"
                    />
                  </CardContent>
                </Card>
              </div>

              {adminBookingGround && adminBookingDate && (
                <Card>
                  <CardHeader>
                    <CardTitle>Select Time Slots</CardTitle>
                    <CardDescription>
                      <div className="flex gap-4 mt-2">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-500 rounded"></div>
                          <span className="text-sm">Pending</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-500 rounded"></div>
                          <span className="text-sm">Confirmed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-primary rounded"></div>
                          <span className="text-sm">Available</span>
                        </div>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2">
                      {adminBookingSlots.map((slot) => (
                        <Button
                          key={slot.start}
                          variant="outline"
                          className={`${getSlotColor(slot)} ${
                            selectedAdminSlots.some(s => s.start === slot.start) 
                              ? 'ring-2 ring-primary bg-primary text-primary-foreground' 
                              : ''
                          }`}
                          onClick={() => handleAdminSlotSelect(slot)}
                          disabled={!slot.available}
                        >
                          <div className="text-center">
                            <p className="text-sm font-medium">{slot.start}</p>
                            <p className="text-xs">₹{slot.price}</p>
                          </div>
                        </Button>
                      ))}
                    </div>

                    {selectedAdminSlots.length > 0 && (
                      <div className="mt-6 p-4 bg-muted rounded-lg">
                        <h4 className="font-semibold mb-2">Booking Summary</h4>
                        <p>Selected Slots: {selectedAdminSlots.length}</p>
                        <p>Total: ₹{selectedAdminSlots.reduce((sum, s) => sum + s.price, 0)}</p>
                        <Button 
                          className="mt-4 w-full" 
                          onClick={handleAdminBooking}
                        >
                          Confirm Admin Booking
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Bookings Tab */}
          {activeTab === "bookings" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold">Manage Bookings</h2>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search bookings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-48"
                    />
                  </div>
                  <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Date" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Dates</SelectItem>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Ground</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Payment</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBookings.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{booking.user_name}</p>
                                <p className="text-xs text-muted-foreground">{booking.user_phone}</p>
                                {booking.booked_by === "admin" && (
                                  <Badge variant="outline" className="text-xs">Admin</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{booking.ground_name}</TableCell>
                            <TableCell>{format(new Date(booking.booking_date), "PP")}</TableCell>
                            <TableCell>{booking.start_time} - {booking.end_time}</TableCell>
                            <TableCell>₹{booking.total_amount}</TableCell>
                            <TableCell>
                              <Select
                                value={booking.status}
                                onValueChange={(value) => updateBookingStatus(booking.id, value as any)}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="active">Active</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={booking.payment_status}
                                onValueChange={(value) => updatePaymentStatus(booking.id, value as any)}
                              >
                                <SelectTrigger className="w-24">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unpaid">Unpaid</SelectItem>
                                  <SelectItem value="paid">Paid</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {booking.status === "pending" && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-green-500 hover:bg-green-600"
                                      onClick={() => confirmBooking(booking.id)}
                                    >
                                      <CheckCircle className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => rejectBooking(booking.id)}
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => deleteBooking(booking.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Manage Users</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-64"
                  />
                </div>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Joined</TableHead>
                          <TableHead>Total Bookings</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">{user.full_name}</TableCell>
                            <TableCell>{user.phone_number}</TableCell>
                            <TableCell>{format(new Date(user.created_at), "PPP")}</TableCell>
                            <TableCell>
                              {bookings.filter(b => b.user_id === user.id).length}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setUserToDelete(user);
                                  setIsDeleteUserOpen(true);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-1" /> Delete
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Delete User Confirmation Dialog */}
              <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete User</DialogTitle>
                  </DialogHeader>
                  <p className="text-muted-foreground">
                    Are you sure you want to delete user <strong>{userToDelete?.full_name}</strong>? 
                    This will also delete all their bookings and cannot be undone.
                  </p>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDeleteUserOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      variant="destructive" 
                      onClick={() => userToDelete && deleteUser(userToDelete.id)}
                    >
                      Delete User
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Grounds Tab */}
          {activeTab === "grounds" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Manage Grounds</h2>
                <Dialog open={isAddGroundOpen} onOpenChange={setIsAddGroundOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" /> Add Ground
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Ground</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={newGround.name}
                          onChange={(e) => setNewGround({ ...newGround, name: e.target.value })}
                          placeholder="Ground name"
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={newGround.description}
                          onChange={(e) => setNewGround({ ...newGround, description: e.target.value })}
                          placeholder="Description"
                        />
                      </div>
                      <div>
                        <Label>Location</Label>
                        <Input
                          value={newGround.location}
                          onChange={(e) => setNewGround({ ...newGround, location: e.target.value })}
                          placeholder="Address"
                        />
                      </div>
                      <div>
                        <Label>Price per Hour (₹)</Label>
                        <Input
                          type="number"
                          value={newGround.price_per_hour}
                          onChange={(e) => setNewGround({ ...newGround, price_per_hour: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Image URL</Label>
                        <Input
                          value={newGround.image_url}
                          onChange={(e) => setNewGround({ ...newGround, image_url: e.target.value })}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsAddGroundOpen(false)}>Cancel</Button>
                      <Button onClick={addGround}>Add Ground</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {grounds.map((ground) => (
                  <Card key={ground.id} className={!ground.is_active ? "opacity-60" : ""}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{ground.name}</span>
                        <Switch
                          checked={ground.is_active}
                          onCheckedChange={(checked) => toggleGroundStatus(ground.id, checked)}
                        />
                      </CardTitle>
                      <CardDescription>{ground.location}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">{ground.description}</p>
                      <p className="font-bold text-primary">₹{ground.price_per_hour}/hour</p>
                      <div className="flex gap-2 mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingGround(ground);
                            setIsEditGroundOpen(true);
                          }}
                        >
                          <Edit className="w-4 h-4 mr-1" /> Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteGround(ground.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Edit Ground Dialog */}
              <Dialog open={isEditGroundOpen} onOpenChange={setIsEditGroundOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Edit Ground</DialogTitle>
                  </DialogHeader>
                  {editingGround && (
                    <div className="space-y-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={editingGround.name}
                          onChange={(e) => setEditingGround({ ...editingGround, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={editingGround.description || ""}
                          onChange={(e) => setEditingGround({ ...editingGround, description: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Location</Label>
                        <Input
                          value={editingGround.location || ""}
                          onChange={(e) => setEditingGround({ ...editingGround, location: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Price per Hour (₹)</Label>
                        <Input
                          type="number"
                          value={editingGround.price_per_hour}
                          onChange={(e) => setEditingGround({ ...editingGround, price_per_hour: parseInt(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Image URL</Label>
                        <Input
                          value={editingGround.image_url || ""}
                          onChange={(e) => setEditingGround({ ...editingGround, image_url: e.target.value })}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editingGround.is_active}
                          onCheckedChange={(checked) => setEditingGround({ ...editingGround, is_active: checked })}
                        />
                        <Label>Active</Label>
                      </div>
                    </div>
                  )}
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsEditGroundOpen(false)}>Cancel</Button>
                    <Button onClick={updateGround}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Reports & Analytics</h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Booking Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Total Bookings</span>
                      <span className="font-bold">{bookings.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Pending Bookings</span>
                      <span className="font-bold text-red-600">{pendingBookings.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Confirmed Bookings</span>
                      <span className="font-bold text-green-600">{activeBookings.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Completed Bookings</span>
                      <span className="font-bold text-blue-600">{bookings.filter(b => b.status === "completed").length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Cancelled Bookings</span>
                      <span className="font-bold text-red-600">{cancelledBookings.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span>This Month Bookings</span>
                      <span className="font-bold">{thisMonthBookings.length}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Total Revenue</span>
                      <span className="font-bold text-primary">₹{totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>This Month Revenue</span>
                      <span className="font-bold">₹{thisMonthRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Pending Payments</span>
                      <span className="font-bold text-yellow-600">
                        ₹{bookings.filter(b => b.payment_status === "unpaid" && b.status !== "cancelled").reduce((sum, b) => sum + b.total_amount, 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span>Average Booking Value</span>
                      <span className="font-bold">
                        ₹{bookings.length > 0 ? Math.round(totalRevenue / bookings.filter(b => b.payment_status === "paid").length || 0) : 0}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Ground Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {grounds.map((ground) => {
                        const groundBookings = bookings.filter(b => b.ground_name === ground.name);
                        const groundRevenue = groundBookings.filter(b => b.payment_status === "paid").reduce((sum, b) => sum + b.total_amount, 0);
                        return (
                          <div key={ground.id} className="flex justify-between items-center py-2 border-b">
                            <div>
                              <p className="font-medium">{ground.name}</p>
                              <p className="text-xs text-muted-foreground">{groundBookings.length} bookings</p>
                            </div>
                            <span className="font-bold">₹{groundRevenue.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Total Users</span>
                      <span className="font-bold">{users.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Users with Bookings</span>
                      <span className="font-bold">{new Set(bookings.map(b => b.user_id)).size}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span>New Users This Month</span>
                      <span className="font-bold">
                        {users.filter(u => isWithinInterval(new Date(u.created_at), { start: startOfMonth(today), end: endOfMonth(today) })).length}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
