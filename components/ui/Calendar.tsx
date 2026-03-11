import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { 
  format, addMonths, endOfMonth, 
  eachDayOfInterval, isSameMonth, isSameDay, isToday, 
  endOfWeek 
} from "date-fns";
import subMonths from "date-fns/subMonths";
import startOfMonth from "date-fns/startOfMonth";
import startOfWeek from "date-fns/startOfWeek";
import es from "date-fns/locale/es";
import { cn } from "../../lib/utils";
import { Button } from "./Button";

export type CalendarProps = {
  mode?: "single";
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  className?: string;
};

export const Calendar: React.FC<CalendarProps> = ({ 
  mode = "single", 
  selected, 
  onSelect, 
  className 
}) => {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Domingo
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const nextMonth = (e: React.MouseEvent) => {
      e.preventDefault();
      setCurrentMonth(addMonths(currentMonth, 1));
  };
  
  const prevMonth = (e: React.MouseEvent) => {
      e.preventDefault();
      setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleSelect = (day: Date, e: React.MouseEvent) => {
      e.preventDefault();
      if (onSelect) onSelect(day);
  };

  return (
    <div className={cn("p-4 bg-white rounded-lg border border-gray-100 shadow-xl w-[300px]", className)}>
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-sm font-bold capitalize text-gray-900">
          {format(currentMonth, "MMMM yyyy", { locale: es })}
        </span>
        <div className="flex items-center gap-1">
            <button 
                onClick={prevMonth}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-700 transition-colors"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>
            <button 
                onClick={nextMonth}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-700 transition-colors"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
      </div>
      
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map((d, i) => (
             <span key={i} className="text-[0.8rem] text-gray-400 font-medium w-8">
                {d}
             </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
            const isSelected = selected && isSameDay(day, selected);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            
            return (
                <button
                    key={idx}
                    onClick={(e) => handleSelect(day, e)}
                    className={cn(
                        "h-8 w-8 text-sm p-0 rounded-md flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-1",
                        !isCurrentMonth && "text-gray-300 opacity-50 cursor-default",
                        isCurrentMonth && "text-gray-700 hover:bg-gray-100 font-medium",
                        isSelected && "bg-[#114a28] text-white hover:bg-[#0e3b20] shadow-md font-bold",
                        !isSelected && isToday(day) && "bg-green-50 text-green-700 font-bold border border-green-200"
                    )}
                    disabled={!isCurrentMonth}
                >
                    {format(day, "d")}
                </button>
            )
        })}
      </div>
    </div>
  );
};