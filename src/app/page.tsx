
"use client";

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ShieldX, Mail, CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { useFirestore, useCollection, useAuth } from '@/firebase';
import { collection, query, where, limit, getDocs, doc, setDoc, Timestamp } from 'firebase/firestore';
import { startOfDay } from 'date-fns';
import { validateStudentId } from '@/lib/validation';
import { getErrorMessage, logAppError } from '@/lib/errorMessages';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useToast } from '@/hooks/use-toast';
import AnnouncementToast from '@/components/kiosk/AnnouncementToast';
import { signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const KioskIdForm = memo(({ onSubmit, todayCount, countLoading }: { onSubmit: (id: string, type: string) => Promise<void>, todayCount: number, countLoading: boolean }) => {
  const [schoolId, setSchoolId] = useState('');
  const [visitorType] = useState('Student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || !schoolId.trim()) return;

    if (!validateStudentId(schoolId.trim())) {
      setError("Invalid ID format (XX-XXXXX-XXX).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      sessionStorage.setItem('kiosk_visitor_type', 'Student');
      await onSubmit(schoolId.trim(), 'Student');
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-white/10">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#c9a227]/80 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Entry Count
        </span>
        {countLoading ? (
          <span className="w-4 h-4 border border-white/30 border-t-white/80 rounded-full animate-spin inline-block" />
        ) : (
          <span className="text-[11px] font-black text-white/80 uppercase tabular-nums bg-white/5 px-2.5 py-0.5 rounded-full">{todayCount} today</span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mb-2">
        <div className="mb-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227]/70 flex items-center gap-2 mb-2 ml-1">
            <CreditCard className="w-3.5 h-3.5" /> School ID Entry
          </label>
          <input
            ref={inputRef}
            type="text"
            value={schoolId}
            onChange={e => { setSchoolId(e.target.value); setError(null); }}
            placeholder="e.g. 25-12946-343"
            suppressHydrationWarning
            className={`w-full h-12 bg-white/5 border rounded-2xl px-4 text-white placeholder-white/20 focus:outline-none text-sm font-bold transition-all ${error ? 'border-red-500' : 'border-white/10 focus:border-[#c9a227]/60 focus:ring-1 focus:ring-[#c9a227]/30'}`}
          />
        </div>

        {error && <p className="text-red-400 text-[9px] font-black uppercase tracking-widest text-center mt-1">{error}</p>}
        
        <button
          type="submit"
          suppressHydrationWarning
          className="w-full h-12 mt-3 bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] font-black text-sm rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-[#c9a227]/20 flex items-center justify-center disabled:opacity-40"
          disabled={loading || !schoolId.trim()}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying...
            </span>
          ) : 'Continue'}
        </button>
      </form>
    </div>
  );
});

const StaffLoginForm = memo(({ onSubmit, onGoogleSignIn }: { onSubmit: (email: string, pass: string) => Promise<void>, onGoogleSignIn: () => void }) => {
  const [emailPrefix, setEmailPrefix] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || !emailPrefix.trim() || !adminPassword) return;

    setLoading(true);
    setError(null);
    try {
      await onSubmit(`${emailPrefix.trim().toLowerCase()}@neu.edu.ph`, adminPassword);
    } catch (err: any) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center mb-4 pb-2 border-b border-white/10">
        <div className="w-10 h-10 bg-[#c9a227]/10 border border-[#c9a227]/30 rounded-xl flex items-center justify-center mb-2 shadow-lg">
          <ShieldCheck className="w-5 h-5 text-[#c9a227]" />
        </div>
        <h2 className="text-white font-black tracking-[0.2em] uppercase text-[9px]">Staff Credentials</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227]/70 flex items-center gap-2 mb-1.5 ml-1">
            <Mail className="w-3 h-3" /> Official Email
          </label>
          <div className="flex items-center h-12 bg-white/5 border border-white/10 rounded-2xl overflow-hidden focus-within:border-[#c9a227]/60 focus-within:ring-1 focus-within:ring-[#c9a227]/30 transition-all">
            <div className="pl-3.5 flex items-center shrink-0">
              <Mail className="w-3.5 h-3.5 text-white/30" />
            </div>
            <input
              type="text"
              value={emailPrefix}
              onChange={e => {
                const val = e.target.value.replace(/@.*/, '');
                setEmailPrefix(val);
                setError(null);
              }}
              placeholder="username"
              suppressHydrationWarning
              className="flex-1 h-full bg-transparent pl-2.5 pr-0 text-white placeholder-white/20 focus:outline-none text-sm font-bold"
              required
              autoComplete="username"
            />
            <div className="h-full flex items-center px-3 bg-white/5 border-l border-white/10 shrink-0">
              <span className="text-[#c9a227]/70 text-xs font-black select-none whitespace-nowrap">@neu.edu.ph</span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227]/70 flex items-center gap-2 mb-1.5 ml-1">
            <Lock className="w-3 h-3" /> Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="password"
              value={adminPassword}
              onChange={e => { setAdminPassword(e.target.value); setError(null); }}
              placeholder="••••••••"
              suppressHydrationWarning
              className="w-full h-12 bg-white/5 border border-white/10 rounded-2xl pl-10 pr-4 text-white placeholder-white/20 focus:border-[#c9a227]/60 focus:ring-1 focus:ring-[#c9a227]/30 focus:outline-none text-sm font-bold transition-all"
              required
            />
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-900/30 border border-red-500/30 rounded-xl text-red-400 text-[9px] font-black uppercase tracking-widest text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          suppressHydrationWarning
          className="w-full h-12 bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] font-black text-sm rounded-2xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-[#c9a227]/20 flex items-center justify-center"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </span>
          ) : 'Sign In to Portal'}
        </button>
      </form>

      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-[9px] font-black uppercase tracking-widest">or</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <button
        onClick={onGoogleSignIn}
        className="w-full h-12 bg-white/95 text-gray-800 font-bold text-xs rounded-2xl border border-white/20 hover:bg-white transition-all flex items-center justify-center gap-3 shadow-lg shadow-black/20"
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign in with Google
      </button>
    </div>
  );
});

function KioskEntryContent() {
  const router = useRouter();
  const { toast } = useToast();
  const auth = useAuth();
  const db = useFirestore();
  
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<'kiosk' | 'staff'>('kiosk');
  const [blockedData, setBlockedData] = useState<{reason?: string} | null>(null);
  const [checkingRedirect, setCheckingRedirect] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [idleWarning, setIdleWarning] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mode !== 'kiosk') return;
    let warningTimer: NodeJS.Timeout;
    let resetTimer: NodeJS.Timeout;

    const resetIdle = () => {
      setIdleWarning(false);
      clearTimeout(warningTimer);
      clearTimeout(resetTimer);
      // Show warning at 50 seconds
      warningTimer = setTimeout(() => setIdleWarning(true), 50000);
      // Hard reset at 60 seconds
      resetTimer = setTimeout(() => {
        sessionStorage.clear();
        router.push('/');
      }, 60000);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetIdle));
    resetIdle();

    return () => {
      clearTimeout(warningTimer);
      clearTimeout(resetTimer);
      events.forEach(e => window.removeEventListener(e, resetIdle));
    };
  }, [mode, router]);

  const todayDate = useMemo(() => {
    const now = new Date();
    const startUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));
    return Timestamp.fromDate(startUTC);
  }, []);
  const visitsQuery = useMemo(() => (db ? query(collection(db, 'visits'), where('timestamp', '>=', todayDate)) : null), [db, todayDate]);
  const { data: todayVisits, loading: countLoading } = useCollection(visitsQuery);

  const currentCount = todayVisits?.length ?? 0;

  const handleIdSubmit = useCallback(async (cleanId: string, visitorType: string) => {
    if (!db) return;
    try {
      const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', cleanId), limit(1)));
      if (!blockSnap.empty) {
        setBlockedData(blockSnap.docs[0].data());
        return;
      }

      const userSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', cleanId), limit(1)));
      if (!userSnap.empty) {
        const d = userSnap.docs[0].data();
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({ 
          studentId: d.studentId, 
          fullName: d.displayName || d.fullName, 
          college: d.college, 
          program: d.program, 
          email: d.email || '',
          visitorType: d.visitorType || visitorType,
          loginMethod: 'id' 
        }));
        router.push('/kiosk/purpose');
      } else { 
        router.push(`/kiosk/register?id=${encodeURIComponent(cleanId)}&type=${encodeURIComponent(visitorType)}`); 
      }
    } catch (err: any) { 
      logAppError('KioskEntry', 'IdSubmit', err);
      throw err;
    }
  }, [db, router]);

  const handleGoogleSignIn = async () => {
    if (!auth || !db) return;
    try {
      setCheckingRedirect(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: 'neu.edu.ph' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email?.endsWith('@neu.edu.ph')) {
        await signOut(auth);
        setGlobalError('Only @neu.edu.ph Google accounts are allowed.');
        return;
      }

      // Check blocklist
      const blockSnap = await getDocs(
        query(collection(db, 'blocklist'), where('studentId', '==', user.email))
      );
      if (!blockSnap.empty) {
        await signOut(auth);
        setGlobalError('Your account has been restricted. Please contact library staff.');
        return;
      }

      // Check if user exists in Firestore
      const userSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', user.email))
      );

      if (userSnap.empty) {
        sessionStorage.setItem('kiosk_google_user', JSON.stringify({
          email: user.email,
          fullName: user.displayName || '',
          loginMethod: 'google',
          isFirstTime: true
        }));
        window.location.href = `/kiosk/register?method=google&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(user.displayName || '')}`;
        return;
      }

      const userData = userSnap.docs[0].data();

      if (!userData.studentId || !userData.college) {
        sessionStorage.setItem('kiosk_google_user', JSON.stringify({
          email: user.email,
          fullName: userData.fullName || user.displayName || '',
          loginMethod: 'google',
          isFirstTime: false
        }));
        window.location.href = `/kiosk/register?method=google&email=${encodeURIComponent(user.email)}&name=${encodeURIComponent(userData.fullName || user.displayName || '')}`;
        return;
      }

      if (userData.role === 'admin') {
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({
          studentId: userData.studentId || user.email,
          fullName: userData.fullName || user.displayName || '',
          college: userData.college || '',
          program: userData.program || '',
          email: user.email,
          loginMethod: 'google',
          role: 'admin'
        }));
        window.location.href = '/kiosk/role-select';
        return;
      }

      sessionStorage.setItem('kiosk_visitor', JSON.stringify({
        studentId: userData.studentId || user.email,
        fullName: userData.fullName || user.displayName || '',
        college: userData.college || '',
        program: userData.program || '',
        email: user.email,
        loginMethod: 'google'
      }));
      window.location.href = '/kiosk/purpose';

    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setGlobalError('Google sign-in failed. Please try again.');
        console.error('[NEU Library Log] Google sign-in error:', err.code, err.message);
      }
    } finally {
      setCheckingRedirect(false);
    }
  };

  const handleStaffGoogleSignIn = async () => {
    if (!auth || !db) return;
    try {
      setCheckingRedirect(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ hd: 'neu.edu.ph' });
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email?.endsWith('@neu.edu.ph')) {
        await signOut(auth);
        setGlobalError('Only @neu.edu.ph Google accounts are allowed.');
        return;
      }

      const userSnap = await getDocs(
        query(collection(db, 'users'), where('email', '==', user.email))
      );

      if (userSnap.empty || userSnap.docs[0].data().role !== 'admin') {
        await signOut(auth);
        setGlobalError('You do not have admin access.');
        return;
      }

      sessionStorage.setItem('adminEmail', user.email);
      sessionStorage.setItem('adminName', user.displayName || '');
      window.location.href = '/admin';

    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setGlobalError('Google sign-in failed. Please try again.');
        console.error('[NEU Library Log] Staff Google sign-in error:', err.code, err.message);
      }
    } finally {
      setCheckingRedirect(false);
    }
  };

  const handleStaffLogin = useCallback(async (adminEmail: string, adminPassword: string) => {
    if (!auth || !db) return;
    try {
      const result = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      const user = result.user;
      const userEmail = user.email?.toLowerCase();
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
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email?.split('@')[0],
          role: 'admin',
          studentId: userData?.studentId || 'ADMIN-ACCESS'
        }, { merge: true });
        router.push('/admin');
      } else {
        await signOut(auth);
        throw new Error('Unauthorized account.');
      }
    } catch (err: any) {
      logAppError('StaffLogin', 'SignIn', err);
      throw err;
    }
  }, [auth, db, router]);

  if (!mounted) return null;

  if (checkingRedirect) {
    return (
      <div className="fixed inset-0 bg-[#0a2a1a] flex flex-col items-center justify-center z-[1000]">
        <img src="/neu-library-logo.png" alt="NEU Logo" className="w-20 h-20 rounded-full mb-4 animate-pulse shadow-2xl border-2 border-[#c9a227]/40 ring-4 ring-[#c9a227]/10" />
        <div className="w-8 h-8 border-2 border-[#c9a227]/30 border-t-[#c9a227] rounded-full animate-spin mb-3" />
        <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em]">Verifying your account...</p>
      </div>
    );
  }

  if (globalError) {
    return (
      <div className="h-screen bg-[#071a0f] flex flex-col items-center justify-center p-8 text-center text-white z-[200]">
        <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[3rem] border border-red-500/30 flex flex-col items-center max-w-md animate-in zoom-in duration-300 ring-1 ring-red-500/20 shadow-2xl">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-black mb-4 uppercase tracking-tighter">Login Failed</h2>
          <p className="text-white/60 text-sm font-bold mb-8">{globalError}</p>
          <button suppressHydrationWarning onClick={() => { setGlobalError(null); window.location.reload(); }} className="w-full h-12 bg-white text-[#0a2a1a] font-black rounded-xl">Try Again</button>
        </div>
      </div>
    );
  }

  if (blockedData) {
    return (
      <div className="h-screen bg-[#071a0f] flex flex-col items-center justify-center p-8 text-center text-white z-[200]">
        <div className="bg-white/5 backdrop-blur-xl p-10 rounded-[3rem] border border-red-500/30 flex flex-col items-center max-w-md animate-in zoom-in duration-300 ring-1 ring-red-500/20 shadow-2xl">
          <ShieldX className="h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-black mb-2 uppercase tracking-tighter">Access Restricted</h2>
          <div className="bg-black/30 p-6 rounded-2xl w-full text-left mb-6 border border-white/10">
            <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">Reason</p>
            <p className="font-bold text-sm italic">{blockedData.reason || 'Safety/Policy Violation'}</p>
          </div>
          <button suppressHydrationWarning onClick={() => setBlockedData(null)} className="w-full h-12 bg-white text-[#0a2a1a] font-black rounded-xl">Return</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-[#071a0f] relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1a5c2e33_0%,_transparent_60%)] pointer-events-none z-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#c9a22711_0%,_transparent_50%)] pointer-events-none z-0" />
      <AnnouncementToast />
      
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-full p-1 shadow-2xl">
        <button suppressHydrationWarning onClick={() => setMode('kiosk')} className={`px-4 py-1.5 rounded-full text-[11px] transition-all duration-200 ${mode === 'kiosk' ? 'bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] font-black shadow-md' : 'text-white/50 hover:text-white/80 font-medium'}`}>Kiosk</button>
        <button suppressHydrationWarning onClick={() => setMode('staff')} className={`px-4 py-1.5 rounded-full text-[11px] transition-all duration-200 ${mode === 'staff' ? 'bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] font-black shadow-md' : 'text-white/50 hover:text-white/80 font-medium'}`}>Staff</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 pb-12 relative z-10">
        <div className="absolute w-40 h-40 rounded-full bg-[#c9a227]/5 blur-3xl -z-10" />
        <img src="/neu-library-logo.png" alt="NEU Logo" className="w-20 h-20 rounded-full mb-3 shadow-2xl border-2 border-[#c9a227]/40 ring-4 ring-[#c9a227]/10" />
        <h1 className="text-4xl font-black text-[#c9a227] text-center drop-shadow-lg uppercase tracking-tight leading-none">NEU LIBRARY</h1>
        <p className="text-[10px] font-black tracking-[0.3em] text-white/30 uppercase mt-1.5 mb-5">Digital Visitor Log</p>

        <div className="w-full max-w-[460px] mx-auto animate-in fade-in zoom-in duration-500">
          <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl ring-1 ring-[#c9a227]/10">
            {mode === 'kiosk' ? (
              <>
                <KioskIdForm onSubmit={handleIdSubmit} todayCount={currentCount} countLoading={countLoading} />
                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-white/30 text-[9px] font-black uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <button
                  onClick={handleGoogleSignIn}
                  className="w-full h-12 bg-white/95 text-gray-800 font-bold text-xs rounded-2xl border border-white/20 hover:bg-white transition-all flex items-center justify-center gap-3 shadow-lg shadow-black/20"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Sign in with Google (@neu.edu.ph)
                </button>
              </>
            ) : (
              <StaffLoginForm onSubmit={handleStaffLogin} onGoogleSignIn={handleStaffGoogleSignIn} />
            )}
          </div>
        </div>
      </div>

      {idleWarning && mode === 'kiosk' && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white/5 backdrop-blur-xl border border-[#c9a227]/30 rounded-3xl p-10 text-center max-w-sm mx-4 shadow-2xl ring-1 ring-[#c9a227]/20">
            <div className="w-16 h-16 rounded-full bg-[#c9a227]/10 border border-[#c9a227]/30 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⏱</span>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight mb-2">Still there?</h2>
            <p className="text-white/50 text-sm font-bold mb-6">Kiosk will reset in a few seconds due to inactivity.</p>
            <button
              onClick={() => setIdleWarning(false)}
              className="w-full h-12 bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] font-black rounded-2xl hover:opacity-90 transition-all shadow-lg"
            >
              I'm still here
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KioskEntry() {
  return (
    <ErrorBoundary fallbackType="kiosk">
      <title>NEU Library Log — Visitor Entry</title>
      <KioskEntryContent />
    </ErrorBoundary>
  );
}
