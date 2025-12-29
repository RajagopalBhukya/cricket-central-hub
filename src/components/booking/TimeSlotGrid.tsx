import { memo, useMemo } from "react";
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

const TimeSlotGrid = memo(({ 
  slots, 
  selectedSlots, 
  currentUserId,
  isVisible, 
  onSlotSelect,
  onUnavailableClick 
}: TimeSlotGridProps) => {
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
