"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  const [error, setError] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          const user = result.user;
          if (!user.email?.endsWith('@neu.edu.ph')) {
            setError("Unauthorized: Only NEU accounts (@neu.edu.ph) are allowed.");
            await signOut(auth);
            setLoading(false);
            return;
          }

          // Check blocklist for institutional account (using email prefix as ID)
          const cleanId = user.email.split('@')[0];
          const blockQuery = query(collection(firestore, 'blocklist'), where('studentId', '==', cleanId), limit(1));
          const blockSnap = await getDocs(blockQuery);
          
          if (!blockSnap.empty) {
            setError(`Entry Restricted: ${blockSnap.docs[0].data().reason}`);
            await signOut(auth);
            setLoading(false);
            return;
          }

          sessionStorage.setItem('kiosk_visitor', JSON.stringify({
            studentId: cleanId,
            fullName: user.displayName,
            college: 'Institutional Account',
            loginMethod: 'google'
          }));
          router.push('/kiosk/purpose');
          return;
        }
        setLoading(false);
      } catch (err: any) {
        console.error("Auth Error:", err);
        setError(err.message);
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

  const handleIdSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!studentId.trim() || loading) return;

    setLoading(true);
    setError(null);
    const cleanId = studentId.trim();

    try {
      // 1. Check Blocklist
      const blockQuery = query(collection(firestore, 'blocklist'), where('studentId', '==', cleanId), limit(1));
      const blockSnap = await getDocs(blockQuery);
      
      if (!blockSnap.empty) {
        setError(`Entry Denied: ${blockSnap.docs[0].data().reason}`);
        setStudentId('');
        setLoading(false);
        return;
      }

      // 2. Check Existing User
      const userQuery = query(collection(firestore, 'users'), where('studentId', '==', cleanId), limit(1));
      const userSnap = await getDocs(userQuery);
      
      if (!userSnap.empty) {
        const user = userSnap.docs[0].data();
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({
          studentId: user.studentId,
          fullName: user.displayName,
          college: user.college,
          program: user.program || 'N/A',
          loginMethod: 'id'
        }));
        router.push('/kiosk/purpose');
      } else {
        router.push(`/kiosk/register?id=${encodeURIComponent(cleanId)}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to database.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: 'neu.edu.ph', prompt: 'select_account' });
    try {
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Animated Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-blue-600/10 rounded-full blur-[120px] animate-orb" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 rounded-full blur-[120px] animate-orb" style={{ animationDelay: '5s' }} />

      <div className="absolute top-8 right-8 z-50">
        <Tabs value={loginMode} onValueChange={(v) => setLoginMode(v as any)} className="w-[260px]">
          <TabsList className="grid w-full grid-cols-2 bg-white/5 border border-white/10 backdrop-blur-xl h-14 p-1 rounded-2xl">
            <TabsTrigger value="user" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-xl flex gap-2 font-black transition-all">
              <User className="h-4 w-4" /> Kiosk
            </TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white rounded-xl flex gap-2 font-black transition-all">
              <ShieldCheck className="h-4 w-4" /> Staff
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="max-w-xl w-full space-y-12 text-center z-10 animate-in fade-in zoom-in duration-1000">
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="bg-blue-500/10 p-6 rounded-[2.5rem] backdrop-blur-xl border border-white/10 shadow-2xl animate-float">
              <Library className="h-20 w-20 text-blue-400 drop-shadow-[0_0_15px_rgba(96,165,250,0.5)]" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-7xl font-black tracking-tighter text-white drop-shadow-2xl">
              NEU Library Log
            </h1>
            <p className="text-xl text-blue-200/40 font-bold uppercase tracking-widest">
              Digital Entry Management System
            </p>
          </div>
        </div>

        <div className="grid gap-8">
          <Card className="glass-dark border-none ring-1 ring-white/10 rounded-[2.5rem] shadow-2xl">
            <CardContent className="pt-12 pb-14 px-10 space-y-8">
              <form onSubmit={handleIdSubmit} className="space-y-6">
                <div className="space-y-3">
                   <Label className="text-xs font-black uppercase tracking-widest text-blue-300 ml-1">Scan or Enter School ID</Label>
                   <div className="relative group">
                    <Input
                      ref={inputRef}
                      placeholder="e.g. 2024-12345"
                      className="h-24 text-4xl text-center font-mono bg-black/40 border-white/10 text-white rounded-[1.5rem] focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-300 placeholder:text-white/5"
                      value={studentId}
                      onChange={(e) => setStudentId(e.target.value)}
                      disabled={loading}
                      autoFocus
                    />
                    <div className="absolute inset-0 rounded-[1.5rem] bg-blue-500/5 opacity-0 group-focus-within:opacity-100 blur-2xl transition-opacity -z-10" />
                  </div>
                </div>
                
                <Button 
                  className="w-full h-20 text-2xl font-black rounded-[1.5rem] bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 shadow-[0_10px_30px_rgba(37,99,235,0.4)] transition-all active:scale-[0.98]"
                  disabled={loading || !studentId.trim()}
                  type="submit"
                >
                  {loading && studentId.trim() ? <Loader2 className="animate-spin mr-3 h-8 w-8" /> : "Continue with ID"}
                </Button>
              </form>

              <div className="relative flex items-center gap-6 py-2">
                <div className="flex-grow border-t border-white/10"></div>
                <span className="text-blue-200/20 text-xs font-black tracking-widest">OR</span>
                <div className="flex-grow border-t border-white/10"></div>
              </div>

              <Button 
                variant="outline" 
                className="w-full h-16 text-xl font-bold border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-[1.2rem] backdrop-blur-md transition-all flex items-center justify-center gap-4 active:scale-[0.98]"
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                {loading && !studentId.trim() ? (
                  <Loader2 className="animate-spin h-6 w-6" />
                ) : (
                  <div className="flex items-center gap-4">
                    <svg className="h-6 w-6" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Sign in with Google Account
                  </div>
                )}
              </Button>

              {error && (
                <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200 rounded-2xl animate-in slide-in-from-top-4 duration-300">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle className="font-black text-sm uppercase tracking-wider">Access Error</AlertTitle>
                  <AlertDescription className="font-bold">{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
