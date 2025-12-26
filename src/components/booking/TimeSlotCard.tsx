import { memo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TimeSlot {
  start: string;
  end: string;
  available: boolean;
  isPast: boolean;
  price: number;
  status?: string;
  userId?: string;
}

interface TimeSlotCardProps {
  slot: TimeSlot;
  isSelected: boolean;
  currentUserId?: string;
  onSelect: (slot: TimeSlot) => void;
  onUnavailableClick?: () => void;
}

const TimeSlotCard = memo(({ 
  slot, 
  isSelected, 
  currentUserId,
  onSelect, 
  onUnavailableClick 
}: TimeSlotCardProps) => {
  // Slots with rejected/cancelled status should show as available
  const isSlotBlocked = !slot.available && !slot.isPast && 
    slot.status !== 'rejected' && slot.status !== 'cancelled';
  const isPending = isSlotBlocked && slot.status === "pending";
  const isConfirmed = isSlotBlocked && (slot.status === "confirmed" || slot.status === "active");
  const isUserBooking = slot.userId === currentUserId;

  const getSlotColorClass = () => {
    if (slot.isPast) return "bg-muted text-muted-foreground cursor-not-allowed opacity-50";
    if (isPending) return "bg-destructive text-destructive-foreground cursor-not-allowed";
    if (isConfirmed && isUserBooking) return "bg-primary text-primary-foreground cursor-not-allowed";
    if (isConfirmed) return "bg-pink-500 text-white cursor-not-allowed";
    if (isSelected) return "bg-primary text-primary-foreground";
    // Available slots (including those with rejected/cancelled status)
    return "bg-blue-500/10 border-2 border-blue-500 text-blue-700 hover:bg-blue-500/20 cursor-pointer";
  };

  const getStatusLabel = () => {
    if (slot.isPast) return "(Past)";
    if (isPending) return "Pending";
    if (isConfirmed && isUserBooking) return "Your Booking";
    if (isConfirmed) return "Booked";
    return `₹${slot.price}`;
  };

  const handleClick = () => {
    if (isSlotBlocked) {
      onUnavailableClick?.();
      return;
    }
    // Allow clicking on available slots or slots with rejected/cancelled status
    if (!slot.isPast) {
      onSelect(slot);
    }
  };

  return (
    <Button
      variant="ghost"
      disabled={slot.isPast}
      onClick={handleClick}
      className={cn(
        "text-sm flex flex-col h-auto py-2 px-3 transition-all duration-200",
        getSlotColorClass(),
        slot.isPast && "line-through"
      )}
    >
      <span className="font-medium">{slot.start} - {slot.end}</span>
      <span className="text-xs opacity-90">
        {getStatusLabel()}
      </span>
    </Button>
  );
});

TimeSlotCard.displayName = "TimeSlotCard";

export default TimeSlotCard;
