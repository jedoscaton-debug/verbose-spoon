
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

/**
 * AuthGuard ensures that:
 * 1. Unauthenticated users are sent to /login (unless on a public path).
 * 2. Authenticated users without a profile are sent to /setup-profile to complete setup.
 * 3. Authenticated users with a profile can access the dashboard.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const lastRedirect = useRef<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userDocRef = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return doc(firestore, 'users', user.uid);
  }, [user, firestore]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  // Define paths that are part of the onboarding/auth flow
  const isSetupPath = pathname?.startsWith('/setup-profile') || pathname?.startsWith('/accept-invite');
  const isLoginPath = pathname?.startsWith('/login');

  useEffect(() => {
    if (!mounted || isUserLoading || isProfileLoading) return;

    let targetPath: string | null = null;

    if (!user) {
      // Not logged in: send to login
      if (!isLoginPath) {
        targetPath = '/login';
      }
    } else {
      // Logged in
      if (!profile) {
        // No Firestore profile found: send to setup
        if (!isSetupPath) {
          targetPath = '/setup-profile';
        }
      } else {
        // Profile exists: send to dashboard if on auth/setup pages
        if (isLoginPath || isSetupPath) {
          targetPath = '/';
        }
      }
    }

    if (targetPath && targetPath !== pathname && targetPath !== lastRedirect.current) {
      lastRedirect.current = targetPath;
      router.replace(targetPath);
    }
  }, [user, profile, isUserLoading, isProfileLoading, isLoginPath, isSetupPath, router, pathname, mounted]);

  // Prevent flicker: show loader while checking profile for authenticated users
  // We only hide the loader when we are sure about both auth and profile status
  const isLoadingProfile = user && isProfileLoading;
  const shouldShowLoader = !mounted || isUserLoading || (isLoadingProfile && !isLoginPath);

  if (shouldShowLoader) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-primary/10 p-4 rounded-3xl animate-pulse">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground animate-pulse font-bold tracking-tight">Syncing Workspace...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
