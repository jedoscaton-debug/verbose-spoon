
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { collection, query, where, orderBy, doc, limit, writeBatch } from 'firebase/firestore';
import { UserProfile, Chat, Message } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Send, MessageSquare, MessageCircle, Search, Loader2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function MessagesPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);

  // Handle responsiveness
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 1. Get all users to start new chats
  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), limit(50));
  }, [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  // 2. Get my chats
  const chatsQuery = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return null;
    return query(
      collection(firestore, 'chats'),
      where('participants', 'array-contains', user.uid)
    );
  }, [user?.uid, firestore]);
  const { data: rawChats, isLoading: isChatsLoading } = useCollection<Chat>(chatsQuery);

  // Sort chats locally
  const myChats = useMemo(() => {
    if (!rawChats) return null;
    return [...rawChats].sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [rawChats]);

  // 3. Get messages for selected chat
  const messagesQuery = useMemoFirebase(() => {
    if (!selectedChat || !firestore) return null;
    return query(
      collection(firestore, 'chats', selectedChat.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
  }, [selectedChat, firestore]);
  const { data: messages } = useCollection<Message>(messagesQuery);

  // 4. Mark messages as read when viewing
  useEffect(() => {
    if (!selectedChat || !messages || !user || !firestore) return;

    const unreadMessages = messages.filter(m => m.senderId !== user.uid && !m.read);
    if (unreadMessages.length === 0) return;

    const batch = writeBatch(firestore);
    unreadMessages.forEach(m => {
      const mRef = doc(firestore, 'chats', selectedChat.id, 'messages', m.id);
      batch.update(mRef, { read: true });
    });
    batch.commit();
  }, [selectedChat, messages, user, firestore]);

  const filteredUsers = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.filter(u => 
      u.id !== user?.uid && 
      (u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
       u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [allUsers, searchTerm, user]);

  const handleStartChat = async (targetUser: UserProfile) => {
    if (!user || !firestore) return;
    
    const existing = myChats?.find(c => c.participants.includes(targetUser.id));
    if (existing) {
      setSelectedChat(existing);
      setSearchTerm('');
      return;
    }

    const chatRef = doc(collection(firestore, 'chats'));
    const chatData: Chat = {
      id: chatRef.id,
      participants: [user.uid, targetUser.id],
      updatedAt: new Date().toISOString()
    };
    
    setDocumentNonBlocking(chatRef, chatData, {});
    setSelectedChat(chatData);
    setSearchTerm('');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !user || !firestore) return;

    const messageRef = collection(firestore, 'chats', selectedChat.id, 'messages');
    const msgData = {
      senderId: user.uid,
      senderName: user.displayName || user.email?.split('@')[0] || 'User',
      text: newMessage,
      createdAt: new Date().toISOString(),
      read: false,
      participants: selectedChat.participants // CRITICAL: Storing participants here for collection group queries
    };

    setNewMessage('');
    addDocumentNonBlocking(messageRef, msgData);
    
    const chatDocRef = doc(firestore, 'chats', selectedChat.id);
    setDocumentNonBlocking(chatDocRef, {
      lastMessage: newMessage,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  };

  const getTargetUser = (chat: Chat) => {
    const targetId = chat.participants.find(p => p !== user?.uid);
    return allUsers?.find(u => u.id === targetId);
  };

  const showChatList = !isMobileView || !selectedChat;
  const showActiveChat = !isMobileView || !!selectedChat;

  return (
    <div className="container max-w-6xl mx-auto py-4 sm:py-6 px-4 h-[calc(100vh-5rem)] sm:h-[calc(100vh-6rem)]">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6 h-full">
        {showChatList && (
          <Card className={cn(
            "flex flex-col overflow-hidden h-full shadow-lg",
            isMobileView ? "col-span-1" : "md:col-span-1"
          )}>
            <CardHeader className="p-4 border-b">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Messages
              </CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search users..." 
                  className="pl-8 h-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {searchTerm ? (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground p-2">People</p>
                    {filteredUsers.map(u => (
                      <button
                        key={u.id}
                        onClick={() => handleStartChat(u)}
                        className="w-full text-left p-2 rounded-lg hover:bg-muted flex items-center gap-3 transition-colors"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{u.firstName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{u.firstName} {u.lastName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground p-2">Recent Chats</p>
                    {isChatsLoading ? (
                      <div className="flex justify-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                    ) : myChats?.map(chat => {
                      const target = getTargetUser(chat);
                      return (
                        <button
                          key={chat.id}
                          onClick={() => setSelectedChat(chat)}
                          className={cn(
                            "w-full text-left p-3 rounded-xl flex items-center gap-3 transition-all relative",
                            selectedChat?.id === chat.id ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted"
                          )}
                        >
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback>{target?.firstName?.charAt(0) || '?'}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-bold truncate">{target?.firstName || 'User'} {target?.lastName || ''}</p>
                              {chat.updatedAt && (
                                <span className="text-[8px] text-muted-foreground uppercase font-bold">
                                  {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: false })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{chat.lastMessage || 'Start a conversation...'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            </ScrollArea>
          </Card>
        )}

        {showActiveChat && (
          <Card className={cn(
            "flex flex-col overflow-hidden h-full shadow-lg border-none md:border",
            isMobileView ? "col-span-1" : "md:col-span-3"
          )}>
            {selectedChat ? (
              <>
                <CardHeader className="p-3 sm:p-4 border-b bg-card flex flex-row items-center gap-3">
                  {isMobileView && (
                    <Button variant="ghost" size="icon" onClick={() => setSelectedChat(null)} className="mr-1">
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                  )}
                  <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                    <AvatarFallback>{getTargetUser(selectedChat)?.firstName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm sm:text-base font-bold truncate">
                      {getTargetUser(selectedChat)?.firstName} {getTargetUser(selectedChat)?.lastName}
                    </CardTitle>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-widest">Active Chat</p>
                  </div>
                </CardHeader>
                <ScrollArea className="flex-1 p-4 sm:p-6 bg-muted/5">
                  <div className="space-y-4">
                    {messages?.map((msg, idx) => {
                      const isMe = msg.senderId === user?.uid;
                      return (
                        <div key={msg.id || idx} className={cn("flex", isMe ? "justify-end" : "justify-start")}>
                          <div className={cn(
                            "max-w-[85%] sm:max-w-[70%] p-3 rounded-2xl shadow-sm space-y-1",
                            isMe ? "bg-primary text-white rounded-tr-none" : "bg-card border rounded-tl-none"
                          )}>
                            {!isMe && <p className="text-[9px] font-black uppercase tracking-tighter opacity-70">{msg.senderName}</p>}
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                            <p className={cn("text-[8px] font-bold text-right opacity-60 uppercase")}>
                              {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t bg-card flex gap-2">
                  <Input 
                    placeholder="Type a message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 h-10 text-sm"
                  />
                  <Button type="submit" disabled={!newMessage.trim()} className="shrink-0 bg-primary hover:bg-primary/90 h-10 w-10 p-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                <div className="bg-primary/5 p-6 rounded-full">
                  <MessageCircle className="h-12 w-12 sm:h-16 sm:w-16 text-primary opacity-20" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-primary">Your Inbox</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto">Select a teammate from the left to start a real-time conversation.</p>
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
