"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck, Lock, Mail, X, ArrowLeft } from 'lucide-react';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getErrorMessage, logAppError } from '@/lib/errorMessages';

export default function AdminLogin() {
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [attempts, setAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(0);

  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => setLockoutTime(t => t - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutTime > 0 || !auth || !db) return;

    if (!email) { setError('Please enter your email.'); return; }
    if (!password) { setError('Please enter your password.'); return; }

    try {
      setLoading(true);
      setError('');
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;
      const userEmail = user.email?.toLowerCase();

      // Case-insensitive whitelist check
      const isWhitelisted = userEmail === 'reiangelo.canete@neu.edu.ph' || userEmail?.includes('25-14294-549');

      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const snap = await getDocs(q);

      let hasAdminAccess = false;
      let userData = null;
      
      if (!snap.empty) {
        userData = snap.docs[0].data();
        hasAdminAccess = userData.role === 'admin' || userData.studentId === '25-14294-549';
      }

      if (hasAdminAccess || isWhitelisted) {
        // Ensure role is synchronized
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          role: 'admin',
          studentId: userData?.studentId || 'ADMIN-ACCESS'
        }, { merge: true });

        setAttempts(0);
        router.push('/admin');
      } else {
        await signOut(auth);
        setError('Unauthorized account. Contact the library administrator.');
        setLoading(false);
      }
    } catch (err: any) {
      logAppError('Login', 'SignIn', err);
      setError(getErrorMessage(err));
      
      setAttempts(prev => {
        const next = prev + 1;
        if (next >= 5) setLockoutTime(60);
        return next;
      });
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24] flex items-center justify-center p-6 relative">
      <div className="absolute top-8 left-8">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-[#c9a227] hover:bg-white/10 gap-2 font-black px-6 h-11 rounded-full border border-[#c9a227]/30 text-xs">
          <ArrowLeft className="h-4 w-4" /> Return to Kiosk
        </Button>
      </div>

      <div className="max-w-sm w-full space-y-6 flex flex-col items-center">
        <div className="flex flex-col items-center gap-3">
          <img src="/neu-logo.png" alt="Logo" className="h-16 w-16 rounded-full shadow-2xl border-2 border-[#c9a227]/30" />
          <div className="text-center">
            <h2 className="text-lg font-black text-[#c9a227] tracking-wider uppercase leading-none">Management Portal</h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-2">Institutional Access Only</p>
          </div>
        </div>
        
        <Card className="w-full glass-neu border border-[#c9a227]/30 rounded-2xl shadow-2xl">
          <CardHeader className="text-center space-y-2 pt-8">
            <div className="mx-auto bg-[#c9a227]/10 h-12 w-12 rounded-xl flex items-center justify-center border border-[#c9a227]/20">
              <ShieldCheck className="h-6 w-6 text-[#c9a227]" />
            </div>
            <CardTitle className="text-base font-black text-white tracking-tight uppercase">Staff Credentials</CardTitle>
          </CardHeader>
          <CardContent className="pb-8 px-8 space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200 rounded-xl py-2 relative">
                <AlertDescription className="text-[10px] font-black uppercase tracking-widest pr-6">{error}</AlertDescription>
                <button onClick={() => setError('')} className="absolute right-3 top-2.5 hover:text-white"><X className="h-3 w-3" /></button>
              </Alert>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Official Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c9a227]/40" />
                  <Input type="email" placeholder="staff@neu.edu.ph" className="h-11 pl-11 bg-black/40 border-[#c9a227]/20 text-white rounded-xl text-xs font-bold" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c9a227]/40" />
                  <Input type="password" placeholder="••••••••" className="h-11 pl-11 bg-black/40 border-[#c9a227]/20 text-white rounded-xl text-xs font-bold" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>

              <Button type="submit" className="w-full h-12 mt-2 text-xs font-black rounded-xl bg-[#c9a227] text-[#0a2a1a] hover:opacity-90 shadow-md active:scale-95 transition-all" disabled={loading || lockoutTime > 0}>
                {lockoutTime > 0 ? `Try in ${lockoutTime}s` : loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In to Portal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}