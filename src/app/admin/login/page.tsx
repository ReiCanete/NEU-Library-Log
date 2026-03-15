
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldCheck, AlertCircle, Lock, Mail } from 'lucide-react';
import { auth, db } from '@/firebase/config';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    try {
      setLoading(true);
      setError('');
      
      const result = await signInWithEmailAndPassword(auth, email, password);
      const user = result.user;

      // Only @neu.edu.ph accounts are allowed
      if (!user.email?.endsWith('@neu.edu.ph')) {
        await signOut(auth);
        setError('Only @neu.edu.ph accounts are allowed.');
        setLoading(false);
        return;
      }

      // Query users collection for role
      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const snap = await getDocs(q);

      let role = '';
      let isStaffId = false;
      
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        role = userData.role;
        isStaffId = userData.studentId === '25-14294-549';
      }

      // Whitelist check
      const isWhitelisted = user.email.startsWith('25-14294-549');

      if (role === 'admin' || isWhitelisted || isStaffId) {
        sessionStorage.setItem('adminEmail', user.email);
        sessionStorage.setItem('adminName', user.displayName || user.email.split('@')[0]);
        // Clean navigation to admin
        window.location.href = '/admin';
      } else {
        await signOut(auth);
        setError('You do not have admin access.');
        setLoading(false);
      }
    } catch (err: any) {
      console.error("Login error:", err);
      let message = 'Failed to sign in. Please check your credentials.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/too-many-requests') {
        message = 'Account temporarily disabled due to many failed attempts. Try again later.';
      }
      setError(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen neu-dark-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-8 flex flex-col items-center animate-in fade-in zoom-in duration-500">
        <img 
          src="/neu-logo.png" 
          alt="NEU Logo" 
          width={100} 
          height={100} 
          className="rounded-full shadow-2xl" 
        />
        
        <Card className="w-full glass-neu border-none rounded-[2rem]">
          <CardHeader className="text-center space-y-2 pt-8">
            <div className="mx-auto bg-[#c9a227]/10 h-16 w-16 rounded-2xl flex items-center justify-center border border-[#c9a227]/20">
              <ShieldCheck className="h-8 w-8 text-[#c9a227]" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-3xl font-black text-[#c9a227]">Staff Portal</CardTitle>
              <CardDescription className="text-white/40 text-xs font-bold uppercase tracking-widest">Administrator Credentials Required</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-10 space-y-6 px-10">
            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200 rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-bold">{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c9a227]/40" />
                  <Input 
                    id="email"
                    type="email"
                    placeholder="admin@neu.edu.ph"
                    className="h-12 pl-11 bg-black/20 border-[#c9a227]/20 text-white rounded-xl focus:border-[#c9a227] transition-all"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c9a227]/40" />
                  <Input 
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="h-12 pl-11 bg-black/20 border-[#c9a227]/20 text-white rounded-xl focus:border-[#c9a227] transition-all"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit"
                className="w-full h-14 mt-4 text-lg font-black rounded-xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-lg transition-all active:scale-[0.98]"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  "Sign In to Dashboard"
                )}
              </Button>
            </form>

            <Button 
              variant="link" 
              className="w-full text-[#c9a227]/40 hover:text-[#c9a227] font-bold uppercase tracking-widest text-[10px]"
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
