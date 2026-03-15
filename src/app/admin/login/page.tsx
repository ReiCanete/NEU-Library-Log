"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth, db } from '@/firebase/config';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AdminLogin() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: 'neu.edu.ph', prompt: 'select_account' });
      
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email?.endsWith('@neu.edu.ph')) {
        await signOut(auth);
        setError('Only @neu.edu.ph accounts are allowed.');
        setLoading(false);
        return;
      }

      // Whitelist check
      const emailPrefix = user.email.split('@')[0];
      const isWhitelisted = emailPrefix === '25-14294-549';

      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const snap = await getDocs(q);

      let role = '';
      if (!snap.empty) {
        role = snap.docs[0].data().role;
      }

      if (role === 'admin' || isWhitelisted) {
        sessionStorage.setItem('adminEmail', user.email);
        sessionStorage.setItem('adminName', user.displayName || '');
        window.location.href = '/admin';
      } else {
        await signOut(auth);
        setError('You do not have admin access.');
        setLoading(false);
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message);
      }
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
              <CardDescription className="text-white/40 text-xs font-bold uppercase tracking-widest">Administrator Access Required</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pb-10 space-y-6 px-10">
            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-200 rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs font-bold">{error}</AlertDescription>
              </Alert>
            )}

            <Button 
              className="w-full h-14 text-lg font-black rounded-xl bg-white text-[#0a2a1a] hover:bg-white/90 border-2 border-transparent hover:border-[#c9a227] transition-all flex items-center justify-center gap-3"
              onClick={handleSignIn}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign in with Google
                </>
              )}
            </Button>

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