"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth, db as firestore } from '@/firebase/config';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function LoginContent() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      try {
        const result = await getRedirectResult(auth);
        
        if (result?.user) {
          const firebaseUser = result.user;

          if (!firebaseUser.email?.endsWith('@neu.edu.ph')) {
            setError("Unauthorized: Only @neu.edu.ph accounts are allowed.");
            await signOut(auth);
            setIsProcessing(false);
            return;
          }

          const emailPrefix = firebaseUser.email.split('@')[0];
          const userDocRef = doc(firestore, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userDocRef);
          const userData = userDoc.data();

          const isWhitelisted = emailPrefix === '25-14294-549';
          const hasAdminRole = userData?.role === 'admin' || isWhitelisted;

          if (hasAdminRole) {
            if (isWhitelisted && userData?.role !== 'admin') {
              await setDoc(userDocRef, {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                role: 'admin',
                studentId: emailPrefix,
                college: 'Administration'
              }, { merge: true });
            }
            localStorage.setItem('adminUser', JSON.stringify({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName
            }));
            router.replace('/admin');
          } else {
            setError("You do not have administrator permissions.");
            await signOut(auth);
            setIsProcessing(false);
          }
          return;
        }

        // Check if already logged in via context/session
        if (auth.currentUser) {
           const emailPrefix = auth.currentUser.email?.split('@')[0];
           const userDoc = await getDoc(doc(firestore, 'users', auth.currentUser.uid));
           const userData = userDoc.data();
           if (userData?.role === 'admin' || emailPrefix === '25-14294-549') {
              router.replace('/admin');
              return;
           }
        }

        setIsProcessing(false);
      } catch (err: any) {
        console.error("Auth Error:", err);
        setError(err.message || "An error occurred during sign-in.");
        setIsProcessing(false);
      }
    };

    handleAuth();
  }, [router]);

  const handleLogin = async () => {
    setError(null);
    setIsProcessing(true);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ 
      hd: 'neu.edu.ph', 
      prompt: 'select_account' 
    });
    try {
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center gap-6">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-blue-200 text-lg font-medium animate-pulse">Verifying credentials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[150px] animate-orb" />
      
      <Card className="max-w-md w-full glass-dark border-none shadow-2xl z-10 animate-in fade-in zoom-in duration-500">
        <CardHeader className="text-center space-y-4 pt-10">
          <div className="mx-auto bg-blue-500/10 h-20 w-20 rounded-2xl flex items-center justify-center border border-white/10 shadow-xl">
            <ShieldCheck className="h-10 w-10 text-blue-400" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-3xl font-black text-white">Staff Portal</CardTitle>
            <CardDescription className="text-blue-200/50">NEU Library Log Administrator Access</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-12 space-y-6 px-10">
          {error && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200 rounded-xl">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Access Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button 
            className="w-full h-14 text-lg font-bold rounded-xl bg-white text-[#0a1628] hover:bg-white/90 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            onClick={handleLogin}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </Button>

          <Button 
            variant="link" 
            className="w-full text-blue-200/30 hover:text-blue-200/50"
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