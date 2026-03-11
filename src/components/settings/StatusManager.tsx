
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusConfig } from '@/lib/types';
import { Plus, Trash2, GripVertical, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export const DEFAULT_STATUSES: Omit<StatusConfig, 'id'>[] = [
  { label: 'To Do', value: 'todo', color: '#A78BFA', order: 0, isDone: false },
  { label: 'In Progress', value: 'in-progress', color: '#93C5FD', order: 1, isDone: false },
  { label: 'Done', value: 'done', color: '#6EE7B7', order: 2, isDone: true },
];

interface StatusManagerProps {
  projectId: string;
  listId: string;
  workspaceOwnerId: string;
}

export function StatusManager({ projectId, listId, workspaceOwnerId }: StatusManagerProps) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#93C5FD');
  const [isDone, setIsDone] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const statusConfigsRef = useMemoFirebase(() => {
    if (!workspaceOwnerId || !projectId || !listId || !firestore) return null;
    return query(
      collection(firestore, 'users', workspaceOwnerId, 'projects', projectId, 'lists', listId, 'status_configs'), 
      orderBy('order')
    );
  }, [workspaceOwnerId, projectId, listId, firestore]);

  const { data: statusConfigs, isLoading: isStatusesLoading } = useCollection<StatusConfig>(statusConfigsRef);

  const statusesToDisplay = useMemo(() => {
    return (statusConfigs && statusConfigs.length > 0) 
      ? statusConfigs 
      : DEFAULT_STATUSES.map((s, i) => ({ ...s, id: `default-${i}` } as StatusConfig));
  }, [statusConfigs]);

  const seedDefaultsIfEmpty = () => {
    if (!firestore || !workspaceOwnerId || !projectId || !listId) return;
    if (!statusConfigs || statusConfigs.length === 0) {
      DEFAULT_STATUSES.forEach((ds, idx) => {
        const id = `seeded-${idx}-${Math.random().toString(36).substr(2, 5)}`;
        const docRef = doc(firestore, 'users', workspaceOwnerId, 'projects', projectId, 'lists', listId, 'status_configs', id);
        setDoc(docRef, { ...ds, id, order: idx });
      });
    }
  };

  const handleUpdateStatus = (status: StatusConfig, updates: Partial<StatusConfig>) => {
    if (!workspaceOwnerId || !projectId || !listId || !firestore) return;
    
    if (status.id.startsWith('default-')) {
      seedDefaultsIfEmpty();
    }

    const statusId = status.id.startsWith('default-') ? `seeded-${status.id.split('-')[1]}-${Math.random().toString(36).substr(2, 5)}` : status.id;
    const docRef = doc(firestore, 'users', workspaceOwnerId, 'projects', projectId, 'lists', listId, 'status_configs', statusId);
    
    const data = { ...status, ...updates, id: statusId };
    setDoc(docRef, data, { merge: true }).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'update',
        requestResourceData: data
      }));
    });
  };

  const handleAddStatus = () => {
    if (!newLabel.trim() || !workspaceOwnerId || !projectId || !listId || !firestore) return;
    
    if (!statusConfigs || statusConfigs.length === 0) {
      seedDefaultsIfEmpty();
    }

    const value = newLabel.toLowerCase().replace(/\s+/g, '-');
    const order = statusesToDisplay.length;
    const id = Math.random().toString(36).substr(2, 9);
    const docRef = doc(firestore, 'users', workspaceOwnerId, 'projects', projectId, 'lists', listId, 'status_configs', id);
    const data = { id, label: newLabel, value, color: newColor, order, isDone };

    setDoc(docRef, data).catch(async (err) => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'create',
        requestResourceData: data
      }));
    });

    setNewLabel('');
    setIsDone(false);
    toast({ title: "Status Added", description: `"${newLabel}" has been added to the workflow.` });
  };

  const handleDeleteStatus = (status: StatusConfig) => {
    if (!workspaceOwnerId || !projectId || !listId || !firestore) return;
    
    if (status.id.startsWith('default-')) {
      DEFAULT_STATUSES.forEach((ds, idx) => {
        if (`default-${idx}` !== status.id) {
          const id = `seeded-${idx}-${Math.random().toString(36).substr(2, 5)}`;
          const docRef = doc(firestore, 'users', workspaceOwnerId, 'projects', projectId, 'lists', listId, 'status_configs', id);
          setDoc(docRef, { ...ds, id, order: idx });
        }
      });
      toast({ title: "Status Removed" });
      return;
    }

    const docRef = doc(firestore, 'users', workspaceOwnerId, 'projects', projectId, 'lists', listId, 'status_configs', status.id);
    deleteDoc(docRef);
    toast({ title: "Status Removed" });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || !firestore) return;

    if (!statusConfigs || statusConfigs.length === 0) {
      seedDefaultsIfEmpty();
      setDraggedIndex(null);
      return;
    }

    const newStatuses = [...statusesToDisplay];
    const draggedItem = newStatuses[draggedIndex];
    newStatuses.splice(draggedIndex, 1);
    newStatuses.splice(dropIndex, 0, draggedItem);

    newStatuses.forEach((status, index) => {
      const docRef = doc(firestore, 'users', workspaceOwnerId, 'projects', projectId, 'lists', listId, 'status_configs', status.id);
      const data = { ...status, order: index };
      setDoc(docRef, data, { merge: true });
    });

    setDraggedIndex(null);
    toast({ title: "Order Updated" });
  };

  if (isStatusesLoading) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-pop-in">
      <header>
        <h3 className="text-xl font-bold text-primary">List Workflow</h3>
        <p className="text-sm text-muted-foreground">Customize columns specifically for this list. Reorder by dragging items.</p>
      </header>
      
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end bg-bg-inner p-6 rounded-2xl border border-border">
        <div className="sm:col-span-2 space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status Name</Label>
          <Input 
            placeholder="e.g. Under Review" 
            value={newLabel} 
            onChange={(e) => setNewLabel(e.target.value)}
            className="bg-card h-12"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Settings</Label>
          <div className="flex gap-4 items-center h-12 bg-card rounded-md border px-3">
            <div className="relative h-6 w-6 rounded-full border overflow-hidden">
              <input 
                type="color" 
                value={newColor} 
                onChange={(e) => setNewColor(e.target.value)} 
                className="absolute inset-[-10px] cursor-pointer" 
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="is-done" checked={isDone} onCheckedChange={(v) => setIsDone(!!v)} />
              <Label htmlFor="is-done" className="text-[10px] font-bold cursor-pointer text-muted-foreground">IS DONE</Label>
            </div>
          </div>
        </div>
        <Button onClick={handleAddStatus} disabled={!newLabel.trim()} className="w-full h-12 font-bold uppercase tracking-widest text-[10px] bg-primary hover:bg-primary/90">
          <Plus size={14} className="mr-2" /> Add Column
        </Button>
      </div>

      <div className="space-y-3">
        {statusesToDisplay.map((status, index) => (
          <div 
            key={status.id} 
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border bg-card hover:border-primary/30 transition-all group cursor-default shadow-sm",
              draggedIndex === index && "opacity-50 grayscale scale-[0.98] border-primary"
            )}
          >
            <div className="flex items-center gap-4 flex-1">
              <div className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-primary p-1 rounded-md hover:bg-muted/50 transition-colors">
                <GripVertical className="h-4 w-4" />
              </div>
              <div 
                className="w-3.5 h-3.5 rounded-full shadow-inner ring-2 ring-background" 
                style={{ backgroundColor: status.color }} 
              />
              <input
                className="font-bold text-sm bg-transparent border-none focus:outline-none flex-1 focus:text-primary transition-colors"
                value={status.label}
                onChange={(e) => handleUpdateStatus(status, { label: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline"
                  className={cn(
                    "text-[8px] h-7 px-3 font-bold uppercase tracking-widest rounded-full transition-all", 
                    status.isDone 
                      ? "bg-status-done/10 border-status-done/20 text-status-done hover:bg-status-done/20" 
                      : "bg-muted/50 text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20"
                  )}
                  onClick={() => handleUpdateStatus(status, { isDone: !status.isDone })}
                >
                  {status.isDone ? (
                    <><CheckCircle2 size={10} className="mr-1" /> Completed</>
                  ) : (
                    'Set as Done'
                  )}
                </Button>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive ml-2" 
              onClick={() => handleDeleteStatus(status)}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
