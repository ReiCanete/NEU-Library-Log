"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { UserCircle, Loader2, AlertCircle } from 'lucide-react';
import { useFirestore, useAuth } from '@/firebase';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function KioskEntry() {
  const router = useRouter();
  const { toast } = useToast();
  const { firestore } = useFirestore();
  const { auth } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!studentId.trim() || !firestore) return;

    setLoading(true);
    setLoginError(null);
    const cleanId = studentId.trim();
    console.log("Attempting login with School ID:", cleanId);

    try {
      // Check blocklist first
      const blockQuery = query(
        collection(firestore, 'blocklist'), 
        where('studentId', '==', cleanId), 
        limit(1)
      );
      const blockSnap = await getDocs(blockQuery);
      
      if (!blockSnap.empty) {
        const blockData = blockSnap.docs[0].data();
        const reason = blockData.reason || "Please see the librarian for more information.";
        setLoginError(`Entry Not Allowed: ${reason}`);
        setStudentId('');
        return;
      }

      // Find user
      const userQuery = query(
        collection(firestore, 'users'), 
        where('studentId', '==', cleanId), 
        limit(1)
      );
      const userSnap = await getDocs(userQuery);
      
      if (!userSnap.empty) {
        const user = userSnap.docs[0].data();
        console.log("User found:", user.displayName);
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({
          studentId: user.studentId,
          fullName: user.displayName,
          college: user.college,
          loginMethod: 'id'
        }));
        router.push('/kiosk/purpose');
      } else {
        console.log("New user detected, redirecting to registration.");
        router.push(`/kiosk/register?id=${encodeURIComponent(cleanId)}`);
      }
    } catch (err: any) {
      console.error("Firestore Error:", err);
      setLoginError(`System error: ${err.message || "Connection failed"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !firestore) {
      setLoginError("Auth service is not available.");
      return;
    }
    
    setLoading(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'neu.edu.ph' });

    try {
      console.log("Initiating Google Sign-In popup...");
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      console.log("Google Sign-In Success. Email:", user.email);

      if (!user.email?.endsWith('@neu.edu.ph')) {
        setLoginError("Unauthorized: Only NEU accounts (@neu.edu.ph) are allowed.");
        await signOut(auth);
        return;
      }

      sessionStorage.setItem('kiosk_visitor', JSON.stringify({
        studentId: user.email.split('@')[0], // Fallback ID from email prefix
        fullName: user.displayName,
        college: 'Unspecified',
        loginMethod: 'google'
      }));
      router.push('/kiosk/purpose');
    } catch (error: any) {
      console.error("Google Auth Error:", error);
      setLoginError(`Google Sign-in Failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-2xl w-full space-y-12 text-center animate-in fade-in zoom-in duration-500">
        <div className="space-y-4">
          <h1 className="text-6xl font-bold tracking-tight text-primary">
            NEU Library Log
          </h1>
          <p className="text-2xl text-muted-foreground font-medium">
            Please tap your ID or sign in to continue
          </p>
        </div>

        <div className="grid gap-8">
          <Card className="shadow-xl border-none ring-1 ring-slate-200">
            <CardContent className="pt-8 pb-10 space-y-6">
              <div className="flex justify-center mb-6">
                <UserCircle className="h-20 w-20 text-primary opacity-20" />
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Scan or Enter School ID"
                  className="h-20 text-3xl text-center font-mono border-2 focus-visible:ring-primary"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  disabled={loading}
                />
                <Button 
                  className="w-full h-16 text-xl font-semibold"
                  disabled={loading || !studentId.trim()}
                  type="submit"
                >
                  {loading ? <Loader2 className="animate-spin" /> : "Continue with ID"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="relative flex items-center gap-4 py-4">
            <div className="flex-grow border-t border-slate-300"></div>
            <span className="text-slate-400 font-medium">OR</span>
            <div className="flex-grow border-t border-slate-300"></div>
          </div>

          <Button 
            variant="outline" 
            className="h-16 text-xl font-semibold border-2 hover:bg-slate-100 flex items-center justify-center gap-3"
            onClick={handleGoogleSignIn}
            disabled={loading}
          >
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
            Sign in with Google (@neu.edu.ph)
          </Button>

          {loginError && (
            <Alert variant="destructive" className="animate-in slide-in-from-top-2 duration-300">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
