'use client';

import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, LogOut, Mail } from 'lucide-react';
import Link from 'next/link';

export default function UnauthorizedPage() {
  const { user } = useUser();
  const auth = useAuth();

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-destructive">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <div className="bg-destructive/10 p-4 rounded-full">
              <ShieldAlert className="text-destructive h-10 w-10" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Access Restricted</CardTitle>
          <CardDescription>
            You are signed in but do not have an active invitation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="bg-muted p-4 rounded-lg flex items-center justify-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium text-sm">{user?.email}</span>
          </div>
          
          <p className="text-sm text-muted-foreground leading-relaxed">
            Access to FlowBoard is strictly by invitation only. If you believe this is an error, please ensure you used the email address that received the invite.
          </p>

          <div className="flex flex-col gap-2">
            <Button asChild variant="outline">
              <Link href="/login">Try Another Account</Link>
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => signOut(auth)}>
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
