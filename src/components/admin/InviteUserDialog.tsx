
'use client';

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, orderBy, limit, serverTimestamp, doc, deleteDoc, setDoc, where, getDocs, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Loader2, Clock, Trash2, Plus, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Notification } from '@/lib/types';

export function InviteUserDialog() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const invitesQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, 'invitations'),
      where('inviterId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
  }, [firestore, user]);

  const { data: invites, isLoading: isInvitesLoading } = useCollection(invitesQuery);

  const handleCreateInvite = async () => {
    if (!email || !user || !firestore) return;

    setIsInviting(true);
    const normalizedEmail = email.toLowerCase().trim();
    const inviteId = `${user.uid}_workspace_${normalizedEmail}`;
    const inviteRef = doc(firestore, 'invitations', inviteId);

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 day expiry

    const inviteData = {
      id: inviteId,
      email: normalizedEmail,
      inviterId: user.uid,
      inviterEmail: user.email,
      status: 'Pending',
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      token: Math.random().toString(36).substring(2, 15)
    };

    setDoc(inviteRef, inviteData)
      .then(async () => {
        const usersRef = collection(firestore, 'users');
        const q = query(usersRef, where('email', '==', normalizedEmail));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          const invitee = querySnapshot.docs[0];
          const notifRef = doc(collection(firestore, 'users', invitee.id, 'notifications'));
          const notification: Notification = {
            id: notifRef.id,
            title: "Workspace Invitation",
            message: `You have been invited to a new workspace by ${user.email}`,
            type: 'invite',
            read: false,
            createdAt: new Date().toISOString(),
            relatedId: user.uid
          };
          setDoc(notifRef, notification);
        }

        toast({
          title: "Invitation Sent",
          description: `${normalizedEmail} now has access to your workspace.`,
        });
        setEmail('');
      })
      .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'invitations',
          operation: 'create',
          requestResourceData: inviteData
        }));
      })
      .finally(() => {
        setIsInviting(false);
      });
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!firestore) return;
    
    const inviteRef = doc(firestore, 'invitations', inviteId);
    deleteDoc(inviteRef)
      .then(() => {
        toast({
          title: "Invitation Revoked",
          description: "The user no longer has access via this invitation.",
        });
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: inviteRef.path,
          operation: 'delete'
        }));
      });
  };

  const formatDate = (dateValue: any) => {
    if (!dateValue) return 'N/A';
    try {
      if (dateValue.toDate) {
        return format(dateValue.toDate(), 'MMM d, p');
      }
      return format(new Date(dateValue), 'MMM d, p');
    } catch (e) {
      return 'Invalid Date';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2 border-accent/20 hover:bg-accent/10 hover:text-accent font-semibold">
          <UserPlus size={16} />
          Invite Team Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to Workspace</DialogTitle>
          <DialogDescription>
            Enter a teammate&apos;s email. They will automatically see your spaces when they log in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Teammate Email</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button 
                onClick={handleCreateInvite}
                disabled={isInviting || !email}
                className="bg-accent text-accent-foreground"
              >
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus size={16} />}
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Clock size={14} /> Recent Invitations
            </h4>
            <ScrollArea className="h-[200px] pr-4">
              <div className="space-y-3">
                {isInvitesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : invites && invites.length > 0 ? (
                  invites.map((invite: any) => (
                    <div key={invite.id} className="text-[10px] space-y-1 group relative bg-muted/30 p-2 rounded-lg">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold truncate" title={invite.email}>
                          {invite.email}
                        </span>
                        <div className="flex items-center gap-1">
                          {invite.projectId ? (
                            <Badge variant="outline" className="h-4 px-1 text-[7px] bg-primary/5 text-primary border-primary/20">Space</Badge>
                          ) : (
                            <Badge variant="outline" className="h-4 px-1 text-[7px] bg-accent/5 text-accent border-accent/20">Workspace</Badge>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleDeleteInvite(invite.id)}
                          >
                            <Trash2 size={10} />
                          </Button>
                        </div>
                      </div>
                      <div className="text-[8px] text-muted-foreground">
                        Sent {formatDate(invite.createdAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-muted-foreground italic text-center py-4">No invitations yet.</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" className="w-full" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
