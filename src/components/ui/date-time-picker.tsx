import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  label?: string;
}

export function DateTimePicker({ value, onChange, minDate = new Date(), label = "Select date and time" }: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value || undefined);
  const [timeString, setTimeString] = useState(
    value ? format(value, "HH:mm") : format(new Date(), "HH:mm")
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    setSelectedDate(date);
    
    // Parse time from timeString
    const [hours, minutes] = timeString.split(':').map(Number);
    const newDateTime = new Date(date);
    newDateTime.setHours(hours, minutes, 0, 0);
    
    onChange(newDateTime);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeString(newTime);
    
    if (selectedDate) {
      const [hours, minutes] = newTime.split(':').map(Number);
      const newDateTime = new Date(selectedDate);
      newDateTime.setHours(hours, minutes, 0, 0);
      
      onChange(newDateTime);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[240px] justify-start text-left font-normal",
                !selectedDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              disabled={(date) => date < minDate}
              initialFocus
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
        
        <Input
          type="time"
          value={timeString}
          onChange={handleTimeChange}
          className="w-[140px]"
        />
      </div>
      
      {value && (
        <p className="text-sm text-muted-foreground">
          Will be sent on {format(value, "PPP 'at' p")}
        </p>
      )}
    </div>
  );
}
