import { memo } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BookingStatusBadgeProps {
  status: string;
  className?: string;
}

const BookingStatusBadge = memo(({ status, className }: BookingStatusBadgeProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return { label: "Pending", className: "bg-destructive hover:bg-destructive/90" };
      case "confirmed":
        return { label: "Confirmed", className: "bg-primary hover:bg-primary/90" };
      case "active":
        return { label: "Active", className: "bg-primary hover:bg-primary/90" };
      case "completed":
        return { label: "Completed", className: "bg-blue-500 hover:bg-blue-600" };
      case "cancelled":
        return { label: "Cancelled", className: "bg-muted-foreground hover:bg-muted-foreground/90" };
      case "expired":
        return { label: "Expired", className: "bg-muted-foreground hover:bg-muted-foreground/90" };
      default:
        return { label: status, className: "bg-muted-foreground hover:bg-muted-foreground/90" };
    }
  };

  const config = getStatusConfig();

  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
});

BookingStatusBadge.displayName = "BookingStatusBadge";

export default BookingStatusBadge;
