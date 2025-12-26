import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

type AuditAction = 
  | "view_profile"
  | "edit_profile"
  | "view_user_list"
  | "view_bookings"
  | "update_booking"
  | "cancel_booking"
  | "confirm_booking";

interface AuditLogEntry {
  action: AuditAction;
  target_user_id?: string;
  target_table?: string;
  details?: Json;
}

export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn("Audit log failed: No authenticated user");
      return;
    }

    const { error } = await supabase
      .from("audit_logs")
      .insert([{
        admin_id: user.id,
        action: entry.action,
        target_user_id: entry.target_user_id || null,
        target_table: entry.target_table || null,
        details: entry.details || null,
      }]);

    if (error) {
      console.error("Failed to create audit log:", error.message);
    }
  } catch (err) {
    console.error("Audit logging error:", err);
  }
}

export function useAuditLog() {
  return { logAdminAction };
}
