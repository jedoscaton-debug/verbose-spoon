
"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Overview } from '@/components/dashboard/Overview';
import { Board } from '@/components/kanban/Board';
import { SidebarProvider, Sidebar, SidebarContent, SidebarTrigger } from '@/components/ui/sidebar';
import { Plus, FolderKanban, Loader2, List as ListIcon, Settings2, Trash2, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, deleteDoc, updateDoc, setDoc, where, onSnapshot, Unsubscribe, collectionGroup } from 'firebase/firestore';
import { Task, Project, List as ListType, ProjectVisibility, StatusConfig, Invitation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const DEFAULT_COLUMNS: StatusConfig[] = [
  { id: 'def-1', label: 'To Do', value: 'todo', color: '#A78BFA', order: 0 },
  { id: 'def-2', label: 'In Progress', value: 'in-progress', color: '#93C5FD', order: 1 },
  { id: 'def-3', label: 'Done', value: 'done', color: '#6EE7B7', order: 2, isDone: true },
];

function HomeContent() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const isOverallDashboard = searchParams.get('view') === 'overall';

  // 1. My Projects
  const myProjectsRef = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return collection(firestore, 'users', user.uid, 'projects');
  }, [user?.uid, firestore]);
  const { data: myProjectsData, isLoading: isMyProjectsLoading } = useCollection<Project>(myProjectsRef);

  // 2. Invitations to find shared projects
  const myInvitesQuery = useMemoFirebase(() => {
    if (!user?.email || !firestore) return null;
    return query(collection(firestore, 'invitations'), where('email', '==', user.email.toLowerCase()));
  }, [user?.email, firestore]);
  const { data: myInvites } = useCollection<Invitation>(myInvitesQuery);

  const [sharedProjects, setSharedProjects] = useState<Project[]>([]);

  useEffect(() => {
    if (!myInvites || !firestore || !user) return;
    const unsubscribes: Unsubscribe[] = [];
    const discoveredProjectsMap = new Map<string, Project>();

    myInvites.forEach((invite) => {
      if (!invite.inviterId) return;
      if (invite.projectId) {
        const pRef = doc(firestore, 'users', invite.inviterId, 'projects', invite.projectId);
        unsubscribes.push(onSnapshot(pRef, (snap) => {
          if (snap.exists()) discoveredProjectsMap.set(snap.id, { ...snap.data(), id: snap.id } as Project);
          else discoveredProjectsMap.delete(invite.projectId!);
          setSharedProjects(Array.from(discoveredProjectsMap.values()));
        }));
      } else {
        const workspaceProjectsRef = collection(firestore, 'users', invite.inviterId, 'projects');
        unsubscribes.push(onSnapshot(workspaceProjectsRef, (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'removed') discoveredProjectsMap.delete(change.doc.id);
            else discoveredProjectsMap.set(change.doc.id, { ...change.doc.data(), id: change.doc.id } as Project);
          });
          setSharedProjects(Array.from(discoveredProjectsMap.values()));
        }));
      }
    });
    return () => unsubscribes.forEach(unsub => unsub());
  }, [myInvites, firestore, user]);

  const allProjects = useMemo(() => {
    const combined = [...(myProjectsData || []), ...sharedProjects];
    return Array.from(new Map(combined.map(p => [p.id, p])).values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [myProjectsData, sharedProjects]);

  // Unified Dashboard Task Aggregation (Cross-space)
  const dashboardTasksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collectionGroup(firestore, 'tasks'));
  }, [firestore, user]);
  
  const { data: dashboardTasks, isLoading: isDashboardLoading } = useCollection<Task>(dashboardTasksQuery);

  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeList, setActiveList] = useState<ListType | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    if (activeProject || activeList) {
      if (isOverallDashboard) {
        const params = new URLSearchParams(searchParams);
        params.delete('view');
        router.push(`?${params.toString()}`);
      }
    }
  }, [activeProject, activeList, isOverallDashboard, router, searchParams]);

  useEffect(() => {
    if (isOverallDashboard) {
      setActiveProject(null);
      setActiveList(null);
      setActiveTab(null);
    }
  }, [isOverallDashboard]);

  const activeProjectListsRef = useMemoFirebase(() => {
    if (!activeProject || !firestore) return null;
    return collection(firestore, 'users', activeProject.ownerId, 'projects', activeProject.id, 'lists');
  }, [activeProject, firestore]);
  const { data: activeProjectLists } = useCollection<ListType>(activeProjectListsRef);

  const activeTasksRef = useMemoFirebase(() => {
    if (!activeProject || !firestore) return null;
    return query(
      collection(firestore, 'users', activeProject.ownerId, 'tasks'),
      where('projectId', '==', activeProject.id)
    );
  }, [activeProject, firestore]);
  const { data: activeTasks } = useCollection<Task>(activeTasksRef);

  const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
  const [isAddListOpen, setIsAddListOpen] = useState(false);
  const [isEditProjectOpen, setIsEditProjectOpen] = useState(false);
  const [isEditListOpen, setIsEditListOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editingList, setEditingList] = useState<ListType | null>(null);
  const [editingListProjectContext, setEditingListProjectContext] = useState<Project | null>(null);

  const [newProject, setNewProject] = useState({ name: '', description: '', visibility: 'workspace' as ProjectVisibility });
  const [newList, setNewList] = useState({ name: '', description: '', projectId: '' });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleCreateProject = useCallback(() => {
    if (!newProject.name || !user || !firestore) return;
    const projectDocRef = doc(collection(firestore, 'users', user.uid, 'projects'));
    const now = new Date().toISOString();
    const pData = { id: projectDocRef.id, name: newProject.name, description: newProject.description, ownerId: user.uid, creatorId: user.uid, visibility: newProject.visibility, createdAt: now, updatedAt: now };
    setDoc(projectDocRef, pData);
    setNewProject({ name: '', description: '', visibility: 'workspace' });
    setIsAddProjectOpen(false);
    toast({ title: "Space Created" });
  }, [newProject, user, firestore, toast]);

  const handleUpdateProject = useCallback(() => {
    if (!editingProject || !firestore) return;
    const docRef = doc(firestore, 'users', editingProject.ownerId, 'projects', editingProject.id);
    updateDoc(docRef, { name: editingProject.name, description: editingProject.description, visibility: editingProject.visibility });
    setIsEditProjectOpen(false);
    toast({ title: "Space Updated" });
  }, [editingProject, firestore, toast]);

  const handleDeleteProject = useCallback(() => {
    if (!editingProject || !firestore) return;
    const docRef = doc(firestore, 'users', editingProject.ownerId, 'projects', editingProject.id);
    deleteDoc(docRef).then(() => {
      if (activeProject?.id === editingProject.id) { setActiveProject(null); setActiveList(null); setActiveTab(null); }
      setIsEditProjectOpen(false);
      toast({ title: "Space Deleted", variant: "destructive" });
    });
  }, [editingProject, firestore, toast, activeProject]);

  const handleCreateList = useCallback(() => {
    if (!newList.name || !newList.projectId || !firestore || !user) return;
    const targetProject = allProjects.find(p => p.id === newList.projectId);
    if (!targetProject) return;
    const listDocRef = doc(collection(firestore, 'users', targetProject.ownerId, 'projects', targetProject.id, 'lists'));
    const now = new Date().toISOString();
    const lData = { id: listDocRef.id, projectId: targetProject.id, name: newList.name, description: newList.description, createdAt: now, updatedAt: now, creatorId: user.uid };
    setDoc(listDocRef, lData);
    setNewList({ name: '', description: '', projectId: '' });
    setIsAddListOpen(false);
    toast({ title: "List Created" });
  }, [newList, allProjects, firestore, user, toast]);

  const handleUpdateList = useCallback(() => {
    if (!editingList || !editingListProjectContext || !firestore) return;
    const docRef = doc(firestore, 'users', editingListProjectContext.ownerId, 'projects', editingListProjectContext.id, 'lists', editingList.id);
    updateDoc(docRef, { name: editingList.name, description: editingList.description, updatedAt: new Date().toISOString() });
    setIsEditListOpen(false);
    setEditingList(null);
    setEditingListProjectContext(null);
    toast({ title: "List Updated" });
  }, [editingList, editingListProjectContext, firestore, toast]);

  const handleDeleteList = useCallback((listToDelete: ListType, project: Project) => {
    if (!firestore || !project) return;
    const docRef = doc(firestore, 'users', project.ownerId, 'projects', project.id, 'lists', listToDelete.id);
    deleteDoc(docRef).then(() => {
      if (activeList?.id === listToDelete.id) { setActiveList(null); setActiveTab(project.id); }
      toast({ title: "List Deleted", variant: "destructive" });
    });
  }, [firestore, toast, activeList]);

  const handleAddTask = useCallback((task: Partial<Task> & { listId: string; title: string }) => {
    if (!activeProject || !activeList || !user || !firestore) return;
    const taskDocRef = doc(collection(firestore, 'users', activeProject.ownerId, 'tasks'));
    const now = new Date().toISOString();
    const taskData = { ...task, id: taskDocRef.id, projectId: activeProject.id, listId: activeList.id, status: task.status || 'todo', createdAt: now, updatedAt: now, projectOwnerId: activeProject.ownerId, creatorId: user.uid, visibility: activeProject.visibility, subtasks: task.subtasks || [], comments: task.comments || [], timeEntries: task.timeEntries || [] };
    setDoc(taskDocRef, taskData);
    toast({ title: "Task Added" });
  }, [activeProject, activeList, user, firestore, toast]);

  const handleUpdateTask = useCallback((taskId: string, updates: Partial<Task>) => {
    if (!activeProject || !firestore) return;
    const docRef = doc(firestore, 'users', activeProject.ownerId, 'tasks', taskId);
    updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
  }, [activeProject, firestore]);

  const handleDeleteTask = useCallback((taskId: string) => {
    if (!activeProject || !firestore) return;
    const docRef = doc(firestore, 'users', activeProject.ownerId, 'tasks', taskId);
    deleteDoc(docRef);
    toast({ title: "Task Deleted" });
  }, [activeProject, firestore, toast]);

  const handleUpdateGlobalTask = useCallback((taskId: string, updates: Partial<Task>) => {
    if (!firestore || !dashboardTasks) return;
    const task = dashboardTasks.find(t => t.id === taskId);
    if (!task) return;
    const docRef = doc(firestore, 'users', task.projectOwnerId, 'tasks', taskId);
    updateDoc(docRef, { ...updates, updatedAt: new Date().toISOString() });
  }, [firestore, dashboardTasks]);

  const handleDeleteGlobalTask = useCallback((taskId: string) => {
    if (!firestore || !dashboardTasks) return;
    const task = dashboardTasks.find(t => t.id === taskId);
    if (!task) return;
    const docRef = doc(firestore, 'users', task.projectOwnerId, 'tasks', taskId);
    deleteDoc(docRef);
    toast({ title: "Task Deleted" });
  }, [firestore, dashboardTasks, toast]);

  const showOverallDashboard = isOverallDashboard || (!activeProject && !activeList);

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex w-full h-[calc(100vh-4rem)] relative">
        <Sidebar className="border-r bg-card/50 !top-16 !h-full">
          <SidebarContent className="p-4">
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Your Spaces</h2>
              <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-primary hover:bg-primary/10">
                    <Plus size={14} />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Space</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Space Name</label>
                      <input className="w-full h-10 px-3 rounded-md border" placeholder="e.g. Marketing Team" value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddProjectOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateProject} disabled={!newProject.name}>Create Space</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Accordion type="multiple" value={activeProject?.id ? [activeProject.id] : []} className="w-full space-y-1">
              {allProjects.map((project) => (
                <SpaceSection 
                  key={project.id}
                  project={project}
                  activeTab={activeTab}
                  activeListId={activeList?.id}
                  onSelectSpace={() => { setActiveProject(project); setActiveList(null); setActiveTab(project.id); }}
                  onSelectList={(list: ListType) => { setActiveProject(project); setActiveList(list); setActiveTab(list.id); }}
                  onAddList={() => { setNewList({ ...newList, projectId: project.id }); setIsAddListOpen(true); }}
                  onEditSpace={() => { setEditingProject(project); setIsEditProjectOpen(true); }}
                  onEditList={(list: ListType) => { setEditingList(list); setEditingListProjectContext(project); setIsEditListOpen(true); }}
                  onDeleteList={(list: ListType) => handleDeleteList(list, project)}
                />
              ))}
            </Accordion>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 bg-background overflow-y-auto min-w-0">
          <div className="max-w-7xl mx-auto p-4 sm:p-8">
            <div className="md:hidden flex items-center mb-6">
              <SidebarTrigger className="h-9 w-9 border shadow-sm bg-card hover:bg-muted" />
              <span className="ml-3 text-sm font-bold text-muted-foreground uppercase tracking-widest">Navigation</span>
            </div>

            {!mounted || isMyProjectsLoading || isDashboardLoading ? (
              <div className="h-[60vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin h-8 w-8 text-primary" />
                  <p className="text-muted-foreground text-sm animate-pulse">Loading data...</p>
                </div>
              </div>
            ) : showOverallDashboard ? (
              <div className="space-y-8 animate-pop-in">
                <header>
                  <h1 className="text-3xl sm:text-4xl font-black text-primary mb-2">Workspace Overview</h1>
                  <p className="text-muted-foreground text-base sm:text-lg">Real-time mission control across all your spaces.</p>
                </header>
                <Overview 
                  projects={allProjects} 
                  tasks={dashboardTasks || []}
                  onUpdateTask={handleUpdateGlobalTask}
                  onDeleteTask={handleDeleteGlobalTask}
                  workspaceOwnerId={user?.uid || ''}
                  availableStatuses={DEFAULT_COLUMNS}
                />
              </div>
            ) : activeProject && !activeList ? (
              <div className="space-y-8 animate-pop-in">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-black text-primary mb-2">{activeProject.name}</h1>
                    <p className="text-muted-foreground text-base sm:text-lg">{activeProject.description || "Space metrics and workstreams."}</p>
                  </div>
                  <Badge variant="outline" className="h-8 px-4 text-[10px] font-bold uppercase tracking-widest border-primary/20 text-primary bg-primary/5">
                    Space Dashboard
                  </Badge>
                </header>
                <Overview 
                  projects={[activeProject]} 
                  tasks={activeTasks || []}
                  lists={activeProjectLists || []}
                  onUpdateTask={handleUpdateTask}
                  onDeleteTask={handleDeleteTask}
                  workspaceOwnerId={activeProject.ownerId}
                  availableStatuses={DEFAULT_COLUMNS}
                />
              </div>
            ) : (
              <Board 
                project={activeProject!}
                list={activeList!}
                tasks={(activeTasks || []).filter(t => t.listId === activeList?.id)}
                onAddTask={handleAddTask}
                onUpdateTask={handleUpdateTask}
                onUpdateStatus={(taskId, status) => handleUpdateTask(taskId, { status })}
                onDeleteTask={handleDeleteTask}
              />
            )}
          </div>
        </main>
      </div>
      
      <Dialog open={isEditProjectOpen} onOpenChange={setIsEditProjectOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Space</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Space Name</label>
              <Input value={editingProject?.name || ''} onChange={(e) => setEditingProject(prev => prev ? { ...prev, name: e.target.value } : null)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={editingProject?.description || ''} onChange={(e) => setEditingProject(prev => prev ? { ...prev, description: e.target.value } : null)} />
            </div>
          </div>
          <DialogFooter className="flex-row justify-between">
            <Button variant="destructive" onClick={handleDeleteProject}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditProjectOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateProject}>Save Changes</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditListOpen} onOpenChange={setIsEditListOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit List</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">List Name</label>
              <Input value={editingList?.name || ''} onChange={(e) => setEditingList(prev => prev ? { ...prev, name: e.target.value } : null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditListOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateList}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}

function SpaceSection({ project, activeTab, activeListId, onSelectSpace, onSelectList, onAddList, onEditSpace, onEditList, onDeleteList }: any) {
  const firestore = useFirestore();
  const listsRef = useMemoFirebase(() => {
    if (!project?.ownerId || !project?.id || !firestore) return null;
    return collection(firestore, 'users', project.ownerId, 'projects', project.id, 'lists');
  }, [firestore, project]);
  const { data: lists, isLoading } = useCollection<ListType>(listsRef);

  return (
    <AccordionItem value={project.id} className="border-none">
      <div className={cn("flex items-center group/proj pr-2 rounded-md transition-colors", activeTab === project.id ? "bg-primary/5" : "hover:bg-muted/50")}>
        <AccordionTrigger onClick={() => onSelectSpace()} className="hover:no-underline py-2 px-2 flex-1 text-sm font-bold uppercase tracking-tight text-foreground/80">
          <div className="flex items-center gap-2">
            <div className={cn("w-5 h-5 rounded flex items-center justify-center text-[10px]", activeTab === project.id ? "bg-primary text-white" : "bg-primary/10 text-primary")}>
              {project.name.charAt(0)}
            </div>
            <span className={cn(activeTab === project.id && "text-primary")}>{project.name}</span>
          </div>
        </AccordionTrigger>
        <div className="flex gap-1 md:opacity-0 group-hover/proj:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onAddList(); }}><Plus size={14} /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onEditSpace(); }}><Settings2 size={14} /></Button>
        </div>
      </div>
      <AccordionContent className="pb-2">
        <div className="pl-4 space-y-1 mt-1">
          {isLoading ? (
            <div className="py-2 pl-4"><Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /></div>
          ) : lists?.map((list) => (
            <div key={list.id} className="flex items-center group/list">
              <Button 
                variant="ghost" 
                onClick={() => onSelectList(list)}
                className={cn("text-xs py-1.5 h-auto font-medium transition-all flex-1 justify-start", activeListId === list.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                <ListIcon className="h-3 w-3 mr-2 opacity-60" />
                <span className="truncate">{list.name}</span>
              </Button>
              <div className="flex gap-1 md:opacity-0 group-hover/list:opacity-100 transition-opacity pr-2">
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={(e) => { e.stopPropagation(); onEditList(list); }}><Settings2 size={12} /></Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteList(list); }}><Trash2 size={12} /></Button>
              </div>
            </div>
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
      <HomeContent />
    </Suspense>
  );
}
