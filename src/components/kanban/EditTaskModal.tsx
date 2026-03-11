
"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { Task, TaskStatus, TaskPriority, Subtask, StatusConfig, UserProfile, TimeEntry, Notification, Comment, Attachment } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  User, CheckSquare, Calendar as CalendarIcon, Clock, Plus, Trash2, DollarSign, MessageSquare, Send, Paperclip, ExternalLink, Briefcase
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, setDoc } from 'firebase/firestore';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface EditTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => void;
  onDelete: (taskId: string) => void;
  availableStatuses: StatusConfig[];
  workspaceOwnerId: string;
}

export function EditTaskModal({ task, isOpen, onClose, onUpdate, onDelete, availableStatuses, workspaceOwnerId }: EditTaskModalProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [formData, setFormData] = useState<Partial<Task>>({});
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const lastTaskId = useRef<string | null>(null);

  const [newTimeEntry, setNewTimeEntry] = useState({ 
    hours: '', 
    rate: '',
    date: format(new Date(), 'yyyy-MM-dd'), 
    description: '' 
  });
  const { toast } = useToast();

  useEffect(() => {
    if (task && (lastTaskId.current !== task.id || isOpen)) {
      setFormData({ ...task, attachments: task.attachments || [], timeEntries: task.timeEntries || [] });
      lastTaskId.current = task.id;
    }
    if (!isOpen) {
      lastTaskId.current = null;
    }
  }, [task, isOpen]);

  const membersQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceOwnerId) return null;
    return query(
      collection(firestore, 'users'),
      where('invitedById', '==', workspaceOwnerId)
    );
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

  if (!task) return null;

  const handleSave = () => {
    if (formData.assigneeId && formData.assigneeId !== task.assigneeId && firestore) {
      const selectedMember = allMembers.find(m => m.id === formData.assigneeId);
      if (selectedMember) {
        const notifRef = doc(collection(firestore, 'users', selectedMember.id, 'notifications'));
        const notification: Notification = {
          id: notifRef.id,
          title: "New Task Assigned",
          message: `You have been assigned to task: "${formData.title}"`,
          type: 'task',
          read: false,
          createdAt: new Date().toISOString(),
          relatedId: task.id
        };
        setDoc(notifRef, notification);
      }
    }
    onUpdate(task.id, formData);
    onClose();
    toast({ title: "Task Updated" });
  };

  const handleAddAttachment = () => {
    if (!attachmentName || !attachmentUrl) return;
    const newAttachment: Attachment = {
      id: Math.random().toString(36).substr(2, 9),
      name: attachmentName,
      url: attachmentUrl,
      createdAt: new Date().toISOString()
    };
    setFormData({ ...formData, attachments: [...(formData.attachments || []), newAttachment] });
    setAttachmentName('');
    setAttachmentUrl('');
  };

  const removeAttachment = (id: string) => {
    setFormData({ ...formData, attachments: (formData.attachments || []).filter(a => a.id !== id) });
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSubtask: Subtask = {
      id: Math.random().toString(36).substr(2, 9),
      title: newSubtaskTitle,
      completed: false
    };
    setFormData({ ...formData, subtasks: [...(formData.subtasks || []), newSubtask] });
    setNewSubtaskTitle('');
  };

  const handleAddComment = () => {
    if (!newCommentText.trim() || !myProfile || !firestore) return;
    
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      text: newCommentText,
      createdAt: new Date().toISOString(),
      userName: `${myProfile.firstName} ${myProfile.lastName}`
    };

    // Detect Mentions
    const mentionRegex = /@(\w+)/g;
    const matches = newCommentText.match(mentionRegex);
    if (matches) {
      matches.forEach(mention => {
        const namePart = mention.substring(1).toLowerCase();
        const mentionedUser = allMembers.find(m => 
          m.firstName.toLowerCase().includes(namePart) || 
          m.lastName.toLowerCase().includes(namePart)
        );
        
        if (mentionedUser && mentionedUser.id !== user?.uid) {
          const notifRef = doc(collection(firestore, 'users', mentionedUser.id, 'notifications'));
          const notification: Notification = {
            id: notifRef.id,
            title: "You were mentioned",
            message: `${myProfile.firstName} mentioned you in task "${task.title}": "${newCommentText.slice(0, 50)}..."`,
            type: 'task',
            read: false,
            createdAt: new Date().toISOString(),
            relatedId: task.id
          };
          setDoc(notifRef, notification);
        }
      });
    }

    setFormData({ ...formData, comments: [...(formData.comments || []), newComment] });
    setNewCommentText('');
  };

  const handleAddTimeEntry = () => {
    const hours = parseFloat(newTimeEntry.hours);
    const rate = parseFloat(newTimeEntry.rate);
    if (isNaN(hours)) return;

    const entry: TimeEntry = {
      id: Math.random().toString(36).substr(2, 9),
      hours,
      rate: isNaN(rate) ? 0 : rate,
      amount: hours * (isNaN(rate) ? 0 : rate),
      date: newTimeEntry.date,
      description: newTimeEntry.description
    };

    setFormData({ ...formData, timeEntries: [...(formData.timeEntries || []), entry] });
    setNewTimeEntry({ hours: '', rate: '', date: format(new Date(), 'yyyy-MM-dd'), description: '' });
  };

  const removeTimeEntry = (id: string) => {
    setFormData({ ...formData, timeEntries: (formData.timeEntries || []).filter(e => e.id !== id) });
  };

  const totalLoggedHours = (formData.timeEntries || []).reduce((acc, curr) => acc + (curr.hours || 0), 0);
  const totalAmount = (formData.timeEntries || []).reduce((acc, curr) => acc + (curr.amount || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[850px] w-[95vw] h-[90vh] max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="p-6 pb-2 shrink-0 border-b bg-card">
          <div className="flex justify-between items-center pr-8">
            <DialogTitle className="text-2xl font-bold text-primary">Edit Task</DialogTitle>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
                <Clock size={14} />
                {totalLoggedHours}h Total
              </div>
              <div className="flex items-center gap-2 text-sm font-bold bg-accent/10 text-accent px-3 py-1 rounded-full">
                <DollarSign size={14} />
                ${totalAmount.toFixed(0)}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full w-full">
            <div className="px-6 py-6 space-y-8 pb-20">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label>Task Title</Label>
                  <Input value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableStatuses.map(s => (
                        <SelectItem key={s.id} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(value: TaskPriority) => setFormData({ ...formData, priority: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input type="date" value={formData.dueDate || ''} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} />
                 </div>
                 <div className="space-y-2">
                    <Label>Assignee</Label>
                    <Select value={formData.assigneeId || ''} onValueChange={(v) => {
                      const member = allMembers.find(m => m.id === v);
                      setFormData({ 
                        ...formData, 
                        assigneeId: v, 
                        assignee: member ? `${member.firstName} ${member.lastName}` : '' 
                      });
                    }}>
                      <SelectTrigger><SelectValue placeholder="Select Member" /></SelectTrigger>
                      <SelectContent>
                        {allMembers.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                 </div>
              </div>

              {/* Attachments Section */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Paperclip className="h-5 w-5 text-primary" /> Attachments & Links
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/20 p-4 rounded-xl border">
                  <div className="md:col-span-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="Name (e.g. Design Doc)" value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} />
                      <Input placeholder="URL (e.g. google.com/...)" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} />
                    </div>
                  </div>
                  <Button onClick={handleAddAttachment} disabled={!attachmentName || !attachmentUrl} className="w-full">
                    <Plus size={14} className="mr-2" /> Add Link
                  </Button>
                  <div className="col-span-full space-y-2">
                    {(formData.attachments || []).map((att) => (
                      <div key={att.id} className="flex items-center justify-between p-2 bg-card rounded border text-sm group">
                        <a href={att.url.startsWith('http') ? att.url : `https://${att.url}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-primary hover:underline">
                          <ExternalLink size={14} />
                          <span className="font-bold">{att.name}</span>
                        </a>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeAttachment(att.id)}>
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Time Tracking Section */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2 text-base font-semibold">
                  <Briefcase className="h-5 w-5 text-primary" /> Time Tracking & Billing
                </Label>
                <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-4">
                   <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Hours</Label>
                        <Input type="number" placeholder="0.0" value={newTimeEntry.hours} onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Rate ($)</Label>
                        <Input type="number" placeholder="50" value={newTimeEntry.rate} onChange={(e) => setNewTimeEntry({ ...newTimeEntry, rate: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase font-bold">Date</Label>
                        <Input type="date" value={newTimeEntry.date} onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })} />
                      </div>
                      <Button onClick={handleAddTimeEntry} disabled={!newTimeEntry.hours} className="bg-primary hover:bg-primary/90">
                        <Plus size={14} className="mr-2" /> Log Time
                      </Button>
                   </div>
                   
                   <ScrollArea className="h-[120px] bg-card rounded-md border">
                      <div className="p-2 space-y-1">
                        {(formData.timeEntries || []).length === 0 ? (
                          <p className="text-[10px] text-muted-foreground italic text-center py-8">No time logged for this task.</p>
                        ) : (
                          (formData.timeEntries || []).map((entry) => (
                            <div key={entry.id} className="flex items-center justify-between p-2 rounded hover:bg-muted text-[11px] group">
                               <div className="flex items-center gap-4">
                                  <span className="font-bold text-primary">{entry.hours}h</span>
                                  <span className="text-muted-foreground">${entry.rate}/hr</span>
                                  <span className="font-medium">${entry.amount?.toFixed(2)}</span>
                                  <span className="text-muted-foreground opacity-60">| {entry.date}</span>
                               </div>
                               <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100" onClick={() => removeTimeEntry(entry.id)}>
                                 <Trash2 size={10} />
                               </Button>
                            </div>
                          ))
                        )}
                      </div>
                   </ScrollArea>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="min-h-[100px]" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Subtasks Section */}
                <div className="space-y-4">
                  <Label className="flex items-center gap-2 text-base font-semibold">
                    <CheckSquare className="h-5 w-5 text-primary" /> Sub-tasks
                  </Label>
                  <div className="space-y-2 bg-secondary/10 p-4 rounded-xl border">
                    {(formData.subtasks || []).map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 p-1">
                        <Checkbox checked={sub.completed} onCheckedChange={() => setFormData({ ...formData, subtasks: formData.subtasks?.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s) })} />
                        <span className={cn("flex-1 text-sm", sub.completed && "line-through text-muted-foreground")}>{sub.title}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-4 pt-2 border-t">
                      <Input placeholder="Add sub-task..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()} className="flex-1" />
                      <Button variant="secondary" onClick={handleAddSubtask}>Add</Button>
                    </div>
                  </div>
                </div>

                {/* Comments Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base font-semibold">
                      <MessageSquare className="h-5 w-5 text-primary" /> Comments
                    </Label>
                    <span className="text-[9px] uppercase font-bold text-muted-foreground opacity-60 tracking-widest">Use @name to mention</span>
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-[10px]">{myProfile?.firstName?.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex flex-col gap-2">
                        <Textarea placeholder="Add a comment... try @name" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} className="min-h-[60px]" />
                        <Button size="sm" onClick={handleAddComment} disabled={!newCommentText.trim()} className="w-fit ml-auto"><Send size={14} className="mr-2" />Post</Button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(formData.comments || []).slice().reverse().map((c) => (
                        <div key={c.id} className="bg-muted/30 p-3 rounded-lg border text-xs">
                          <div className="flex justify-between mb-1">
                            <span className="font-bold">{c.userName}</span>
                            <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                          </div>
                          <p>{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="p-6 border-t bg-card shrink-0 flex flex-row items-center justify-between">
          <Button variant="destructive" size="sm" onClick={() => { onDelete(task.id); onClose(); }} className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white">
            <Trash2 className="mr-2 h-4 w-4" /> Delete Task
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary hover:bg-primary/90">Save Changes</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
