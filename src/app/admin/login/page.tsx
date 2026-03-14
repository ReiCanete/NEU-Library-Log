
"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Loader2 } from 'lucide-react';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { auth } = useAuth();
  const { firestore } = useFirestore();
  const { user, loading: authLoading } = useUser();
  const { toast } = useToast();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const errorMessage = searchParams.get('error');

  useEffect(() => {
    if (errorMessage) {
      toast({
        title: "Access Denied",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [errorMessage, toast]);

  useEffect(() => {
    if (user && !isLoggingIn) {
      checkAdmin(user);
    }
  }, [user]);

  const checkAdmin = async (currentUser: any) => {
    if (!firestore || !auth) return;
    
    try {
      const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
      if (userDoc.exists() && userDoc.data().role === 'admin') {
        router.push('/admin');
      } else {
        toast({
          title: "Unauthorized",
          description: "You do not have admin access. Please use an authorized account.",
          variant: "destructive",
        });
        await signOut(auth);
      }
    } catch (error) {
      console.error("Login check error:", error);
    }
  };

  const handleLogin = async () => {
    if (!auth) return;
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'neu.edu.ph' });
    
    try {
      const result = await signInWithPopup(auth, provider);
      if (!result.user.email?.endsWith('@neu.edu.ph')) {
        toast({
          title: "Wrong Domain",
          description: "Please use your @neu.edu.ph email account.",
          variant: "destructive",
        });
        await signOut(auth);
        return;
      }
      await checkAdmin(result.user);
    } catch (error: any) {
      console.error("Popup Error:", error);
      toast({
        title: "Login Failed",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <Card className="max-w-md w-full shadow-2xl border-none animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center space-y-4 pt-10">
          <div className="mx-auto bg-primary/10 h-20 w-20 rounded-full flex items-center justify-center">
            <ShieldAlert className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-bold text-primary">Admin Access</CardTitle>
            <CardDescription className="text-lg">Please sign in to access the dashboard</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-12 space-y-6">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-muted-foreground">
            Access is restricted to authorized <strong>@neu.edu.ph</strong> administrator accounts only.
          </div>
          
          <Button 
            className="w-full h-14 text-lg font-semibold flex items-center justify-center gap-3"
            onClick={handleLogin}
            disabled={isLoggingIn || authLoading}
          >
            {isLoggingIn ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            {isLoggingIn ? "Signing in..." : "Continue with Google"}
          </Button>

          <div className="text-center">
            <Button variant="link" className="text-slate-400" onClick={() => router.push('/')}>
              Return to Kiosk Mode
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
