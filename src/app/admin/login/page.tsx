"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Library, ShieldCheck } from 'lucide-react';
import { auth, db as firestore } from '@/firebase/config';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

function LoginContent() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const handleResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const loggedInUser = result.user;
          
          if (!loggedInUser.email?.endsWith('@neu.edu.ph')) {
            toast({
              title: "Unauthorized",
              description: "Only @neu.edu.ph accounts are allowed.",
              variant: "destructive",
            });
            await signOut(auth);
            setIsChecking(false);
            return;
          }
          
          const userDoc = await getDoc(doc(firestore, 'users', loggedInUser.uid));
          const userData = userDoc.data();
          const hasAdminAccess = userData?.role === 'admin' || userData?.studentId === '25-14294-549';

          if (userDoc.exists() && hasAdminAccess) {
            router.replace('/admin');
            return;
          } else {
            toast({
              title: "Access Denied",
              description: "You do not have administrator permissions.",
              variant: "destructive",
            });
            await signOut(auth);
          }
        }
      } catch (error: any) {
        toast({
          title: "Login Error",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setIsChecking(false);
      }
    };
    handleResult();
  }, [router, toast]);

  // Automatically redirect if user is already authenticated as admin
  useEffect(() => {
    if (user && !isChecking) {
      const checkRole = async () => {
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        const userData = userDoc.data();
        const hasAdminAccess = userData?.role === 'admin' || userData?.studentId === '25-14294-549';
        
        if (userDoc.exists() && hasAdminAccess) {
          router.replace('/admin');
        }
      };
      checkRole();
    }
  }, [user, isChecking, router]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'neu.edu.ph', prompt: 'select_account' });
    await signInWithRedirect(auth, provider);
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-float" />
      
      <Card className="max-w-md w-full glass-dark border-none shadow-2xl z-10 animate-in fade-in zoom-in duration-700">
        <CardHeader className="text-center space-y-6 pt-12">
          <div className="mx-auto bg-blue-500/10 h-24 w-24 rounded-3xl flex items-center justify-center border border-white/10 shadow-2xl">
            <ShieldCheck className="h-12 w-12 text-blue-400" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-4xl font-black text-white">Staff Login</CardTitle>
            <CardDescription className="text-blue-200/60 text-lg">Administrator access portal</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-16 space-y-8 px-10">
          <div className="bg-blue-500/5 border border-white/10 rounded-2xl p-6 text-sm text-blue-100 text-center leading-relaxed">
            Authentication is restricted to verified <strong>@neu.edu.ph</strong> accounts with administrator privileges.
          </div>
          
          <Button 
            className="w-full h-16 text-xl font-bold rounded-2xl bg-white text-[#0a1628] hover:bg-white/90 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            onClick={handleLogin}
            disabled={isChecking || authLoading}
          >
            {isChecking || authLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <div className="flex items-center gap-3">
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
                Sign in with Google
              </div>
            )}
          </Button>

          <Button 
            variant="link" 
            className="w-full text-blue-200/40 hover:text-blue-200/60"
            onClick={() => router.push('/')}
          >
            Return to Kiosk
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a1628] flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
