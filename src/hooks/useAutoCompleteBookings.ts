import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to auto-complete bookings that have passed their end time
 * This runs on mount and periodically to keep bookings status updated
 */
export const useAutoCompleteBookings = (isAdmin: boolean = false) => {
  const updateCompletedBookings = useCallback(async () => {
    if (!isAdmin) return;

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentTime = now.toTimeString().slice(0, 5);

    // Update bookings that have passed their end time
    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .in("status", ["confirmed", "active"])
      .or(`booking_date.lt.${currentDate},and(booking_date.eq.${currentDate},end_time.lt.${currentTime})`);

    if (error) {
      console.error("Error auto-completing bookings:", error);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;

    // Run immediately on mount
    updateCompletedBookings();

    // Run every 5 minutes
    const interval = setInterval(updateCompletedBookings, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [isAdmin, updateCompletedBookings]);

  return { updateCompletedBookings };
};
