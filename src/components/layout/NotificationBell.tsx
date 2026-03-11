
'use client';

import { useState, useMemo } from 'react';
import { Bell, BellDot, Check, Trash2, Info, Mail, ClipboardList, AlertCircle, Loader2 } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { Notification } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuHeader,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isOpen, setIsOpen] = useState(false);

  const notificationsRef = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return query(
      collection(firestore, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
  }, [user?.uid, firestore]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsRef);

  const unreadCount = useMemo(() => {
    return notifications?.filter(n => !n.read).length || 0;
  }, [notifications]);

  const handleMarkAsRead = async (notifId: string) => {
    if (!user?.uid || !firestore) return;
    const docRef = doc(firestore, 'users', user.uid, 'notifications', notifId);
    updateDoc(docRef, { read: true });
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.uid || !firestore || !notifications) return;
    const batch = writeBatch(firestore);
    notifications.filter(n => !n.read).forEach(n => {
      const docRef = doc(firestore, 'users', user.uid, 'notifications', n.id);
      batch.update(docRef, { read: true });
    });
    await batch.commit();
  };

  const handleDelete = async (notifId: string) => {
    if (!user?.uid || !firestore) return;
    const docRef = doc(firestore, 'users', user.uid, 'notifications', notifId);
    deleteDoc(docRef);
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'invite': return <Mail className="h-4 w-4 text-accent" />;
      case 'task': return <ClipboardList className="h-4 w-4 text-primary" />;
      case 'alert': return <AlertCircle className="h-4 w-4 text-destructive" />;
      default: return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          {unreadCount > 0 ? (
            <>
              <BellDot className="h-5 w-5 text-accent animate-pulse" />
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[8px] font-bold"
              >
                {unreadCount}
              </Badge>
            </>
          ) : (
            <Bell className="h-5 w-5 text-muted-foreground" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 border shadow-2xl">
        <div className="p-4 flex items-center justify-between bg-card border-b">
          <DropdownMenuLabel className="p-0 font-bold">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[350px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Checking for updates...</p>
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div 
                  key={n.id} 
                  className={cn(
                    "relative group p-4 border-b last:border-0 hover:bg-muted/30 transition-colors flex gap-3",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <div className="mt-1 shrink-0">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-xs font-bold leading-none", !n.read && "text-primary")}>
                        {n.title}
                      </p>
                      <span className="text-[8px] text-muted-foreground font-bold uppercase shrink-0">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-[8px] font-black uppercase tracking-tighter text-primary bg-primary/10 hover:bg-primary/20"
                          onClick={() => handleMarkAsRead(n.id)}
                        >
                          <Check className="h-3 w-3 mr-1" /> Mark Read
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 px-2 text-[8px] font-black uppercase tracking-tighter text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(n.id)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                      </Button>
                    </div>
                  </div>
                  {!n.read && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-accent" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3 px-8 text-center">
              <div className="bg-muted p-3 rounded-full">
                <Bell className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-sm font-bold">All caught up!</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  No new updates at the moment. We'll alert you when something happens.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Button variant="ghost" className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            See all activity
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
