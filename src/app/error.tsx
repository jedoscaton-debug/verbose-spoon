
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, RotateCcw, ShieldAlert } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service if needed
    // In this app, we avoid console.error to follow instructions, 
    // but the error is surfaced via the UI.
  }, [error]);

  const isPermissionError = error.message.includes('Missing or insufficient permissions');

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background/50 backdrop-blur-sm">
      <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-destructive animate-pop-in">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-destructive/10 p-3 rounded-full">
              {isPermissionError ? (
                <ShieldAlert className="h-10 w-10 text-destructive" />
              ) : (
                <AlertCircle className="h-10 w-10 text-destructive" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {isPermissionError ? 'Access Denied' : 'Something went wrong'}
          </CardTitle>
          <CardDescription>
            {isPermissionError 
              ? "You don't have the necessary permissions to perform this action." 
              : "An unexpected error occurred while processing your request."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg text-xs font-mono overflow-auto max-h-[200px] leading-relaxed">
            {error.message}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button onClick={() => reset()} className="w-full bg-primary hover:bg-primary/90">
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()} className="w-full text-muted-foreground">
            Reload Page
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
