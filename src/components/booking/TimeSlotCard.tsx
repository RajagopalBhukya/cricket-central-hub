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
  currentUserId?: string;
  onSelect: (slot: TimeSlot) => void;
  onUnavailableClick?: () => void;
}

const TimeSlotCard = memo(({ 
  slot, 
  isSelected, 
  isAdjacentToSelection = false,
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
  
  // Show warning to other users when slot is blocked by someone else
  const showWarningToOthers = isSlotBlocked && !isUserBooking;

  const getSlotColorClass = () => {
    if (slot.isPast) return "bg-muted text-muted-foreground cursor-not-allowed opacity-50";
    if (isPending) return "bg-destructive text-destructive-foreground cursor-not-allowed";
    if (isConfirmed && isUserBooking) return "bg-primary text-primary-foreground cursor-not-allowed";
    if (isConfirmed) return "bg-pink-500 text-white cursor-not-allowed";
    if (isSelected) return "bg-primary text-primary-foreground";
    // Highlight adjacent slots that can be selected next
    if (isAdjacentToSelection) return "bg-emerald-500/20 border-2 border-dashed border-emerald-500 text-emerald-700 hover:bg-emerald-500/30 cursor-pointer animate-pulse";
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

  const getWarningMessage = () => {
    if (isPending) return "This slot has a pending booking and is not available for selection";
    if (isConfirmed) return "This slot is already booked and confirmed";
    return "";
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

  const buttonContent = (
    <Button
      variant="ghost"
      disabled={slot.isPast}
      onClick={handleClick}
      className={cn(
        "text-sm flex flex-col h-auto py-2 px-3 transition-all duration-200 relative",
        getSlotColorClass(),
        slot.isPast && "line-through"
      )}
    >
      {showWarningToOthers && (
        <AlertTriangle className="absolute top-1 right-1 h-3 w-3 text-yellow-300" />
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
