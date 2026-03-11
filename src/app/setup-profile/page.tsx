
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, errorEmitter, FirestorePermissionError, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, UserCircle, Rocket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

function SetupProfileContent() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Immediate redirect if profile already exists to prevent manual access
  useEffect(() => {
    if (profile && mounted) {
      router.replace('/');
    }
  }, [profile, mounted, router]);

  const handleSetup = async () => {
    if (!user || !firestore || !firstName || !lastName) return;

    setIsProcessing(true);
    
    try {
      // Check for invitation context to link to existing teams
      let inviterId = user.uid;
      try {
        const invQuery = query(
          collection(firestore, 'invitations'), 
          where('email', '==', user.email?.toLowerCase().trim()),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        const invSnap = await getDocs(invQuery);
        if (!invSnap.empty) {
          inviterId = invSnap.docs[0].data().inviterId;
        }
      } catch (e) {
        // Silently fail inv check
      }

      const now = new Date().toISOString();
      const userRef = doc(firestore, 'users', user.uid);
      const userData = {
        id: user.uid,
        email: user.email,
        firstName,
        lastName,
        role: (inviterId === user.uid) ? 'Admin' : 'Member',
        createdAt: now,
        updatedAt: now,
        invitedById: inviterId
      };
      
      await setDoc(userRef, userData);
      
      toast({
        title: "Welcome aboard!",
        description: `Your profile has been set up successfully.`,
      });
      router.replace('/');
    } catch (err: any) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: `users/${user.uid}`,
        operation: 'create',
      }));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted || isUserLoading || isProfileLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground italic">Preparing setup...</p>
      </div>
    );
  }

  // Prevent UI flash for registered users
  if (profile) return null;

  if (!user) {
    return (
      <Card className="w-full max-w-md mx-auto mt-20 shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Session Required</CardTitle>
          <CardDescription>
            Please sign in to access this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button onClick={() => router.push('/login')} className="w-full">
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-accent animate-pop-in">
        <CardHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-accent/10 p-2 rounded-lg">
              <UserCircle className="text-accent h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Profile Setup</CardTitle>
              <CardDescription>
                Help your team identify you in the workspace.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">First Name</label>
              <Input 
                placeholder="Jane" 
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Name</label>
              <Input 
                placeholder="Doe" 
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email</label>
            <Input value={user.email || ''} disabled className="bg-muted/50" />
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={handleSetup} 
            disabled={isProcessing || !firstName || !lastName}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 h-12 font-bold"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Rocket className="h-5 w-5 mr-2" />
            )}
            Start Flowing
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function SetupProfilePage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SetupProfileContent />
    </Suspense>
  );
}
