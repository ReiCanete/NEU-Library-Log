"use client";

import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, ShieldX, Mail, CreditCard, Lock, ShieldCheck } from 'lucide-react';
import { useFirestore, useCollection, useDoc, useAuth } from '@/firebase';
import { collection, query, where, limit, getDocs, doc, setDoc } from 'firebase/firestore';
import { startOfDay } from 'date-fns';
import { validateStudentId, validateNEUEmail } from '@/lib/validation';
import { logAppError } from '@/lib/errorMessages';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useToast } from '@/hooks/use-toast';
import AnnouncementToast from '@/components/kiosk/AnnouncementToast';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

const KioskIdForm = memo(({ onSubmit, todayCount, capacity }: { onSubmit: (id: string, type: string) => Promise<void>, todayCount: number, capacity: number }) => {
  const [schoolId, setSchoolId] = useState('');
  const [visitorType, setVisitorType] = useState('Student');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [visitorType]);

  const visitorTypes = [
    { value: 'Student', label: 'Student' },
    { value: 'Faculty', label: 'Faculty' },
    { value: 'Administrative Staff', label: 'Admin Staff' },
    { value: 'Library Staff', label: 'Library' },
    { value: 'Guest', label: 'Guest' },
  ];

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || !schoolId.trim()) return;

    if (visitorType === 'Student' && !validateStudentId(schoolId.trim())) {
      setError("Invalid ID format (XX-XXXXX-XXX).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      sessionStorage.setItem('kiosk_visitor_type', visitorType);
      await onSubmit(schoolId.trim(), visitorType);
    } catch (err: any) {
      setError(err.message || "Connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-[#c9a227]/20">
        <span className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Entry Count
        </span>
        <span className="text-[10px] font-black text-white uppercase tabular-nums">{todayCount} / {capacity}</span>
      </div>

      <div className="mb-3">
        <label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] mb-2 block ml-1">Visitor Type</label>
        <div className="flex flex-wrap gap-1.5">
          {visitorTypes.map(type => (
            <button
              key={type.value}
              type="button"
              suppressHydrationWarning
              onClick={() => { setVisitorType(type.value); setSchoolId(''); setError(null); }}
              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                visitorType === type.value
                  ? 'bg-[#c9a227] text-[#0a2a1a]'
                  : 'bg-[#071a0f] text-white/50 border border-[#c9a227]/20 hover:border-[#c9a227]/60'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mb-2">
        <div className="mb-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] flex items-center gap-2 mb-2 ml-1">
            {visitorType === 'Student' ? (
              <><CreditCard className="w-3.5 h-3.5" /> School ID Entry</>
            ) : visitorType === 'Guest' ? (
              <><ShieldCheck className="w-3.5 h-3.5" /> Full Name</>
            ) : (
              <><CreditCard className="w-3.5 h-3.5" /> Employee ID</>
            )}
          </label>
          <input
            ref={inputRef}
            type="text"
            value={schoolId}
            onChange={e => { setSchoolId(e.target.value); setError(null); }}
            placeholder={visitorType === 'Student' ? 'e.g. 25-12946-343' : visitorType === 'Guest' ? 'Enter your full name' : 'e.g. EMP-2024-001'}
            suppressHydrationWarning
            className={`w-full h-11 bg-[#071a0f] border rounded-xl px-4 text-white placeholder-white/30 focus:outline-none text-sm font-bold transition-all ${error ? 'border-red-500' : 'border-[#c9a227]/30 focus:border-[#c9a227]'}`}
          />
        </div>

        {error && <p className="text-red-400 text-[9px] font-black uppercase tracking-widest text-center mt-1">{error}</p>}
        
        <button
          type="submit"
          suppressHydrationWarning
          className="w-full h-11 mt-2.5 bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] font-black text-sm rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center disabled:opacity-40"
          disabled={loading || !schoolId.trim()}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {visitorType === 'Guest' ? 'Processing...' : 'Verifying...'}
            </span>
          ) : visitorType === 'Guest' ? 'Continue as Guest →' : 'Continue'}
        </button>
      </form>
    </div>
  );
});

const KioskEmailForm = memo(({ onSubmit }: { onSubmit: (email: string) => Promise<void> }) => {
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || !emailInput.trim()) return;

    if (!validateNEUEmail(emailInput.trim())) {
      setError("Invalid email. Must end with @neu.edu.ph");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit(emailInput.trim());
    } catch (err: any) {
      setError(err.message || "Connection error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <label className="text-[10px] font-black uppercase tracking-widest text-[#c9a227] flex items-center gap-2 mb-2 ml-1">
        <Mail className="w-3.5 h-3.5" /> Institutional Email
      </label>
      <input
        type="email"
        value={emailInput}
        onChange={e => { setEmailInput(e.target.value); setError(null); }}
        placeholder="e.g. juan@neu.edu.ph"
        suppressHydrationWarning
        className={`w-full h-11 bg-[#071a0f] border rounded-xl px-4 text-white placeholder-white/30 focus:outline-none text-sm font-bold text-center transition-all ${error ? 'border-red-500' : 'border-[#c9a227]/30 focus:border-[#c9a227]'}`}
      />
      {error && <p className="text-red-400 text-[9px] font-black uppercase tracking-widest text-center mt-1">{error}</p>}
      <button
        type="submit"
        suppressHydrationWarning
        className="w-full h-11 mt-2.5 bg-transparent border-2 border-[#c9a227] text-[#c9a227] font-black text-sm rounded-xl hover:bg-[#c9a227]/10 active:scale-[0.98] transition-all disabled:opacity-50"
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Verifying...
          </span>
        ) : 'Continue with Email'}
      </button>
    </form>
  );
});

const StaffLoginForm = memo(({ onSubmit }: { onSubmit: (email: string, pass: string) => Promise<void> }) => {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (loading || !adminEmail || !adminPassword) return;

    setLoading(true);
    setError(null);
    try {
      await onSubmit(adminEmail, adminPassword);
    } catch (err: any) {
      setError("Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col items-center mb-4 pb-2 border-b border-[#c9a227]/20">
        <div className="w-10 h-10 bg-[#c9a227]/10 border border-[#c9a227]/30 rounded-xl flex items-center justify-center mb-2">
          <ShieldCheck className="w-5 h-5 text-[#c9a227]" />
        </div>
        <h2 className="text-white font-black tracking-widest uppercase text-[9px]">Staff Credentials</h2>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] flex items-center gap-2 mb-1.5 ml-1">
            <Mail className="w-3 h-3" /> Official Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              type="email"
              value={adminEmail}
              onChange={e => { setAdminEmail(e.target.value); setError(null); }}
              placeholder="staff@neu.edu.ph"
              suppressHydrationWarning
              className="w-full h-11 bg-[#071a0f] border border-[#c9a227]/30 rounded-xl pl-10 pr-4 text-white placeholder-white/30 focus:border-[#c9a227] focus:outline-none text-sm font-bold transition-all"
              required
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] flex items-center gap-2 mb-1.5 ml-1">
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
              className="w-full h-11 bg-[#071a0f] border border-[#c9a227]/30 rounded-xl pl-10 pr-4 text-white placeholder-white/30 focus:border-[#c9a227] focus:outline-none text-sm font-bold transition-all"
              required
            />
          </div>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-[9px] font-black uppercase tracking-widest text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          suppressHydrationWarning
          className="w-full h-11 bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] font-black text-sm rounded-xl hover:opacity-90 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing in...
            </span>
          ) : 'Sign In to Portal'}
        </button>
      </form>
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const todayDate = useMemo(() => startOfDay(new Date()), []);
  const visitsQuery = useMemo(() => (db ? query(collection(db, 'visits'), where('timestamp', '>=', todayDate)) : null), [db, todayDate]);
  const { data: todayVisits } = useCollection(visitsQuery);
  const settingsRef = useMemo(() => (db ? doc(db, 'settings', 'library') : null), [db]);
  const { data: settings } = useDoc(settingsRef);

  const dailyCapacity = settings?.dailyCapacity || 200;
  const currentCount = todayVisits?.length || 0;
  const isAtCapacity = currentCount >= dailyCapacity;

  const handleIdSubmit = useCallback(async (cleanId: string, visitorType: string) => {
    if (!db) return;
    try {
      if (visitorType === 'Guest') {
        const guestId = `GUEST-${Date.now()}`;
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({
          studentId: guestId,
          fullName: cleanId,
          college: '',
          program: '',
          visitorType: 'Guest',
          loginMethod: 'id'
        }));
        router.push('/kiosk/purpose');
        return;
      }

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

  const handleEmailSubmit = useCallback(async (cleanEmail: string) => {
    if (!db) return;
    try {
      const blockSnap = await getDocs(query(collection(db, 'blocklist'), where('studentId', '==', cleanEmail), limit(1)));
      if (!blockSnap.empty) {
        setBlockedData(blockSnap.docs[0].data());
        return;
      }

      const userSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1)));
      if (!userSnap.empty) {
        const d = userSnap.docs[0].data();
        sessionStorage.setItem('kiosk_visitor', JSON.stringify({ 
          studentId: d.studentId, 
          fullName: d.displayName || d.fullName, 
          college: d.college, 
          program: d.program, 
          email: d.email,
          visitorType: d.visitorType || 'Student',
          loginMethod: 'email' 
        }));
        toast({ title: `Welcome back, ${d.fullName.split(' ')[0]}!`, description: "Redirecting to selection...", className: "bg-[#1a3a2a] text-white border-[#c9a227]" });
        setTimeout(() => router.push('/kiosk/purpose'), 1500);
      } else { 
        router.push(`/kiosk/register?method=email&email=${encodeURIComponent(cleanEmail)}&type=Student`); 
      }
    } catch (err: any) { 
      logAppError('KioskEntry', 'EmailSubmit', err);
      throw err;
    }
  }, [db, router, toast]);

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

  if (blockedData) {
    return (
      <div className="h-screen bg-[#0a2a1a] flex flex-col items-center justify-center p-8 text-center text-white z-[200]">
        <div className="bg-red-500/10 p-10 rounded-[3rem] border-2 border-red-500/30 flex flex-col items-center max-w-md animate-in zoom-in duration-300">
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
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-b from-[#0a2a1a] to-[#0d3d24]">
      <AnnouncementToast />
      
      <div className="absolute top-3 right-4 z-20 flex items-center gap-1 bg-[#0d3d24]/80 backdrop-blur-sm border border-[#c9a227]/20 rounded-full p-1 shadow-xl">
        <button suppressHydrationWarning onClick={() => setMode('kiosk')} className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${mode === 'kiosk' ? 'bg-[#c9a227] text-[#0a2a1a] font-black shadow-md' : 'text-white/60 hover:text-white'}`}>Kiosk</button>
        <button suppressHydrationWarning onClick={() => setMode('staff')} className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 ${mode === 'staff' ? 'bg-[#c9a227] text-[#0a2a1a] font-black shadow-md' : 'text-white/60 hover:text-white'}`}>Staff</button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative">
        <div className="absolute w-40 h-40 rounded-full bg-[#c9a227]/5 blur-3xl -z-10" />
        <img src="/neu-logo.png" alt="NEU Logo" className="w-16 h-16 rounded-full mb-2 shadow-2xl border-2 border-[#c9a227]/30" />
        <h1 className="text-3xl font-black text-[#c9a227] text-center drop-shadow-2xl uppercase tracking-tight leading-none">NEU LIBRARY</h1>
        <p className="text-[10px] font-black tracking-widest text-white/40 uppercase mt-1 mb-4">Digital Visitor Log</p>

        <div className="w-full max-w-[460px] mx-auto animate-in fade-in zoom-in duration-500">
          {isAtCapacity && mode === 'kiosk' ? (
            <div className="bg-[#0a2a1a]/60 backdrop-blur-2xl w-full border-2 border-red-500/50 rounded-[2rem] p-8 text-center space-y-4">
              <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Full Capacity</h2>
              <p className="text-white/60 text-xs font-bold">The library is at maximum capacity ({dailyCapacity}).</p>
              <button suppressHydrationWarning className="w-full h-12 rounded-xl bg-white/10 text-white font-black" onClick={() => window.location.reload()}>Retry</button>
            </div>
          ) : (
            <div className="w-full bg-[#0d3d24]/80 backdrop-blur-sm border border-[#c9a227]/20 rounded-2xl p-5 shadow-2xl">
              {mode === 'kiosk' ? (
                <>
                  <KioskIdForm onSubmit={handleIdSubmit} todayCount={currentCount} capacity={dailyCapacity} />
                  <div className="flex items-center gap-3 my-3">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-white/30 text-[9px] font-black uppercase tracking-widest">or</span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <KioskEmailForm onSubmit={handleEmailSubmit} />
                </>
              ) : (
                <StaffLoginForm onSubmit={handleStaffLogin} />
              )}
            </div>
          )}
        </div>
      </div>
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
