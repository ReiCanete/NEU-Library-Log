"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldCheck, AlertCircle, Lock, Mail, X } from 'lucide-react';
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

    if (!email) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    if (!email.includes('@')) { setError('Please enter a valid email address.'); return; }

    try {
      setLoading(true);
      setError('');
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const snap = await getDocs(q);

      let hasAdminAccess = false;
      let userData = null;
      
      if (!snap.empty) {
        userData = snap.docs[0].data();
        hasAdminAccess = userData.role === 'admin' || userData.studentId === '25-14294-549';
      }

      const isWhitelisted = user.email?.startsWith('25-14294-549');

      if (hasAdminAccess || isWhitelisted) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          role: 'admin',
          studentId: userData?.studentId || '25-14294-549'
        }, { merge: true });

        setAttempts(0);
        window.location.href = '/admin';
      } else {
        await signOut(auth);
        setError('This account does not have administrator privileges. Contact the system administrator.');
        setLoading(false);
      }
    } catch (err: any) {
      logAppError('AdminLogin', 'SignIn', err);
      const msg = getErrorMessage(err);
      setError(msg);
      
      setAttempts(prev => {
        const next = prev + 1;
        if (next >= 5) setLockoutTime(60);
        return next;
      });
      
      setLoading(false);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24] flex items-center justify-center p-6 relative overflow-hidden">
      <div className="max-w-md w-full space-y-8 flex flex-col items-center animate-in fade-in zoom-in duration-700">
        <div className="flex flex-col items-center gap-4">
          <img 
            src="/neu-logo.png" 
            alt="NEU Logo" 
            width={100} 
            height={100} 
            className="rounded-full shadow-2xl border-4 border-[#c9a227]/30" 
          />
          <div className="text-center">
            <h2 className="text-sm font-black text-[#c9a227] tracking-[0.4em] uppercase">New Era University</h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-1">Library Management System</p>
          </div>
        </div>
        
        <Card className="w-full glass-neu border border-[#c9a227]/40 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          <CardHeader className="text-center space-y-2 pt-10 px-10">
            <div className="mx-auto bg-[#c9a227]/10 h-16 w-16 rounded-2xl flex items-center justify-center border border-[#c9a227]/20">
              <ShieldCheck className="h-8 w-8 text-[#c9a227]" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-black text-white tracking-tight">Staff Portal</CardTitle>
              <CardDescription className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em]">Authorized Personnel Only</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-12 space-y-6 px-10">
            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200 rounded-xl py-3 relative pr-10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-[10px] font-black">{error}</AlertDescription>
                <button onClick={() => setError('')} className="absolute right-3 top-3 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </Alert>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c9a227]/40" />
                  <Input 
                    id="email"
                    type="email"
                    placeholder="staff@neu.edu.ph"
                    className="h-14 pl-11 bg-black/40 border-[#c9a227]/20 text-white rounded-xl focus:border-[#c9a227] transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c9a227]/40" />
                  <Input 
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-14 pl-11 bg-black/40 border-[#c9a227]/20 text-white rounded-xl focus:border-[#c9a227] transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit"
                className="w-full h-16 mt-4 text-xl font-black rounded-2xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-2xl transition-all active:scale-[0.98]"
                disabled={loading || lockoutTime > 0}
              >
                {lockoutTime > 0 ? (
                  `Try again in ${lockoutTime}s`
                ) : loading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  "Log In to Dashboard"
                )}
              </Button>
            </form>

            <Button 
              variant="link" 
              className="w-full text-white/30 hover:text-[#c9a227] font-black uppercase tracking-widest text-[9px]"
              onClick={() => router.push('/')}
            >
              Return to Kiosk
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
