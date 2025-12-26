import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface UseBookingNotificationsOptions {
  userId: string | null;
  onBookingConfirmed?: (bookingId: string) => void;
  onBookingRejected?: (bookingId: string) => void;
  onBookingUpdated?: () => void;
}

export const useBookingNotifications = ({
  userId,
  onBookingConfirmed,
  onBookingRejected,
  onBookingUpdated,
}: UseBookingNotificationsOptions) => {
  const shownNotifications = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-booking-notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newBooking = payload.new as any;
          const notificationKey = `${newBooking.id}-${newBooking.status}`;

          // Prevent duplicate notifications
          if (shownNotifications.current.has(notificationKey)) {
            return;
          }

          // Check if status changed to confirmed
          if (newBooking.status === 'confirmed' && newBooking.confirmed_at) {
            shownNotifications.current.add(notificationKey);
            
            // Show prominent toast notification
            toast({
              title: "✅ Booking Confirmed",
              description: "Your booking has been confirmed by the admin!",
              duration: 10000,
            });

            onBookingConfirmed?.(newBooking.id);
          }

          // Check if status changed to cancelled or rejected
          if (newBooking.status === 'cancelled' || newBooking.status === 'rejected') {
            shownNotifications.current.add(notificationKey);
            
            const isRejected = newBooking.status === 'rejected';
            toast({
              title: isRejected ? "❌ Booking Rejected" : "❌ Booking Cancelled",
              description: isRejected 
                ? "Your booking request has been rejected by the admin. The slot is now available."
                : "Your booking has been cancelled.",
              variant: "destructive",
              duration: 10000,
            });

            onBookingRejected?.(newBooking.id);
          }

          onBookingUpdated?.();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onBookingConfirmed, onBookingRejected, onBookingUpdated]);

  return null;
};
