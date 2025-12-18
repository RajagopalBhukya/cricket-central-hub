import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Calendar as CalendarIcon } from "lucide-react";
import { addDays, isBefore, startOfDay } from "date-fns";

interface DateSelectorProps {
  selectedDate: Date | undefined;
  onSelect: (date: Date | undefined) => void;
}

const DateSelector = memo(({ selectedDate, onSelect }: DateSelectorProps) => {
  return (
    <div>
      <h2 className="text-xl sm:text-2xl font-semibold mb-4 flex items-center gap-2">
        <CalendarIcon className="w-5 h-5" /> Select Date
      </h2>
      <Card>
        <CardContent className="p-2 sm:p-4">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={onSelect}
            disabled={(date) =>
              isBefore(startOfDay(date), startOfDay(new Date())) ||
              isBefore(addDays(new Date(), 30), date)
            }
            className="rounded-md w-full"
          />
        </CardContent>
      </Card>
    </div>
  );
});

DateSelector.displayName = "DateSelector";

export default DateSelector;
