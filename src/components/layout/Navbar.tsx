
'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { FolderKanban, LayoutDashboard, Settings, LogOut, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, useUser, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { signOut } from 'firebase/auth';
import { collectionGroup, query, where, limit } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from './NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { Message } from '@/lib/types';
import { cn } from '@/lib/utils';

export function Navbar() {
  const auth = useAuth();
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  // Real-time query for unread messages across all chats
  const unreadMessagesQuery = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return query(
      collectionGroup(firestore, 'messages'),
      where('participants', 'array-contains', user.uid),
      limit(50)
    );
  }, [user?.uid, firestore]);

  const { data: recentMessages } = useCollection<Message>(unreadMessagesQuery);

  // Filter for truly unread messages from others locally
  const totalUnreadMessages = recentMessages?.filter(m => !m.read && m.senderId !== user?.uid).length || 0;

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <nav className="border-b bg-card sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <div className="bg-primary p-2 rounded-lg">
              <FolderKanban className="text-primary-foreground h-6 w-6" />
            </div>
            <Link href="/" className="font-headline text-xl font-bold text-primary tracking-tight">
              FlowBoard
            </Link>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            {user && (
              <>
                <Link href="/?view=overall">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn(
                      "flex items-center gap-2 px-3",
                      pathname === '/' && pathname.includes('view=overall') ? "bg-primary/10 text-primary" : ""
                    )}
                  >
                    <LayoutDashboard size={18} />
                    <span className="hidden md:inline">Dashboard</span>
                  </Button>
                </Link>

                <Link href="/messages">
                  <Button variant="ghost" size="sm" className={cn(
                    "flex items-center gap-2 relative px-3",
                    pathname === '/messages' ? "bg-primary/10 text-primary" : ""
                  )}>
                    <MessageSquare size={18} />
                    <span className="hidden md:inline">Messages</span>
                    {totalUnreadMessages > 0 && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[8px] font-bold animate-pulse">
                        {totalUnreadMessages}
                      </Badge>
                    )}
                  </Button>
                </Link>

                <div className="mx-1 h-6 w-px bg-border hidden sm:block" />

                <ThemeToggle />
                <NotificationBell />
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full ml-1">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary uppercase">
                          {user.email?.charAt(0) || <User size={16} />}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="cursor-pointer flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive cursor-pointer"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
