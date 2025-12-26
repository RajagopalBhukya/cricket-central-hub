import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Users, Calendar, MapPin, Settings, Trash2, Edit, Plus } from "lucide-react";

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
  status: "pending" | "confirmed" | "active" | "cancelled" | "completed" | "expired" | "rejected";
  payment_status: "paid" | "unpaid";
  total_amount: number;
  user_id: string;
  user_name?: string;
  user_phone?: string;
  ground_name?: string;
  booked_by?: string;
}

interface Ground {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  price_per_hour: number;
  is_active: boolean;
}

const Admin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [grounds, setGrounds] = useState<Ground[]>([]);
  const [editingGround, setEditingGround] = useState<Ground | null>(null);
  const [newGround, setNewGround] = useState({
    name: "",
    description: "",
    location: "",
    price_per_hour: 500,
  });
  const [isAddGroundOpen, setIsAddGroundOpen] = useState(false);
  const [isEditGroundOpen, setIsEditGroundOpen] = useState(false);
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
      // Fetch profiles and grounds data separately
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

  const updateBookingStatus = async (bookingId: string, status: "pending" | "confirmed" | "active" | "cancelled" | "completed" | "expired" | "rejected") => {
    // Use edge function for confirm/reject actions
    if (status === "confirmed" || status === "rejected") {
      const action = status === "confirmed" ? "confirm" : "reject";
      const { data, error } = await supabase.functions.invoke('booking-actions', {
        body: { action, bookingId }
      });

      if (error || data?.error) {
        toast({ 
          title: "Error", 
          description: data?.error || error?.message || `Failed to ${action} booking`, 
          variant: "destructive" 
        });
        return;
      }
      
      toast({ 
        title: "Success", 
        description: status === "confirmed" 
          ? "Booking confirmed. Slot is now locked." 
          : "Booking rejected. Slot is now available." 
      });
      fetchBookings();
      return;
    }

    // Direct update for other status changes
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
      is_active: true,
    });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Ground added successfully" });
      setNewGround({ name: "", description: "", location: "", price_per_hour: 500 });
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-red-500";
      case "confirmed": return "bg-green-500";
      case "active": return "bg-green-500";
      case "completed": return "bg-blue-500";
      case "cancelled": return "bg-gray-500";
      case "rejected": return "bg-orange-500";
      default: return "bg-gray-500";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <p>Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold text-center mb-8 text-primary">Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-3xl font-bold">{users.length}</p>
                </div>
                <Users className="w-10 h-10 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Bookings</p>
                  <p className="text-3xl font-bold">{bookings.length}</p>
                </div>
                <Calendar className="w-10 h-10 text-primary" />
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
                <MapPin className="w-10 h-10 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold">
                    ₹{bookings.filter(b => b.payment_status === "paid").reduce((sum, b) => sum + b.total_amount, 0)}
                  </p>
                </div>
                <Settings className="w-10 h-10 text-primary" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="bookings" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="grounds">Grounds</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Bookings</CardTitle>
              </CardHeader>
              <CardContent>
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
                      {bookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{booking.user_name || "N/A"}</p>
                              <p className="text-sm text-muted-foreground">{booking.user_phone}</p>
                            </div>
                          </TableCell>
                          <TableCell>{booking.ground_name || "N/A"}</TableCell>
                          <TableCell>{format(new Date(booking.booking_date), "PP")}</TableCell>
                          <TableCell>{booking.start_time} - {booking.end_time}</TableCell>
                          <TableCell>₹{booking.total_amount}</TableCell>
                          <TableCell>
                            <Select
                              value={booking.status}
                              onValueChange={(value) => updateBookingStatus(booking.id, value as "pending" | "confirmed" | "active" | "cancelled" | "completed" | "expired" | "rejected")}
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
                                <SelectItem value="rejected">Rejected</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={booking.payment_status}
                              onValueChange={(value) => updatePaymentStatus(booking.id, value as "paid" | "unpaid")}
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
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Users</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.full_name}</TableCell>
                        <TableCell>{user.phone_number}</TableCell>
                        <TableCell>{format(new Date(user.created_at), "PPP")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grounds" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>All Grounds</CardTitle>
                <Dialog open={isAddGroundOpen} onOpenChange={setIsAddGroundOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="w-4 h-4 mr-2" /> Add Ground
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Ground</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Name</Label>
                        <Input
                          value={newGround.name}
                          onChange={(e) => setNewGround({ ...newGround, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input
                          value={newGround.description}
                          onChange={(e) => setNewGround({ ...newGround, description: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Location</Label>
                        <Input
                          value={newGround.location}
                          onChange={(e) => setNewGround({ ...newGround, location: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Price per Hour (₹)</Label>
                        <Input
                          type="number"
                          value={newGround.price_per_hour}
                          onChange={(e) => setNewGround({ ...newGround, price_per_hour: Number(e.target.value) })}
                        />
                      </div>
                      <Button onClick={addGround} className="w-full">Add Ground</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Price/Hour</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grounds.map((ground) => (
                      <TableRow key={ground.id}>
                        <TableCell className="font-medium">{ground.name}</TableCell>
                        <TableCell>{ground.location}</TableCell>
                        <TableCell>₹{ground.price_per_hour}</TableCell>
                        <TableCell>
                          <Badge className={ground.is_active ? "bg-green-500" : "bg-red-500"}>
                            {ground.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="space-x-2">
                          <Dialog open={isEditGroundOpen && editingGround?.id === ground.id} onOpenChange={(open) => {
                            setIsEditGroundOpen(open);
                            if (!open) setEditingGround(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingGround(ground)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
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
                                    <Input
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
                                      onChange={(e) => setEditingGround({ ...editingGround, price_per_hour: Number(e.target.value) })}
                                    />
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Label>Active</Label>
                                    <input
                                      type="checkbox"
                                      checked={editingGround.is_active}
                                      onChange={(e) => setEditingGround({ ...editingGround, is_active: e.target.checked })}
                                    />
                                  </div>
                                  <Button onClick={updateGround} className="w-full">Update Ground</Button>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteGround(ground.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <footer className="bg-card border-t border-border py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Box Cricket. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Admin;