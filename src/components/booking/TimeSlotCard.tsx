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
  
  // Check if slot is booked by another user - this takes HIGHEST priority
  // A slot is booked by others if it has a blocking status AND is not the current user's booking
  const hasBlockingStatus = slot.status === "confirmed" || slot.status === "active" || slot.status === "pending" || slot.status === "completed";
  const isBookedByOthers = hasBlockingStatus && slot.userId && slot.userId !== currentUserId;
  
  // Check if slot is pending (any pending slot blocks availability)
  const isPending = slot.status === "pending" && !slot.isPast;
  
  // Slot is absolutely blocked for selection if:
  // 1. Booked by others (confirmed/active/pending/completed with different user_id)
  // 2. Has pending status (even if no user_id visible due to RLS)
  // 3. Not available AND not a cancelled/rejected slot
  const isSlotBlocked = isBookedByOthers || 
    (isPending && !isUserBooking) || 
    (!slot.available && !slot.isPast && slot.status !== 'rejected' && slot.status !== 'cancelled');
  
  const isConfirmed = (slot.status === "confirmed" || slot.status === "active") && !slot.isPast;
  
  // Show warning to other users when slot is blocked by someone else
  const showWarningToOthers = isSlotBlocked && !isUserBooking;

  const getSlotColorClass = () => {
    if (slot.isPast) return "bg-muted text-muted-foreground cursor-not-allowed opacity-50";
    // HIGHEST PRIORITY: Booked by others - always show pink and block
    if (isBookedByOthers) return "bg-rose-500 text-white cursor-not-allowed font-medium";
    // Show user's own confirmed booking with primary color
    if (isConfirmed && isUserBooking) return "bg-primary text-primary-foreground cursor-not-allowed";
    // Show pending slots with destructive color (blocks selection)
    if (isPending && !isUserBooking) return "bg-destructive text-destructive-foreground cursor-not-allowed";
    // User's own pending booking
    if (isPending && isUserBooking) return "bg-amber-500 text-white cursor-not-allowed";
    if (isSelected) return "bg-primary text-primary-foreground";
    // Highlight adjacent slots that can be selected next
    if (isAdjacentToSelection) return "bg-emerald-500/20 border-2 border-dashed border-emerald-500 text-emerald-700 hover:bg-emerald-500/30 cursor-pointer animate-pulse";
    // Available slots (including those with rejected/cancelled status)
    return "bg-blue-500/10 border-2 border-blue-500 text-blue-700 hover:bg-blue-500/20 cursor-pointer";
  };

  const getStatusLabel = () => {
    if (slot.isPast) return "(Past)";
    if (isBookedByOthers) return "Booked";
    if (isPending && isUserBooking) return "Your Pending";
    if (isPending) return "Pending";
    if (isConfirmed && isUserBooking) return "Your Booking";
    if (isConfirmed) return "Booked";
    return `₹${slot.price}`;
  };

  const getWarningMessage = () => {
    if (isPending) return "This slot has a pending booking and is not available for selection";
    if (isConfirmed) return "This slot is already booked and confirmed";
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
