import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { CalendarDays, Clock, User, MapPin, ChevronLeft, ChevronRight } from "lucide-react";

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_amount: number;
  user_name?: string;
  ground_name?: string;
}

interface AdminCalendarViewProps {
  bookings: Booking[];
  onBookingClick?: (booking: Booking) => void;
}

export default function AdminCalendarView({ bookings, onBookingClick }: AdminCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<"month" | "day">("month");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-green-500";
      case "active": return "bg-green-500";
      case "pending": return "bg-red-500";
      case "completed": return "bg-blue-500";
      case "cancelled": return "bg-gray-400";
      default: return "bg-gray-400";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed":
      case "active":
        return "default";
      case "pending":
        return "destructive";
      case "completed":
        return "secondary";
      case "cancelled":
        return "outline";
      default:
        return "secondary";
    }
  };

  const bookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach(booking => {
      const dateKey = booking.booking_date;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(booking);
    });
    return map;
  }, [bookings]);

  const selectedDateBookings = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return bookingsByDate.get(dateKey) || [];
  }, [selectedDate, bookingsByDate]);

  // Custom day render for calendar
  const modifiers = useMemo(() => {
    const hasBookings: Date[] = [];
    const hasPending: Date[] = [];
    const hasConfirmed: Date[] = [];

    bookingsByDate.forEach((dayBookings, dateStr) => {
      const date = new Date(dateStr);
      hasBookings.push(date);
      
      if (dayBookings.some(b => b.status === "pending")) {
        hasPending.push(date);
      }
      if (dayBookings.some(b => b.status === "confirmed" || b.status === "active")) {
        hasConfirmed.push(date);
      }
    });

    return { hasBookings, hasPending, hasConfirmed };
  }, [bookingsByDate]);

  return (
    <Card>
      <CardHeader className="py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
            Calendar View
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="text-xs"
            >
              Month
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("day")}
              className="text-xs"
            >
              Day
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span>Confirmed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
            <span>Cancelled</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Calendar */}
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
              modifiers={modifiers}
              modifiersClassNames={{
                hasBookings: "font-bold",
                hasPending: "bg-red-100 dark:bg-red-900/30",
                hasConfirmed: "bg-green-100 dark:bg-green-900/30",
              }}
            />
          </div>

          {/* Day View */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </h3>
              <Badge variant="outline">{selectedDateBookings.length} bookings</Badge>
            </div>
            
            <ScrollArea className="h-[300px]">
              {selectedDateBookings.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  No bookings for this date
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDateBookings
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                    .map((booking) => (
                      <div
                        key={booking.id}
                        onClick={() => setSelectedBooking(booking)}
                        className={`p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors ${
                          booking.status === "cancelled" ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(booking.status)}`} />
                            <span className="font-medium text-sm">
                              {booking.start_time} - {booking.end_time}
                            </span>
                          </div>
                          <Badge variant={getStatusBadgeVariant(booking.status)} className="text-[10px]">
                            {booking.status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {booking.ground_name || "N/A"}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" />
                            {booking.user_name || "N/A"}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Booking Detail Modal */}
        <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
            </DialogHeader>
            {selectedBooking && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <Badge variant={getStatusBadgeVariant(selectedBooking.status)}>
                      {selectedBooking.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Ground</span>
                    <span className="font-medium">{selectedBooking.ground_name || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">User</span>
                    <span className="font-medium">{selectedBooking.user_name || "N/A"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Date</span>
                    <span className="font-medium">
                      {format(new Date(selectedBooking.booking_date), "PP")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Time</span>
                    <span className="font-medium">
                      {selectedBooking.start_time} - {selectedBooking.end_time}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Amount</span>
                    <span className="font-medium">₹{selectedBooking.total_amount}</span>
                  </div>
                </div>
                <Button 
                  className="w-full" 
                  onClick={() => {
                    onBookingClick?.(selectedBooking);
                    setSelectedBooking(null);
                  }}
                >
                  View Full Details
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
