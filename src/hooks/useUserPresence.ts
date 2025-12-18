import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to track user online/offline status and last active time
 */
export const useUserPresence = (userId: string | null) => {
  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!userId) return;

    await supabase
      .from("profiles")
      .update({
        is_online: isOnline,
        last_active: new Date().toISOString(),
      })
      .eq("id", userId);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    // Mark user as online
    updatePresence(true);

    // Update last_active every minute while online
    const interval = setInterval(() => {
      updatePresence(true);
    }, 60 * 1000);

    // Handle visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        updatePresence(true);
      } else {
        updatePresence(false);
      }
    };

    // Handle before unload
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline status update
      const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`;
      navigator.sendBeacon(url, JSON.stringify({ is_online: false }));
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Mark as offline on unmount
      updatePresence(false);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [userId, updatePresence]);
};
