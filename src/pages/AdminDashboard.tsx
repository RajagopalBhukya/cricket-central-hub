import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, isWithinInterval } from "date-fns";
import { 
  Users, Calendar, MapPin, DollarSign, Trash2, Edit, Plus, 
  LayoutDashboard, UserCog, CalendarDays, Settings, BarChart3,
  Search, Download, TrendingUp, TrendingDown, LogOut, Bell
} from "lucide-react";

interface User {
  id: string;
  full_name: string;
  phone_number: string;
  created_at: string;
}

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: "active" | "cancelled" | "completed" | "expired";
  payment_status: "paid" | "unpaid";
  total_amount: number;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  ground_name?: string;
  created_at?: string;
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

const AdminDashboard = () => {
  const [isAdmin, setIsAdmin] = useState(false);
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
  const [activeTab, setActiveTab] = useState("dashboard");
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

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
  const activeBookings = bookings.filter(b => b.status === "active");

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

  const updateBookingStatus = async (bookingId: string, status: "active" | "cancelled" | "completed" | "expired") => {
    const { error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", bookingId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Booking status updated" });
      fetchBookings();
    }
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
      <header className="bg-primary text-primary-foreground py-4 px-6 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8" />
            <div>
              <h1 className="text-xl font-bold">Box Cricket Admin</h1>
              <p className="text-xs opacity-80">Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-primary-foreground/20">
              <Bell className="w-5 h-5" />
            </Button>
            <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/20">
              <LogOut className="w-4 h-4 mr-2" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-card border-r min-h-[calc(100vh-73px)] p-4 hidden lg:block">
          <nav className="space-y-2">
            <Button
              variant={activeTab === "dashboard" ? "secondary" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("dashboard")}
            >
              <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
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
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Mobile Tab Navigation */}
          <div className="lg:hidden mb-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4" /></TabsTrigger>
                <TabsTrigger value="bookings"><CalendarDays className="w-4 h-4" /></TabsTrigger>
                <TabsTrigger value="users"><UserCog className="w-4 h-4" /></TabsTrigger>
                <TabsTrigger value="grounds"><MapPin className="w-4 h-4" /></TabsTrigger>
                <TabsTrigger value="reports"><BarChart3 className="w-4 h-4" /></TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Dashboard Overview</h2>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Users</p>
                        <p className="text-3xl font-bold">{users.length}</p>
                      </div>
                      <Users className="w-10 h-10 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Today's Bookings</p>
                        <p className="text-3xl font-bold">{todayBookings.length}</p>
                      </div>
                      <Calendar className="w-10 h-10 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Revenue</p>
                        <p className="text-3xl font-bold">₹{totalRevenue.toLocaleString()}</p>
                      </div>
                      <DollarSign className="w-10 h-10 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Grounds</p>
                        <p className="text-3xl font-bold">{grounds.filter(g => g.is_active).length}</p>
                      </div>
                      <MapPin className="w-10 h-10 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Secondary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Active Bookings</p>
                        <p className="text-2xl font-bold text-green-600">{activeBookings.length}</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Cancelled Bookings</p>
                        <p className="text-2xl font-bold text-red-600">{cancelledBookings.length}</p>
                      </div>
                      <TrendingDown className="w-8 h-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">This Month Revenue</p>
                        <p className="text-2xl font-bold text-primary">₹{thisMonthRevenue.toLocaleString()}</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-primary" />
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
                            <Badge className={
                              booking.status === "active" ? "bg-green-500" :
                              booking.status === "completed" ? "bg-blue-500" :
                              booking.status === "cancelled" ? "bg-red-500" : "bg-gray-500"
                            }>
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
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => deleteBooking(booking.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
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
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead>Total Bookings</TableHead>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
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
                      <span>Active Bookings</span>
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
