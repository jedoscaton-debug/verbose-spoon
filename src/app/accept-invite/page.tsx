
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * Legacy path redirector to the new unified profile setup page.
 */
export default function LegacySetupRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/setup-profile');
  }, [router]);

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-muted-foreground animate-pulse">Redirecting to setup...</p>
    </div>
  );
}
