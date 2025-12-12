import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import { toast } from "@/hooks/use-toast";
import { format, isBefore, parseISO } from "date-fns";
import { Calendar, Clock, MapPin, User, Phone, Mail, Edit, X } from "lucide-react";

interface Booking {
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
}

interface Profile {
  id: string;
  full_name: string;
  phone_number: string;
}

const UserDashboard = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [newEmail, setNewEmail] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editEmailOpen, setEditEmailOpen] = useState(false);
  const [editedProfile, setEditedProfile] = useState({ full_name: "", phone_number: "" });
  const navigate = useNavigate();

  useEffect(() => {
    checkUserAndFetchData();
  }, []);

  const checkUserAndFetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth?mode=login");
      return;
    }

    setUserEmail(session.user.email || "");

    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (profileData) {
      setProfile(profileData);
      setEditedProfile({
        full_name: profileData.full_name,
        phone_number: profileData.phone_number,
      });
    }

    // Fetch bookings
    const { data: bookingsData, error } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        start_time,
        end_time,
        status,
        payment_status,
        total_amount,
        grounds (
          name,
          location
        )
      `)
      .eq("user_id", session.user.id)
      .order("booking_date", { ascending: false });

    if (!error && bookingsData) {
      setBookings(bookingsData as any);
    }
    setLoading(false);
  };

  const handleCancelBooking = async () => {
    if (!selectedBookingId) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", selectedBookingId);

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
      checkUserAndFetchData();
    }
    setCancelDialogOpen(false);
    setSelectedBookingId(null);
  };

  const handleUpdateProfile = async () => {
    if (!profile) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editedProfile.full_name,
        phone_number: editedProfile.phone_number,
      })
      .eq("id", profile.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setProfile({ ...profile, ...editedProfile });
      setEditProfileOpen(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === userEmail) {
      toast({
        title: "No Changes",
        description: "Please enter a different email address.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase.auth.updateUser({ email: newEmail });

    if (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update email. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email Update Initiated",
        description: "Please check your new email for a confirmation link.",
      });
      setEditEmailOpen(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "completed":
        return "bg-blue-500";
      case "cancelled":
        return "bg-red-500";
      case "expired":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  const canCancelBooking = (booking: Booking) => {
    if (booking.status !== "active") return false;
    const bookingDateTime = parseISO(`${booking.booking_date}T${booking.start_time}`);
    return !isBefore(bookingDateTime, new Date());
  };

  const upcomingBookings = bookings.filter(
    (b) => b.status === "active" && !isBefore(parseISO(`${b.booking_date}T${b.start_time}`), new Date())
  );

  const completedBookings = bookings.filter(
    (b) => b.status === "completed" || (b.status === "active" && isBefore(parseISO(`${b.booking_date}T${b.end_time}`), new Date()))
  );

  const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-20">
        <h1 className="text-4xl font-bold text-center mb-8">My Dashboard</h1>

        {/* Profile Card */}
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Manage your account details</CardDescription>
            </div>
            <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input
                      value={editedProfile.full_name}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, full_name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>Phone Number</Label>
                    <Input
                      value={editedProfile.phone_number}
                      onChange={(e) =>
                        setEditedProfile({ ...editedProfile, phone_number: e.target.value })
                      }
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditProfileOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateProfile}>Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{profile?.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{profile?.phone_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{userEmail}</p>
                    <Dialog open={editEmailOpen} onOpenChange={setEditEmailOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2">
                          <Edit className="w-3 h-3" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Update Email Address</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label>Current Email</Label>
                            <Input value={userEmail} disabled />
                          </div>
                          <div>
                            <Label>New Email Address</Label>
                            <Input
                              type="email"
                              value={newEmail}
                              onChange={(e) => setNewEmail(e.target.value)}
                              placeholder="Enter new email"
                            />
                          </div>
                          <p className="text-sm text-muted-foreground">
                            A confirmation link will be sent to your new email address.
                          </p>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditEmailOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={handleUpdateEmail}>Update Email</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-primary">{upcomingBookings.length}</p>
              <p className="text-sm text-muted-foreground">Upcoming Bookings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-blue-500">{completedBookings.length}</p>
              <p className="text-sm text-muted-foreground">Completed Bookings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold text-red-500">{cancelledBookings.length}</p>
              <p className="text-sm text-muted-foreground">Cancelled Bookings</p>
            </CardContent>
          </Card>
        </div>

        {/* Bookings Tabs */}
        <Tabs defaultValue="upcoming" className="max-w-6xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">Upcoming ({upcomingBookings.length})</TabsTrigger>
            <TabsTrigger value="completed">History ({completedBookings.length})</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled ({cancelledBookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-6">
            {upcomingBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">No upcoming bookings</p>
                  <Link to="/booking">
                    <Button>Book Now</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingBookings.map((booking) => (
                  <Card key={booking.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span>{booking.grounds.name}</span>
                        <Badge className={getStatusColor(booking.status)}>
                          {booking.status}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mr-2" />
                        {booking.grounds.location}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-2" />
                        {format(new Date(booking.booking_date), "PPP")}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-2" />
                        {booking.start_time} - {booking.end_time}
                      </div>
                      <div className="pt-2 border-t flex justify-between items-center">
                        <span className="font-bold text-primary">₹{booking.total_amount}</span>
                        {canCancelBooking(booking) && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedBookingId(booking.id);
                              setCancelDialogOpen(true);
                            }}
                          >
                            <X className="w-4 h-4 mr-1" /> Cancel
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {completedBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No completed bookings yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedBookings.map((booking) => (
                  <Card key={booking.id} className="opacity-80">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span>{booking.grounds.name}</span>
                        <Badge className="bg-blue-500">Completed</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4 mr-2" />
                        {booking.grounds.location}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-2" />
                        {format(new Date(booking.booking_date), "PPP")}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-2" />
                        {booking.start_time} - {booking.end_time}
                      </div>
                      <div className="pt-2 border-t">
                        <span className="font-bold">₹{booking.total_amount}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="cancelled" className="mt-6">
            {cancelledBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">No cancelled bookings</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cancelledBookings.map((booking) => (
                  <Card key={booking.id} className="opacity-60">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-lg">
                        <span>{booking.grounds.name}</span>
                        <Badge className="bg-red-500">Cancelled</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4 mr-2" />
                        {format(new Date(booking.booking_date), "PPP")}
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 mr-2" />
                        {booking.start_time} - {booking.end_time}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

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
      </div>

      <footer className="bg-card border-t border-border py-8 mt-20">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 Box Cricket. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default UserDashboard;
