
"use client";

import { useMemo, useState, useEffect } from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  CheckCircle2, 
  AlertTriangle, 
  PauseCircle, 
  LayoutList,
  Activity,
  Loader2,
  Clock,
  User,
  ArrowRight
} from 'lucide-react';
import { Project, Task, StatusConfig, List } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, isSameDay, parseISO } from 'date-fns';
import { MiniCalendar } from './MiniCalendar';
import { EditTaskModal } from '@/components/kanban/EditTaskModal';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface OverviewProps {
  projects: Project[];
  tasks: Task[];
  lists?: List[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  workspaceOwnerId: string;
  availableStatuses: StatusConfig[];
}

export function Overview({ projects, tasks, lists, onUpdateTask, onDeleteTask, workspaceOwnerId, availableStatuses }: OverviewProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isSingleSpace = projects.length === 1;

  const metrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => availableStatuses.find(s => s.value === t.status)?.isDone).length;
    const waiting = tasks.filter(t => ['waiting', 'hold', 'on-hold'].includes(t.status.toLowerCase())).length;
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && !availableStatuses.find(s => s.value === t.status)?.isDone).length;
    
    return { total, completed, waiting, overdue };
  }, [tasks, availableStatuses]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (!selectedDate) return sortedTasks;
    return sortedTasks.filter(t => t.dueDate && isSameDay(parseISO(t.dueDate), selectedDate));
  }, [sortedTasks, selectedDate]);

  const statusDistribution = useMemo(() => {
    return availableStatuses.map(s => ({
      name: s.label,
      value: tasks.filter(t => t.status === s.value).length,
      color: s.color
    })).filter(d => d.value > 0);
  }, [tasks, availableStatuses]);

  const progressItems = useMemo(() => {
    if (isSingleSpace && lists) {
      // In single space view, show List Progress sorted A-Z
      return lists.map(l => {
        const lTasks = tasks.filter(t => t.listId === l.id);
        const done = lTasks.filter(t => availableStatuses.find(s => s.value === t.status)?.isDone).length;
        return {
          id: l.id,
          name: l.name,
          progress: lTasks.length > 0 ? (done / lTasks.length) * 100 : 0,
          completed: done,
          total: lTasks.length
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // In overall view, show Space Progress
      return projects.map(p => {
        const pTasks = tasks.filter(t => t.projectId === p.id);
        const done = pTasks.filter(t => availableStatuses.find(s => s.value === t.status)?.isDone).length;
        return {
          id: p.id,
          name: p.name,
          progress: pTasks.length > 0 ? (done / pTasks.length) * 100 : 0,
          completed: done,
          total: pTasks.length
        };
      }).sort((a, b) => b.progress - a.progress);
    }
  }, [isSingleSpace, projects, lists, tasks, availableStatuses]);

  const activeItems = useMemo(() => {
    if (isSingleSpace) {
      return tasks.slice().sort((a, b) => {
        const dateA = new Date(a.updatedAt || a.createdAt);
        const dateB = new Date(b.updatedAt || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      }).slice(0, 5).map(t => ({
        id: t.id,
        name: t.title,
        lastUpdate: new Date(t.updatedAt || t.createdAt),
        assignee: t.assignee
      }));
    } else {
      return projects.map(p => {
        const pTasks = tasks.filter(t => t.projectId === p.id);
        const lastUpdate = pTasks.reduce((latest, t) => {
          const tDate = new Date(t.updatedAt || t.createdAt);
          return tDate > latest ? tDate : latest;
        }, new Date(p.createdAt));
        
        const assignees = Array.from(new Set(pTasks.map(t => t.assignee).filter(Boolean)));
        return { id: p.id, name: p.name, lastUpdate, assignees };
      }).sort((a, b) => b.lastUpdate.getTime() - a.lastUpdate.getTime()).slice(0, 5);
    }
  }, [isSingleSpace, projects, tasks]);

  const needsAttention = useMemo(() => {
    return tasks.filter(t => {
      const isDone = availableStatuses.find(s => s.value === t.status)?.isDone;
      const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
      return (isOverdue || t.priority === 'high') && !isDone;
    }).slice(0, 5);
  }, [tasks, availableStatuses]);

  if (!isMounted) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-8 animate-fade-in pb-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Tasks" value={metrics.total} icon={<LayoutList className="text-primary" />} color="primary" />
        <StatCard title="Completed" value={metrics.completed} icon={<CheckCircle2 className="text-status-done" />} color="accent" />
        <StatCard title="Waiting / On Hold" value={metrics.waiting} icon={<PauseCircle className="text-status-hold" />} color="muted" />
        <StatCard title="Overdue" value={metrics.overdue} icon={<AlertTriangle className="text-status-overdue" />} color="destructive" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        <div className="lg:col-span-3 space-y-8">
          <Card className="shadow-sm border-none bg-card flex flex-col h-[400px]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                {isSingleSpace ? "Recent Tasks" : "Overall Task View"}
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 px-4 pb-4">
              <div className="space-y-3">
                {filteredTasks.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-10 italic">No tasks found.</p>
                ) : (
                  filteredTasks.map(task => {
                    const listName = lists?.find(l => l.id === task.listId)?.name;
                    return (
                      <div 
                        key={task.id} 
                        onClick={() => setEditingTask(task)}
                        className="p-3 rounded-lg border bg-bg-inner hover:bg-muted/10 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs truncate group-hover:text-primary transition-colors">{task.title}</h4>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                              {isSingleSpace && listName ? listName : (projects.find(p => p.id === task.projectId)?.name || 'Unknown Space')}
                            </p>
                          </div>
                          <div 
                            className="w-2 h-2 rounded-full shrink-0 mt-1" 
                            style={{ backgroundColor: availableStatuses.find(s => s.value === task.status)?.color || '#ccc' }} 
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-[9px] font-bold text-muted-foreground uppercase">
                          <Clock size={10} className="text-primary" />
                          {task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'No due date'}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>

          <Card className="shadow-sm border-none bg-card p-4">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Status Calendar</CardTitle>
            </CardHeader>
            <MiniCalendar 
              tasks={tasks} 
              availableStatuses={availableStatuses}
              selectedDate={selectedDate}
              onDateSelect={(date) => setSelectedDate(isSameDay(date, selectedDate || new Date(0)) ? null : date)}
            />
          </Card>
        </div>

        <div className="lg:col-span-7">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  {isSingleSpace ? "List Progress" : "Space Progress"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px] pr-4">
                  <div className="space-y-6">
                    {progressItems.map(item => (
                      <div key={item.id} className="space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold truncate max-w-[150px]">{item.name}</span>
                          <span className="text-muted-foreground font-medium">{Math.round(item.progress)}% ({item.completed}/{item.total})</span>
                        </div>
                        <Progress value={item.progress} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Task Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center h-[250px]">
                <div className="w-full h-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-bold">{metrics.total}</span>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">Total</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground">
                  {isSingleSpace ? "Recent Activity" : "Recent Activity"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px] pr-4">
                  <div className="space-y-4">
                    {activeItems.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/10 transition-colors">
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-bold truncate">{item.name}</h5>
                          <p className="text-[9px] text-muted-foreground font-medium">Updated {format(item.lastUpdate, 'MMM d, p')}</p>
                        </div>
                        <div className="flex -space-x-2 ml-2">
                           <Avatar className="h-6 w-6 border-2 border-card">
                             <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">
                               {(item.assignee || 'U').charAt(0)}
                             </AvatarFallback>
                           </Avatar>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-none bg-card">
              <CardHeader>
                <CardTitle className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Activity size={16} className="text-status-overdue" />
                  Needs Attention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px] pr-4">
                  <div className="space-y-3">
                    {needsAttention.length === 0 ? (
                      <p className="text-center text-muted-foreground text-[10px] py-10 italic">No items require immediate attention.</p>
                    ) : (
                      needsAttention.map(task => {
                        const listName = lists?.find(l => l.id === task.listId)?.name;
                        return (
                          <div 
                            key={task.id} 
                            onClick={() => setEditingTask(task)}
                            className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer group"
                          >
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs font-bold truncate group-hover:text-destructive transition-colors">{task.title}</h5>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[8px] h-4 px-1 border-destructive/30 text-destructive bg-destructive/5 uppercase font-bold tracking-tighter">
                                  {isSingleSpace && listName ? listName : (projects.find(p => p.id === task.projectId)?.name || 'Space')}
                                </Badge>
                                <span className="text-[9px] font-medium text-muted-foreground flex items-center gap-1">
                                  <User size={9} /> {task.assignee || 'Unassigned'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right ml-2 shrink-0">
                              <p className="text-[9px] font-bold text-destructive uppercase tracking-widest">
                                {task.dueDate ? format(parseISO(task.dueDate), 'MMM d') : 'NO DATE'}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <EditTaskModal 
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onUpdate={onUpdateTask}
        onDelete={onDeleteTask}
        availableStatuses={availableStatuses}
        workspaceOwnerId={workspaceOwnerId}
      />
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  const borderColors: Record<string, string> = {
    primary: 'border-l-accent-blue',
    accent: 'border-l-status-done',
    muted: 'border-l-status-hold',
    destructive: 'border-l-status-overdue',
  };

  return (
    <Card className={cn("border-l-[4px] shadow-sm bg-card", borderColors[color])}>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
            <h3 className="text-2xl sm:text-3xl font-bold">{value}</h3>
          </div>
          <div className="bg-bg-inner p-2 rounded-lg">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
