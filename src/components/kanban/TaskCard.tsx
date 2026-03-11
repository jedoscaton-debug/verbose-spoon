
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Calendar, MoreVertical, Trash2, Edit2, User, CheckSquare, Clock, DollarSign, MessageSquare, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { Task, TaskPriority } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  statusColor?: string;
}

export function TaskCard({ task, onDelete, onEdit, statusColor }: TaskCardProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isOverdue = isMounted && task.dueDate && new Date(task.dueDate) < new Date();
  const subtasksCompleted = (task.subtasks || []).filter(s => s.completed).length;
  const totalSubtasks = (task.subtasks || []).length;
  const totalComments = (task.comments || []).length;
  const totalAttachments = (task.attachments || []).length;
  
  const totalLoggedHours = (task.timeEntries || []).reduce((acc, curr) => acc + (curr.hours || 0), 0);
  const totalAmount = (task.timeEntries || []).reduce((acc, curr) => acc + (curr.amount || 0), 0);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('taskId', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
    setTimeout(() => (e.target as HTMLElement).style.opacity = '0.5', 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).style.opacity = '1';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onEdit(task)}
      className={cn(
        "bg-card p-5 rounded-2xl shadow-sm border border-border/60 hover:shadow-lg transition-all duration-300 cursor-grab active:cursor-grabbing active:scale-[0.98] group relative overflow-hidden",
        "animate-pop-in",
        isDragging && "scale-[1.02] ring-2 ring-primary/20 rotate-1 shadow-2xl"
      )}
    >
      <div className="absolute top-0 left-0 w-1 h-full opacity-60" style={{ backgroundColor: statusColor || 'hsl(var(--muted))' }} />
      
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg leading-tight truncate text-foreground group-hover:text-primary transition-colors">
            {task.title}
          </h3>
          <div className="flex items-center gap-2 mt-1.5">
             <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: statusColor || 'hsl(var(--muted))' }} />
             <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/80">
                {task.status.replace(/-/g, ' ')}
             </span>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button 
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-full hover:bg-muted transition-all opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-32">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(task); }} className="cursor-pointer">
              <Edit2 className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-col gap-4 mt-1">
        <div className="flex flex-wrap items-center gap-2">
          {task.dueDate && (
            <div className={cn(
              "flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full",
              isOverdue ? "bg-destructive/10 text-destructive" : "bg-muted/80 text-muted-foreground"
            )}>
              <Calendar size={12} />
              {format(new Date(task.dueDate), 'MMM d')}
            </div>
          )}
          {task.assignee && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              <User size={12} />
              {task.assignee.split(' ')[0]}
            </div>
          )}
          {totalLoggedHours > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              <Clock size={12} />
              {totalLoggedHours}h
            </div>
          )}
          {totalAmount > 0 && (
            <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-accent/10 text-accent">
              <DollarSign size={12} />
              ${totalAmount.toFixed(0)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {totalSubtasks > 0 && (
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckSquare size={10} /> {subtasksCompleted}/{totalSubtasks}</span>
                  <span>{Math.round((subtasksCompleted / totalSubtasks) * 100)}%</span>
              </div>
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-500" style={{ width: `${(subtasksCompleted / totalSubtasks) * 100}%` }} />
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 ml-auto">
            {totalAttachments > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                <Paperclip size={10} /> {totalAttachments}
              </div>
            )}
            {totalComments > 0 && (
              <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                <MessageSquare size={10} /> {totalComments}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
