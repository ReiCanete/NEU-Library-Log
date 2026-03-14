
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Library, Loader2, AlertCircle, ShieldCheck, User } from 'lucide-react';
import { auth, db as firestore } from '@/firebase/config';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function KioskEntry() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          if (!user.email?.endsWith('@neu.edu.ph')) {
            setLoginError("Unauthorized: Only NEU accounts (@neu.edu.ph) are allowed.");
            await signOut(auth);
            setLoading(false);
            return;
          }

          sessionStorage.setItem('kiosk_visitor', JSON.stringify({
            studentId: user.email.split('@')[0], 
            fullName: user.displayName,
            college: 'Unspecified',
            loginMethod: 'google'
          }));
          router.push('/kiosk/purpose');
          return;
        }
      } catch (error: any) {
        console.error("Redirect Auth Error:", error);
        setLoginError(`Google Sign-in Failed: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    handleRedirect();
  }, [router]);

  useEffect(() => {
    if (loginMode === 'admin') {
      router.push('/admin/login');
    }
  }, [loginMode, router]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!studentId.trim()) return;

    setLoading(true);
    setLoginError(null);
    const cleanId = studentId.trim();

    try {
      // Check blocklist
      const blockQuery = query(
        collection(firestore, 'blocklist'), 
        where('studentId', '==', cleanId), 
        limit(1)
      );
      const blockSnap = await getDocs(blockQuery);
      
      if (!blockSnap.empty) {
        const blockData = blockSnap.docs[0].data();
        setLoginError(`Entry Restricted: ${blockData.reason}`);
        setStudentId('');
        setLoading(false);
        return;
      }

      // Check registered users
      const userQuery = query(
        collection(firestore, 'users'), 
        where('studentId', '==', cleanId), 
        limit(1)
      );
      const userSnap = await getDocs(userQuery);
      
      if (!userSnap.empty) {
        const user = userSnap.docs[0].data();
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({
          studentId: user.studentId,
          fullName: user.displayName,
          college: user.college,
          loginMethod: 'id'
        }));
        router.push('/kiosk/purpose');
      } else {
        router.push(`/kiosk/register?id=${encodeURIComponent(cleanId)}`);
      }
    } catch (err: any) {
      setLoginError(`System error: ${err.message || "Connection failed"}`);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ 
      hd: 'neu.edu.ph', 
      prompt: 'select_account' 
    });
    try {
      await signInWithRedirect(auth, provider);
    } catch (error: any) {
      setLoginError(`Google Sign-in Failed: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-8 right-8 z-20">
        <Tabs value={loginMode} onValueChange={(v) => setLoginMode(v as 'user' | 'admin')} className="w-[240px]">
          <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 backdrop-blur-xl h-12">
            <TabsTrigger value="user" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex gap-2 font-bold transition-all">
              <User className="h-4 w-4" /> Kiosk
            </TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white flex gap-2 font-bold transition-all">
              <ShieldCheck className="h-4 w-4" /> Staff
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-float" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-float" style={{ animationDelay: '2s' }} />

      <div className="max-w-xl w-full space-y-8 text-center z-10 animate-in fade-in zoom-in duration-1000">
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-xl border border-white/20 shadow-2xl">
              <Library className="h-16 w-16 text-blue-400" />
            </div>
          </div>
          <h1 className="text-6xl font-black tracking-tight text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">
            NEU Library Log
          </h1>
          <p className="text-xl text-blue-200/80 font-medium">
            Please scan your ID or sign in to continue
          </p>
        </div>

        <div className="grid gap-6">
          <Card className="glass-dark border-none ring-1 ring-white/20">
            <CardContent className="pt-8 pb-10 space-y-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="relative group">
                  <Input
                    ref={inputRef}
                    type="text"
                    placeholder="Scan or Enter School ID"
                    className="h-20 text-3xl text-center font-mono bg-black/40 border-white/10 text-white rounded-2xl focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:border-blue-500 transition-all duration-300 group-hover:border-white/30"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    disabled={loading}
                    autoFocus
                    suppressHydrationWarning
                  />
                  <div className="absolute inset-0 rounded-2xl bg-blue-500/5 opacity-0 group-focus-within:opacity-100 blur-xl transition-opacity -z-10" />
                </div>
                <Button 
                  className="w-full h-16 text-xl font-bold rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 border-none shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98]"
                  disabled={loading || !studentId.trim()}
                  type="submit"
                  suppressHydrationWarning
                >
                  {loading && studentId.trim() ? <Loader2 className="animate-spin mr-2" /> : "Continue with ID"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="relative flex items-center gap-4 py-2">
            <div className="flex-grow border-t border-white/10"></div>
            <span className="text-blue-200/40 text-sm font-bold tracking-widest">OR</span>
            <div className="flex-grow border-t border-white/10"></div>
          </div>

          <Button 
            variant="outline" 
            className="h-16 text-xl font-semibold border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-white/20 rounded-2xl backdrop-blur-md transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
            onClick={handleGoogleSignIn}
            disabled={loading}
            suppressHydrationWarning
          >
            {loading && !studentId.trim() ? (
              <Loader2 className="animate-spin" />
            ) : (
              <svg className="h-6 w-6" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Sign in with Google (@neu.edu.ph)
          </Button>

          {loginError && (
            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200 animate-in slide-in-from-top-2 duration-300 rounded-2xl backdrop-blur-lg">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">Access Error</AlertTitle>
              <AlertDescription>{loginError}</AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
