import { memo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  isAdjacentToSelection?: boolean;
  isRecentlyBooked?: boolean;
  currentUserId?: string;
  onSelect: (slot: TimeSlot) => void;
  onUnavailableClick?: () => void;
}

const TimeSlotCard = memo(({ 
  slot, 
  isSelected, 
  isAdjacentToSelection = false,
  isRecentlyBooked = false,
  currentUserId,
  onSelect, 
  onUnavailableClick 
}: TimeSlotCardProps) => {
  const isUserBooking = slot.userId === currentUserId && !!currentUserId;
  
  // STRICT STATUS-BASED LOGIC
  // Status determines everything - no assumptions
  const status = slot.status;
  
  // Pending = Red (blocked for others, amber for own)
  const isPending = status === "pending";
  
  // Confirmed/Active/Completed = Pink (blocked for all except owner display)
  const isConfirmed = status === "confirmed" || status === "active" || status === "completed";
  
  // Available = Blue (no status, cancelled, or rejected)
  const isAvailable = !status || status === "cancelled" || status === "rejected";
  
  // Check if blocked by another user
  const isBlockedByOthers = (isPending || isConfirmed) && !isUserBooking;
  
  // Slot is absolutely blocked for selection if:
  // 1. It's pending and not the user's own
  // 2. It's confirmed/active/completed (anyone's)
  // 3. It's in the past
  const isSlotBlocked = slot.isPast || isBlockedByOthers || (isConfirmed && !isUserBooking);
  
  // Show warning icon for blocked slots
  const showWarningToOthers = isBlockedByOthers && !slot.isPast;

  // STRICT COLOR MAPPING:
  // Past → Muted/Disabled
  // Pending (others) → Red (destructive)
  // Pending (own) → Amber
  // Confirmed/Active (others) → Pink (rose-500)
  // Confirmed/Active (own) → Primary (green indicator)
  // Available/Cancelled/Rejected → Blue
  const getSlotColorClass = () => {
    if (slot.isPast) return "bg-muted text-muted-foreground cursor-not-allowed opacity-50";
    
    // Pending slots
    if (isPending) {
      if (isUserBooking) return "bg-amber-500 text-white cursor-not-allowed font-medium";
      return "bg-destructive text-destructive-foreground cursor-not-allowed font-medium"; // Red
    }
    
    // Confirmed/Active/Completed slots
    if (isConfirmed) {
      if (isUserBooking) return "bg-primary text-primary-foreground cursor-not-allowed font-medium";
      return "bg-pink-500 text-white cursor-not-allowed font-medium"; // Pink for others
    }
    
    // Available slots (including cancelled/rejected)
    if (isSelected) return "bg-primary text-primary-foreground";
    if (isAdjacentToSelection) return "bg-emerald-500/20 border-2 border-dashed border-emerald-500 text-emerald-700 hover:bg-emerald-500/30 cursor-pointer animate-pulse";
    return "bg-blue-500/10 border-2 border-blue-500 text-blue-700 hover:bg-blue-500/20 cursor-pointer"; // Blue
  };

  const getStatusLabel = () => {
    if (slot.isPast) return "(Past)";
    if (isPending && isUserBooking) return "Your Pending";
    if (isPending) return "Pending";
    if (isConfirmed && isUserBooking) return "Your Booking";
    if (isConfirmed) return "Booked";
    return `₹${slot.price}`;
  };

  const getWarningMessage = () => {
    if (isPending && !isUserBooking) return "This slot has a pending booking and is not available";
    if (isConfirmed && !isUserBooking) return "This slot is already booked and confirmed";
    return "";
  };

  const handleClick = () => {
    // Block ALL interactions for blocked slots
    if (isSlotBlocked || slot.isPast) {
      if (isSlotBlocked) {
        onUnavailableClick?.();
      }
      return;
    }
    // Allow clicking on available slots or slots with rejected/cancelled status
    onSelect(slot);
  };

  const buttonContent = (
    <Button
      variant="ghost"
      disabled={slot.isPast}
      onClick={handleClick}
      className={cn(
        "text-sm flex flex-col h-auto py-2 px-3 transition-all duration-200 relative",
        getSlotColorClass(),
        slot.isPast && "line-through",
        isRecentlyBooked && "animate-[pulse_0.5s_ease-in-out_3] ring-2 ring-rose-400 ring-offset-2"
      )}
    >
      {showWarningToOthers && (
        <AlertTriangle className="absolute top-1 right-1 h-3 w-3 text-yellow-300" />
      )}
      {isRecentlyBooked && (
        <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium animate-bounce">
          Just Booked!
        </span>
      )}
      <span className="font-medium">{slot.start} - {slot.end}</span>
      <span className="text-xs opacity-90">
        {getStatusLabel()}
      </span>
    </Button>
  );

  // Wrap with tooltip only for blocked slots to show warning
  if (showWarningToOthers) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px] text-center">
            <p className="text-xs">{getWarningMessage()}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
});

TimeSlotCard.displayName = "TimeSlotCard";

export default TimeSlotCard;
