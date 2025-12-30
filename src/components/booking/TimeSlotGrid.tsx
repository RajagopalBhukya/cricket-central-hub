import { memo, useMemo, useEffect, useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import TimeSlotCard from "./TimeSlotCard";
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

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selectedSlots: TimeSlot[];
  currentUserId?: string;
  isVisible: boolean;
  onSlotSelect: (slot: TimeSlot) => void;
  onUnavailableClick?: () => void;
}

// Track slots that recently became booked
const useRecentlyBookedSlots = (slots: TimeSlot[], currentUserId?: string) => {
  const [recentlyBooked, setRecentlyBooked] = useState<Set<string>>(new Set());
  const previousSlotsRef = useRef<Map<string, string | undefined>>(new Map());

  useEffect(() => {
    const newRecentlyBooked = new Set<string>();
    
    slots.forEach(slot => {
      const prevStatus = previousSlotsRef.current.get(slot.start);
      const currentStatus = slot.status;
      
      // Check if slot just became booked by someone else
      const wasAvailable = !prevStatus || prevStatus === 'cancelled' || prevStatus === 'rejected';
      const isNowBooked = currentStatus === 'confirmed' || currentStatus === 'active' || currentStatus === 'pending';
      const isNotUserBooking = slot.userId !== currentUserId;
      
      if (wasAvailable && isNowBooked && isNotUserBooking && prevStatus !== undefined) {
        newRecentlyBooked.add(slot.start);
      }
    });

    // Update previous slots reference
    const newPrevMap = new Map<string, string | undefined>();
    slots.forEach(slot => {
      newPrevMap.set(slot.start, slot.status);
    });
    previousSlotsRef.current = newPrevMap;

    if (newRecentlyBooked.size > 0) {
      setRecentlyBooked(prev => new Set([...prev, ...newRecentlyBooked]));
      
      // Clear animation after 2 seconds
      setTimeout(() => {
        setRecentlyBooked(prev => {
          const updated = new Set(prev);
          newRecentlyBooked.forEach(slot => updated.delete(slot));
          return updated;
        });
      }, 2000);
    }
  }, [slots, currentUserId]);

  return recentlyBooked;
};

const TimeSlotGrid = memo(({ 
  slots, 
  selectedSlots, 
  currentUserId,
  isVisible, 
  onSlotSelect,
  onUnavailableClick 
}: TimeSlotGridProps) => {
  // Track recently booked slots for animation
  const recentlyBookedSlots = useRecentlyBookedSlots(slots, currentUserId);
  // Calculate which slots are adjacent to current selection
  const adjacentSlots = useMemo(() => {
    if (selectedSlots.length === 0) return new Set<string>();
    
    const sortedSelection = [...selectedSlots].sort((a, b) => a.start.localeCompare(b.start));
    const firstSlot = sortedSelection[0];
    const lastSlot = sortedSelection[sortedSelection.length - 1];
    
    const adjacent = new Set<string>();
    
    // Find slot before first selected
    const beforeSlot = slots.find(s => s.end === firstSlot.start && s.available);
    if (beforeSlot) adjacent.add(beforeSlot.start);
    
    // Find slot after last selected
    const afterSlot = slots.find(s => s.start === lastSlot.end && s.available);
    if (afterSlot) adjacent.add(afterSlot.start);
    
    return adjacent;
  }, [slots, selectedSlots]);

  return (
    <Card className={cn(
      "transition-all duration-300 ease-in-out",
      isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
    )}>
      <CardContent className="p-4">
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-destructive rounded"></div>
            <span>Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-pink-500 rounded"></div>
            <span>Booked</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 bg-primary rounded"></div>
            <span>Your Booking</span>
          </div>
          {selectedSlots.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 border-2 border-dashed border-emerald-500 rounded animate-pulse"></div>
              <span>Can Select Next</span>
            </div>
          )}
        </div>

        {/* Slots Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {slots.map((slot) => (
            <TimeSlotCard
              key={slot.start}
              slot={slot}
              isSelected={selectedSlots.some(s => s.start === slot.start)}
              isAdjacentToSelection={adjacentSlots.has(slot.start)}
              isRecentlyBooked={recentlyBookedSlots.has(slot.start)}
              currentUserId={currentUserId}
              onSelect={onSlotSelect}
              onUnavailableClick={onUnavailableClick}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

TimeSlotGrid.displayName = "TimeSlotGrid";

export default TimeSlotGrid;
