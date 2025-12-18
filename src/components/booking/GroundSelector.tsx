import { memo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface Ground {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  price_per_hour: number;
  is_active: boolean;
}

interface GroundSelectorProps {
  grounds: Ground[];
  selectedGround: string | null;
  onSelect: (groundId: string) => void;
}

const GroundSelector = memo(({ grounds, selectedGround, onSelect }: GroundSelectorProps) => {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
        <MapPin className="w-5 h-5" /> Select Ground
      </h2>
      <div className="space-y-3 sm:space-y-4">
        {grounds.map((ground) => (
          <Card
            key={ground.id}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-lg",
              selectedGround === ground.id && "ring-2 ring-primary shadow-md"
            )}
            onClick={() => onSelect(ground.id)}
          >
            <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-base sm:text-lg">{ground.name}</CardTitle>
              <CardDescription className="text-xs sm:text-sm">{ground.location}</CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xs sm:text-sm text-muted-foreground">
                {ground.name.toLowerCase().includes('day') ? (
                  <p>Day Slots (7AM - 6PM): <span className="font-bold text-primary">₹600/hr</span></p>
                ) : (
                  <p>Night Slots (6PM - 11PM): <span className="font-bold text-primary">₹800/hr</span></p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
});

GroundSelector.displayName = "GroundSelector";

export default GroundSelector;
