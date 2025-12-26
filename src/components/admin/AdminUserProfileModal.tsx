import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logAdminAction } from "@/hooks/useAuditLog";
import { format, formatDistanceToNow } from "date-fns";
import { 
  User, Mail, Phone, Clock, Calendar, Edit, Save, X,
  CheckCircle, XCircle, AlertCircle, History
} from "lucide-react";

interface UserProfile {
  id: string;
  full_name: string;
  phone_number: string;
  email?: string;
  last_active?: string;
  is_online?: boolean;
}

interface UserBooking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_amount: number;
  ground_name?: string;
  created_at?: string;
  confirmed_at?: string;
}

interface AdminUserProfileModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

export default function AdminUserProfileModal({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}: AdminUserProfileModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<UserProfile | null>(null);
  const [bookings, setBookings] = useState<UserBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setEditedUser({ ...user });
      fetchUserBookings(user.id);
      
      // Log admin viewing user profile
      logAdminAction({
        action: "view_profile",
        target_user_id: user.id,
        target_table: "profiles",
        details: { user_name: user.full_name },
      });
    }
  }, [user, isOpen]);

  const fetchUserBookings = async (userId: string) => {
    setLoading(true);
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select("*")
      .eq("user_id", userId)
      .order("booking_date", { ascending: false });

    if (bookingsData) {
      const groundIds = [...new Set(bookingsData.map(b => b.ground_id))];
      const { data: groundsData } = await supabase
        .from("grounds")
        .select("id, name")
        .in("id", groundIds);

      const groundsMap = new Map(groundsData?.map(g => [g.id, g.name]) || []);

      const enrichedBookings: UserBooking[] = bookingsData.map(booking => ({
        ...booking,
        ground_name: groundsMap.get(booking.ground_id) || "N/A",
      }));

      setBookings(enrichedBookings);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!editedUser) return;

    // Validate email
    if (editedUser.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editedUser.email)) {
      toast({ title: "Error", description: "Invalid email format", variant: "destructive" });
      return;
    }

    // Validate phone (10 digits)
    if (!/^\d{10}$/.test(editedUser.phone_number)) {
      toast({ title: "Error", description: "Phone number must be 10 digits", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: editedUser.full_name,
        phone_number: editedUser.phone_number,
      })
      .eq("id", editedUser.id);

    setSaving(false);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      // Log admin editing user profile
      logAdminAction({
        action: "edit_profile",
        target_user_id: editedUser.id,
        target_table: "profiles",
        details: {
          updated_fields: {
            full_name: editedUser.full_name,
            phone_number: editedUser.phone_number,
          },
        },
      });
      
      toast({ title: "Success", description: "User profile updated" });
      setIsEditing(false);
      onUserUpdated();
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed": return "default";
      case "completed": return "secondary";
      case "pending": return "destructive";
      case "cancelled": return "outline";
      case "rejected": return "outline";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "confirmed":
      case "completed":
        return <CheckCircle className="w-3 h-3" />;
      case "cancelled":
        return <XCircle className="w-3 h-3" />;
      case "pending":
        return <AlertCircle className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const pendingBookings = bookings.filter(b => b.status === "pending");
  const confirmedBookings = bookings.filter(b => b.status === "confirmed" || b.status === "active");
  const completedBookings = bookings.filter(b => b.status === "completed");
  const cancelledBookings = bookings.filter(b => b.status === "cancelled");

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            User Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile Info */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Badge variant={user.is_online ? "default" : "secondary"}>
                    {user.is_online ? "Online" : "Offline"}
                  </Badge>
                  {user.last_active && (
                    <span className="text-xs text-muted-foreground">
                      Last active: {formatDistanceToNow(new Date(user.last_active), { addSuffix: true })}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? <X className="w-4 h-4 mr-1" /> : <Edit className="w-4 h-4 mr-1" />}
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
              </div>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label className="flex items-center gap-1">
                    <User className="w-3 h-3" /> Name
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editedUser?.full_name || ""}
                      onChange={(e) => setEditedUser(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                    />
                  ) : (
                    <p className="text-sm font-medium">{user.full_name}</p>
                  )}
                </div>
                
                <div className="grid gap-2">
                  <Label className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </Label>
                  <p className="text-sm font-medium text-muted-foreground">{user.email || "N/A"}</p>
                </div>

                <div className="grid gap-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </Label>
                  {isEditing ? (
                    <Input
                      value={editedUser?.phone_number || ""}
                      onChange={(e) => setEditedUser(prev => prev ? { ...prev, phone_number: e.target.value } : null)}
                      maxLength={10}
                    />
                  ) : (
                    <p className="text-sm font-medium">{user.phone_number}</p>
                  )}
                </div>
              </div>

              {isEditing && (
                <Button onClick={handleSave} disabled={saving} className="mt-4 w-full">
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Booking History */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-4 h-4" />
                <span className="font-medium">Booking History</span>
                <Badge variant="outline">{bookings.length} total</Badge>
              </div>

              <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-auto">
                  <TabsTrigger value="all" className="text-xs px-1">All ({bookings.length})</TabsTrigger>
                  <TabsTrigger value="pending" className="text-xs px-1">Pending ({pendingBookings.length})</TabsTrigger>
                  <TabsTrigger value="confirmed" className="text-xs px-1">Active ({confirmedBookings.length})</TabsTrigger>
                  <TabsTrigger value="completed" className="text-xs px-1">Done ({completedBookings.length})</TabsTrigger>
                  <TabsTrigger value="cancelled" className="text-xs px-1">Cancelled ({cancelledBookings.length})</TabsTrigger>
                </TabsList>

                <ScrollArea className="h-[200px] mt-4">
                  {loading ? (
                    <p className="text-center text-muted-foreground py-4">Loading...</p>
                  ) : (
                    <>
                      <TabsContent value="all" className="space-y-2 mt-0">
                        {bookings.length === 0 ? (
                          <p className="text-center text-muted-foreground py-4">No bookings</p>
                        ) : (
                          bookings.map((booking) => (
                            <BookingItem key={booking.id} booking={booking} />
                          ))
                        )}
                      </TabsContent>
                      <TabsContent value="pending" className="space-y-2 mt-0">
                        {pendingBookings.map((booking) => (
                          <BookingItem key={booking.id} booking={booking} />
                        ))}
                      </TabsContent>
                      <TabsContent value="confirmed" className="space-y-2 mt-0">
                        {confirmedBookings.map((booking) => (
                          <BookingItem key={booking.id} booking={booking} />
                        ))}
                      </TabsContent>
                      <TabsContent value="completed" className="space-y-2 mt-0">
                        {completedBookings.map((booking) => (
                          <BookingItem key={booking.id} booking={booking} />
                        ))}
                      </TabsContent>
                      <TabsContent value="cancelled" className="space-y-2 mt-0">
                        {cancelledBookings.map((booking) => (
                          <BookingItem key={booking.id} booking={booking} />
                        ))}
                      </TabsContent>
                    </>
                  )}
                </ScrollArea>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BookingItem({ booking }: { booking: UserBooking }) {
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed": return "default";
      case "active": return "default";
      case "completed": return "secondary";
      case "pending": return "destructive";
      case "cancelled": return "outline";
      case "rejected": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="p-2 rounded-lg border bg-muted/50 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">{booking.ground_name}</span>
        <Badge variant={getStatusBadgeVariant(booking.status)} className="text-[10px]">
          {booking.status}
        </Badge>
      </div>
      <div className="flex items-center gap-2 mt-1 text-muted-foreground">
        <Calendar className="w-3 h-3" />
        {format(new Date(booking.booking_date), "PP")}
        <Clock className="w-3 h-3 ml-2" />
        {booking.start_time} - {booking.end_time}
      </div>
      <div className="mt-1 text-muted-foreground">₹{booking.total_amount}</div>
    </div>
  );
}
