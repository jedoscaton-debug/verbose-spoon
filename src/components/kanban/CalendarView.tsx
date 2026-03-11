
"use client";

import { useState, useMemo } from 'react';
import { Task } from '@/lib/types';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CalendarViewProps {
  tasks: Task[];
  onEditTask: (task: Task) => void;
}

export function CalendarView({ tasks, onEditTask }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    return eachDayOfInterval({
      start: startDate,
      end: endDate,
    });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach(task => {
      if (task.dueDate) {
        const dateKey = format(parseISO(task.dueDate), 'yyyy-MM-dd');
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(task);
      }
    });
    return map;
  }, [tasks]);

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const goToToday = () => setCurrentMonth(new Date());

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden flex flex-col animate-fade-in h-full min-h-[600px]">
      {/* Calendar Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black text-primary capitalize">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center bg-muted/30 p-1 rounded-lg">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold uppercase tracking-widest px-3" onClick={goToToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarIcon size={16} />
          <span className="text-xs font-medium">{tasks.filter(t => t.dueDate).length} Tasks with Deadlines</span>
        </div>
      </header>

      {/* Weekday Labels */}
      <div className="grid grid-cols-7 border-b bg-muted/10">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="py-2 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr">
        {days.map((day, idx) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateKey] || [];
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <div 
              key={idx}
              className={cn(
                "min-h-[120px] p-2 border-r border-b last:border-r-0 flex flex-col gap-1 transition-colors",
                !isCurrentMonth ? "bg-muted/5 opacity-40" : "bg-card hover:bg-muted/5"
              )}
            >
              <div className="flex justify-between items-center mb-1">
                <span className={cn(
                  "text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full",
                  isToday ? "bg-primary text-white" : "text-muted-foreground"
                )}>
                  {format(day, 'd')}
                </span>
                {dayTasks.length > 0 && (
                  <Badge variant="secondary" className="h-4 px-1 text-[8px] font-black uppercase">
                    {dayTasks.length} {dayTasks.length === 1 ? 'Task' : 'Tasks'}
                  </Badge>
                )}
              </div>
              
              <ScrollArea className="flex-1 h-0">
                <div className="space-y-1">
                  {dayTasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={() => onEditTask(task)}
                      className={cn(
                        "text-[10px] p-1.5 rounded border border-border/50 bg-card hover:border-primary/50 cursor-pointer transition-all truncate group",
                        task.priority === 'high' && "border-l-2 border-l-destructive"
                      )}
                    >
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-bold truncate group-hover:text-primary transition-colors">
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 opacity-60 text-[8px] font-medium">
                        {task.assignee && (
                          <div className="flex items-center gap-0.5">
                            <User size={8} />
                            {task.assignee.split(' ')[0]}
                          </div>
                        )}
                        <div className="flex items-center gap-0.5">
                          <Clock size={8} />
                          {task.status.replace(/-/g, ' ')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
