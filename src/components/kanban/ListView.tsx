
"use client";

import { useState } from 'react';
import { Task, TaskStatus, StatusConfig } from '@/lib/types';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Edit2, 
  Trash2, 
  Calendar, 
  AlertCircle,
  Clock,
  GripVertical
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface ListViewProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, status: TaskStatus) => void;
  onDeleteTask: (taskId: string) => void;
  onEditTask: (task: Task) => void;
  availableStatuses: StatusConfig[];
}

export function ListView({ tasks, onUpdateStatus, onDeleteTask, onEditTask, availableStatuses }: ListViewProps) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-card rounded-2xl border border-dashed">
        <Clock className="h-12 w-12 text-muted/20 mb-4" />
        <p className="text-muted-foreground italic text-sm">No tasks in this project yet.</p>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.effectAllowed = 'move';
    
    const target = e.target as HTMLElement;
    setTimeout(() => {
      target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  };

  const handleDragOver = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverStatus(status);
  };

  const handleDragLeave = () => {
    setDragOverStatus(null);
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    setDragOverStatus(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      onUpdateStatus(taskId, status);
    }
  };

  return (
    <div className="space-y-8 sm:space-y-12 animate-fade-in pb-20">
      {availableStatuses.map((status) => {
        const statusTasks = tasks.filter(t => t.status === status.value);
        const isDraggingOver = dragOverStatus === status.value;

        return (
          <div 
            key={status.value} 
            className={cn(
              "space-y-4 p-1 sm:p-2 rounded-2xl transition-all duration-300",
              isDraggingOver && "bg-primary/5 ring-2 ring-primary/20 scale-[1.01]"
            )}
            onDragOver={(e) => handleDragOver(e, status.value)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status.value)}
          >
            <div className="flex items-center gap-3 px-2">
              <div 
                className="w-2.5 h-2.5 rounded-full shadow-sm" 
                style={{ backgroundColor: status.color }} 
              />
              <h3 className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-foreground/80">
                {status.label}
              </h3>
              <Badge variant="secondary" className="h-4 sm:h-5 px-1.5 sm:px-2 text-[8px] sm:text-[10px] font-bold rounded-full bg-muted/50">
                {statusTasks.length}
              </Badge>
              <div className="flex-1 h-px bg-border/40" />
            </div>

            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <Table className="min-w-[700px]">
                  <TableHeader className="bg-muted/10">
                    <TableRow className="hover:bg-transparent border-b">
                      <TableHead className="w-[40px] px-2"></TableHead>
                      <TableHead className="w-[300px] font-bold uppercase tracking-wider text-[9px] text-muted-foreground">Task Details</TableHead>
                      <TableHead className="w-[100px] font-bold uppercase tracking-wider text-[9px] text-muted-foreground">Priority</TableHead>
                      <TableHead className="w-[120px] font-bold uppercase tracking-wider text-[9px] text-muted-foreground">Assignee</TableHead>
                      <TableHead className="w-[140px] font-bold uppercase tracking-wider text-[9px] text-muted-foreground">Timeline</TableHead>
                      <TableHead className="text-right font-bold uppercase tracking-wider text-[9px] text-muted-foreground pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statusTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-16 text-center text-xs text-muted-foreground italic bg-secondary/5">
                          No tasks in this category.
                        </TableCell>
                      </TableRow>
                    ) : (
                      statusTasks.map((task) => {
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';
                        
                        return (
                          <TableRow 
                            key={task.id} 
                            className="group hover:bg-muted/5 transition-colors border-b last:border-0 cursor-default"
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onDragEnd={handleDragEnd}
                          >
                            <TableCell className="px-2">
                              <div className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-primary transition-colors p-1 rounded">
                                <GripVertical size={16} />
                              </div>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex flex-col gap-1">
                                <span 
                                  className="text-xs sm:text-sm font-bold group-hover:text-primary transition-colors cursor-pointer" 
                                  onClick={() => onEditTask(task)}
                                >
                                  {task.title}
                                </span>
                                {task.description && (
                                  <span className="text-[10px] text-muted-foreground font-medium line-clamp-1">
                                    {task.description}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'}
                                className="text-[8px] sm:text-[9px] font-black uppercase tracking-tighter px-1.5 h-4 sm:h-5"
                              >
                                {task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {task.assignee ? (
                                <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-muted-foreground">
                                  <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[8px] sm:text-[10px] shrink-0">
                                    {task.assignee.charAt(0)}
                                  </div>
                                  <span className="truncate">{task.assignee}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted/30 italic">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-0.5">
                                {task.dueDate && (
                                  <div className={cn(
                                    "flex items-center gap-1 text-[9px] font-black",
                                    isOverdue ? "text-destructive" : "text-muted-foreground/80"
                                  )}>
                                    <Calendar size={9} className={cn(isOverdue ? "text-destructive" : "text-primary/40")} />
                                    <span>{format(new Date(task.dueDate), 'MMM d')}</span>
                                    {isOverdue && <AlertCircle size={9} />}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <div className="flex justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg"
                                  onClick={() => onEditTask(task)}
                                >
                                  <Edit2 size={12} />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive rounded-lg"
                                  onClick={() => onDeleteTask(task.id)}
                                >
                                  <Trash2 size={12} />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
