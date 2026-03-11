
"use client";

import { useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  parseISO 
} from 'date-fns';
import { Task, StatusConfig } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MiniCalendarProps {
  tasks: Task[];
  availableStatuses: StatusConfig[];
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
}

export function MiniCalendar({ tasks, availableStatuses, selectedDate, onDateSelect }: MiniCalendarProps) {
  const currentMonth = new Date();
  
  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const getDayStatus = (day: Date) => {
    const dayTasks = tasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), day));
    if (dayTasks.length === 0) return 'none';

    const hasOverdue = dayTasks.some(t => new Date(t.dueDate!) < new Date() && !availableStatuses.find(s => s.value === t.status)?.isDone);
    if (hasOverdue) return 'overdue';

    const allCompleted = dayTasks.every(t => availableStatuses.find(s => s.value === t.status)?.isDone);
    if (allCompleted) return 'completed';

    return 'pending';
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-1">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={`${d}-${i}`} className="text-center text-[8px] font-black text-muted-foreground mb-1">
            {d}
          </div>
        ))}
        {days.map((day, idx) => {
          const status = getDayStatus(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const isInMonth = isSameMonth(day, currentMonth);

          return (
            <button
              key={idx}
              onClick={() => onDateSelect(day)}
              disabled={!isInMonth}
              className={cn(
                "h-8 rounded-md flex flex-col items-center justify-center transition-all relative",
                !isInMonth && "opacity-0 pointer-events-none",
                isSelected ? "bg-primary text-white ring-2 ring-primary ring-offset-1" : "hover:bg-muted",
                isToday && !isSelected && "bg-muted font-black text-primary"
              )}
            >
              <span className="text-[10px] font-bold">{format(day, 'd')}</span>
              {isInMonth && status !== 'none' && (
                <div className={cn(
                  "w-1 h-1 rounded-full mt-0.5",
                  status === 'overdue' && "bg-destructive",
                  status === 'completed' && "bg-accent",
                  status === 'pending' && "bg-primary"
                )} />
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t">
        <LegendItem color="bg-destructive" label="Overdue" />
        <LegendItem color="bg-accent" label="All Done" />
        <LegendItem color="bg-primary" label="Pending" />
        <LegendItem color="bg-muted" label="None" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-2 h-2 rounded-full", color)} />
      <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}
