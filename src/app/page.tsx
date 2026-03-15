"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, AlertCircle, ShieldCheck, User } from 'lucide-react';
import { auth, db as firestore } from '@/firebase/config';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { Alert, AlertDescription } from "@/components/ui/alert";
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
        setError(err.message);
        setLoading(false);
      }
    };

    handleRedirect();
  }, [router]);

  const handleIdSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!studentId.trim() || loading) return;

    setLoading(true);
    setError(null);
    const cleanId = studentId.trim();

    try {
      const blockQuery = query(collection(firestore, 'blocklist'), where('studentId', '==', cleanId), limit(1));
      const blockSnap = await getDocs(blockQuery);
      
      if (!blockSnap.empty) {
        setError(`Entry Denied: ${blockSnap.docs[0].data().reason}`);
        setStudentId('');
        setLoading(false);
        return;
      }

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

  useEffect(() => {
    if (loginMode === 'admin') {
      router.push('/admin/login');
    }
  }, [loginMode, router]);

  return (
    <div className="h-screen neu-dark-bg flex flex-col items-center justify-center p-4 overflow-hidden">
      <div className="absolute top-4 right-4 z-50 scale-90 md:scale-100">
        <Tabs value={loginMode} onValueChange={(v) => setLoginMode(v as any)} className="w-[180px]">
          <TabsList className="grid w-full grid-cols-2 bg-black/20 border border-[#c9a227]/30 backdrop-blur-xl h-9 p-1 rounded-lg">
            <TabsTrigger value="user" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] rounded-md flex gap-1.5 font-bold text-[10px] transition-all">
              <User className="h-3 w-3" /> Kiosk
            </TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-[#c9a227] data-[state=active]:text-[#0a2a1a] rounded-md flex gap-1.5 font-bold text-[10px] transition-all">
              <ShieldCheck className="h-3 w-3" /> Staff
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="max-w-md w-full flex flex-col items-center gap-6 z-10 animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center gap-4">
          <img 
            src="/neu-logo.png" 
            alt="NEU Logo" 
            className="w-[80px] h-[80px] object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="text-center space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-[#c9a227] drop-shadow-lg">
              NEU Library Log
            </h1>
            <p className="text-xs text-[#1a5c2e]/60 font-bold uppercase tracking-widest">
              Digital Entry Management System
            </p>
          </div>
        </div>

        <Card className="glass-neu w-full border-none ring-1 ring-[#c9a227]/20 rounded-[2rem]">
          <CardContent className="p-6 space-y-4">
            <form onSubmit={handleIdSubmit} className="space-y-4">
              <div className="space-y-1.5">
                 <Label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Scan or Enter School ID</Label>
                 <Input
                    ref={inputRef}
                    placeholder="e.g. 2024-12345"
                    className="h-14 text-2xl text-center font-mono bg-black/20 border-[#c9a227]/20 text-white rounded-xl focus:ring-4 focus:ring-[#c9a227]/20 focus:border-[#c9a227] transition-all duration-300 placeholder:text-white/5"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
              </div>
              
              <Button 
                className="w-full h-14 text-lg font-black rounded-xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-lg transition-all active:scale-[0.98]"
                disabled={loading || !studentId.trim()}
                type="submit"
              >
                {loading && studentId.trim() ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : "Continue with ID"}
              </Button>
            </form>

            <div className="relative flex items-center gap-4 py-1">
              <div className="flex-grow border-t border-[#c9a227]/10"></div>
              <span className="text-[#c9a227]/30 text-[9px] font-black tracking-widest uppercase">OR</span>
              <div className="flex-grow border-t border-[#c9a227]/10"></div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-12 text-xs font-bold border-[#c9a227]/20 bg-white text-[#0a2a1a] hover:bg-white/90 rounded-xl shadow-xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading && !studentId.trim() ? (
                <Loader2 className="animate-spin h-4 w-4" />
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </>
              )}
            </Button>

            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200 rounded-xl py-2 px-3 animate-in slide-in-from-top-2 duration-300">
                <AlertCircle className="h-3 w-3" />
                <AlertDescription className="text-[10px] font-bold">{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}