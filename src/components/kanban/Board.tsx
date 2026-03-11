
"use client";

import { useState, useMemo } from 'react';
import { Plus, Sparkles, Settings2, User, Calendar as CalendarIcon, LayoutDashboard, List as ListIcon, TrendingUp } from 'lucide-react';
import { Task, TaskStatus, Project, List, TaskPriority, Subtask, StatusConfig, UserProfile } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { ListView } from './ListView';
import { CalendarView } from './CalendarView';
import { Overview } from '@/components/dashboard/Overview';
import { StatusManager } from '@/components/settings/StatusManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskRefinerModal } from '@/components/ai/TaskRefinerModal';
import { EditTaskModal } from './EditTaskModal';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, orderBy, where, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';

const DEFAULT_COLUMNS: StatusConfig[] = [
  { id: 'def-1', label: 'To Do', value: 'todo', color: '#A78BFA', order: 0 },
  { id: 'def-2', label: 'In Progress', value: 'in-progress', color: '#93C5FD', order: 1 },
  { id: 'def-3', label: 'Done', value: 'done', color: '#6EE7B7', order: 2, isDone: true },
];

export function Board({ project, list, tasks, onAddTask, onUpdateTask, onUpdateStatus, onDeleteTask }: BoardProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [isRefinerOpen, setIsRefinerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'kanban' | 'list' | 'calendar' | 'dashboard' | 'settings'>('kanban');
  
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    priority: 'medium' as TaskPriority,
    assignee: '',
    dueDate: ''
  });
  const { toast } = useToast();

  const workspaceOwnerId = project.ownerId;
  const statusConfigsRef = useMemoFirebase(() => {
    if (!workspaceOwnerId || !project.id || !list.id || !firestore) return null;
    return query(
      collection(firestore, 'users', workspaceOwnerId, 'projects', project.id, 'lists', list.id, 'status_configs'), 
      orderBy('order')
    );
  }, [workspaceOwnerId, project.id, list.id, firestore]);

  const { data: customStatuses } = useCollection<StatusConfig>(statusConfigsRef);
  const columns = (customStatuses && customStatuses.length > 0) ? customStatuses : DEFAULT_COLUMNS;

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceOwnerId) return null;
    return query(collection(firestore, 'users'), where('invitedById', '==', workspaceOwnerId));
  }, [firestore, workspaceOwnerId]);
  
  const ownerRef = useMemoFirebase(() => {
    if (!firestore || !workspaceOwnerId) return null;
    return doc(firestore, 'users', workspaceOwnerId);
  }, [firestore, workspaceOwnerId]);

  const myProfileRef = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user?.uid, firestore]);

  const { data: invitedMembers } = useCollection<UserProfile>(membersQuery);
  const { data: ownerProfile } = useDoc<UserProfile>(ownerRef);
  const { data: myProfile } = useDoc<UserProfile>(myProfileRef);

  const allMembers = useMemo(() => {
    const baseMembers = [...(ownerProfile ? [ownerProfile] : []), ...(invitedMembers || [])];
    const uniqueMembers = Array.from(new Map(baseMembers.map(m => [m.id, m])).values());
    
    if (myProfile && !uniqueMembers.find(m => m.id === myProfile.id)) {
      uniqueMembers.push(myProfile);
    }
    
    return uniqueMembers;
  }, [ownerProfile, invitedMembers, myProfile]);

  const handleAddTask = () => {
    if (!newTask.title) return;
    onAddTask({ ...newTask, listId: list.id, status: columns[0]?.value || 'todo' });
    setNewTask({ title: '', description: '', priority: 'medium', assignee: '', dueDate: '' });
    setIsAddTaskOpen(false);
    toast({ title: "Task Created" });
  };

  return (
    <div className="flex flex-col h-full space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-4 sm:p-6 rounded-2xl border shadow-sm transition-all">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
             <h1 className="text-xl sm:text-2xl font-bold text-primary tracking-tight truncate">{list.name}</h1>
             <Badge variant="outline" className="text-[8px] sm:text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 opacity-60">
                {project.name}
             </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm line-clamp-1">{list.description || "Project workstream."}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <ScrollArea className="w-full sm:w-auto whitespace-nowrap">
            <Tabs value={viewType} onValueChange={(v) => setViewType(v as any)} className="bg-muted/30 p-1 rounded-lg">
              <TabsList className="bg-transparent h-8 p-0 gap-1">
                <TabsTrigger value="kanban" className="h-7 text-[8px] sm:text-[9px] uppercase font-bold tracking-widest px-2 sm:px-3">Board</TabsTrigger>
                <TabsTrigger value="list" className="h-7 text-[8px] sm:text-[9px] uppercase font-bold tracking-widest px-2 sm:px-3">List</TabsTrigger>
                <TabsTrigger value="calendar" className="h-7 text-[8px] sm:text-[9px] uppercase font-bold tracking-widest px-2 sm:px-3">Cal</TabsTrigger>
                <TabsTrigger value="dashboard" className="h-7 text-[8px] sm:text-[9px] uppercase font-bold tracking-widest px-2 sm:px-3">Dash</TabsTrigger>
                <TabsTrigger value="settings" className="h-7 text-[8px] sm:text-[9px] uppercase font-bold tracking-widest px-2 sm:px-3">Work</TabsTrigger>
              </TabsList>
            </Tabs>
          </ScrollArea>
          
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={() => setIsRefinerOpen(true)} className="flex-1 sm:flex-none border-primary text-primary h-8 text-[9px] font-bold uppercase tracking-widest">
              <Sparkles size={12} className="mr-2" /> AI Refine
            </Button>
            
            <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="flex-1 sm:flex-none h-8 text-[9px] font-bold uppercase tracking-widest px-4">
                  <Plus size={12} className="mr-2" /> New
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md rounded-2xl">
                <DialogHeader><DialogTitle>Add New Task</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Task Title</Label>
                    <Input placeholder="Enter task name..." value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={newTask.priority} onValueChange={(v: TaskPriority) => setNewTask({ ...newTask, priority: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Assignee</Label>
                      <Select value={newTask.assignee} onValueChange={(v) => setNewTask({ ...newTask, assignee: v })}>
                        <SelectTrigger><SelectValue placeholder="Member" /></SelectTrigger>
                        <SelectContent>
                          {allMembers.map((member) => (
                            <SelectItem key={member.id} value={`${member.firstName} ${member.lastName}`}>{member.firstName} {member.lastName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={() => setIsAddTaskOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                  <Button onClick={handleAddTask} disabled={!newTask.title} className="w-full sm:w-auto">Create Task</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        {viewType === 'dashboard' ? (
          <ScrollArea className="h-full">
            <Overview 
              projects={[project]} 
              tasks={tasks}
              onUpdateTask={onUpdateTask}
              onDeleteTask={onDeleteTask}
              workspaceOwnerId={workspaceOwnerId || ''}
              availableStatuses={columns}
            />
          </ScrollArea>
        ) : viewType === 'kanban' ? (
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 h-full scrollbar-hide">
            {columns.map((col) => {
              const columnTasks = tasks.filter((t) => t.status === col.value);
              return (
                <div
                  key={col.value}
                  className={cn("kanban-column min-w-[280px] sm:min-w-[320px] max-w-[320px] flex flex-col h-full", dragOverColumn === col.value && "kanban-column-active")}
                  onDragOver={(e) => { e.preventDefault(); setDragOverColumn(col.value); }}
                  onDragLeave={() => setDragOverColumn(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverColumn(null);
                    const taskId = e.dataTransfer.getData('taskId');
                    onUpdateStatus(taskId, col.value);
                  }}
                >
                  <div className="flex justify-between items-center px-1 mb-4">
                    <h2 className="font-bold text-[10px] uppercase tracking-widest flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      {col.label}
                      <span className="bg-muted px-2 py-0.5 rounded-full">{columnTasks.length}</span>
                    </h2>
                  </div>
                  <ScrollArea className="flex-1 -mx-2 px-2">
                    <div className="space-y-4 pb-4">
                      {columnTasks.map((task) => (
                        <TaskCard key={task.id} task={task} onDelete={onDeleteTask} onEdit={setEditingTask} statusColor={col.color} />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              );
            })}
          </div>
        ) : viewType === 'list' ? (
          <ScrollArea className="h-full">
            <ListView tasks={tasks} onUpdateStatus={onUpdateStatus} onDeleteTask={onDeleteTask} onEditTask={setEditingTask} availableStatuses={columns} />
          </ScrollArea>
        ) : viewType === 'calendar' ? (
          <ScrollArea className="h-full">
            <CalendarView tasks={tasks} onEditTask={setEditingTask} />
          </ScrollArea>
        ) : (
          <ScrollArea className="h-full bg-card rounded-2xl border p-4 sm:p-8">
            <StatusManager 
              projectId={project.id} 
              listId={list.id}
              workspaceOwnerId={workspaceOwnerId} 
            />
          </ScrollArea>
        )}
      </div>

      <TaskRefinerModal 
        isOpen={isRefinerOpen}
        onClose={() => setIsRefinerOpen(false)}
        projectContext={list.description}
        onSubtasksGenerated={(subs, desc) => onAddTask({ 
          title: desc.slice(0, 50), 
          description: desc, 
          subtasks: subs.map(s => ({ id: Math.random().toString(36), title: s, completed: false })), 
          listId: list.id,
          status: columns[0]?.value || 'todo'
        })}
      />

      <EditTaskModal 
        task={editingTask}
        isOpen={!!editingTask}
        onClose={() => setEditingTask(null)}
        onUpdate={onUpdateTask}
        onDelete={onDeleteTask}
        availableStatuses={columns}
        workspaceOwnerId={workspaceOwnerId}
      />
    </div>
  );
}
