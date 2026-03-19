"use client";

import { useState, Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronDown, UserPlus, ArrowLeft, Lock } from 'lucide-react';
import { logAppError } from '@/lib/errorMessages';
import AnnouncementToast from '@/components/kiosk/AnnouncementToast';

const COLLEGES = [
  { name: "College of Accountancy", programs: ["BS Accountancy", "BS Accounting Information System"] },
  { name: "College of Agriculture", programs: ["BS Agriculture"] },
  { name: "College of Arts and Sciences", programs: ["BA Economics", "BA Political Science", "BS Biology", "BS Psychology", "BS Public Administration"] },
  { name: "College of Business Administration", programs: ["BS Business Administration Major in Financial Management", "BS Business Administration Major in Human Resource Development Management", "BS Business Administration Major in Legal Management", "BS Business Administration Major in Marketing Management", "BS Entrepreneurship", "BS Real Estate Management"] },
  { name: "College of Communication", programs: ["BA Broadcasting", "BA Communication", "BA Journalism"] },
  { name: "College of Informatics and Computing Studies", programs: ["BS Library and Information Science", "BS Computer Science", "BS Entertainment and Multimedia Computing (Digital Animation Technology)", "BS Entertainment and Multimedia Computing (Game Development)", "BS Information Technology", "BS Information System"] },
  { name: "College of Criminology", programs: ["BS Criminology"] },
  { name: "College of Education", programs: ["BS Elementary Education", "BS Elementary Education (Preschool Education)", "BS Elementary Education (Special Education)", "BS Secondary Education Major in Music Arts and Physical Education", "BS Secondary Education Major in English", "BS Secondary Education Major in Filipino", "BS Secondary Education Major in Mathematics", "BS Secondary Education Major in Science", "BS Secondary Education Major in Social Studies", "BS Secondary Education Major in Technology and Livelihood Education"] },
  { name: "College of Engineering and Architecture", programs: ["BS Architecture", "BS Astronomy", "BS Civil Engineering", "BS Electrical Engineering", "BS Electronics Engineering", "BS Industrial Engineering", "BS Mechanical Engineering"] },
  { name: "College of Medical Technology", programs: ["BS Medical Technology"] },
  { name: "College of Midwifery", programs: ["Diploma in Midwifery"] },
  { name: "College of Music", programs: ["BM Choral Conducting", "BM Music Education", "BM Piano", "BM Voice"] },
  { name: "College of Nursing", programs: ["BS Nursing"] },
  { name: "College of Physical Therapy", programs: ["BS Physical Therapy"] },
  { name: "College of Respiratory Therapy", programs: ["BS Respiratory Therapy"] },
  { name: "School of International Relations", programs: ["BA Foreign Service"] }
];

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const db = useFirestore();
  
  const method = searchParams.get('method');
  const idFromUrl = searchParams.get('id');
  const emailFromUrl = searchParams.get('email') || '';
  const nameFromUrl = searchParams.get('name') || '';
  const isGoogleSignIn = method === 'google';
  const nameAutoCapitalize = isGoogleSignIn ? 'none' : 'words';
  
  const [visitorType] = useState('Student');
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [studentId, setStudentId] = useState(idFromUrl || '');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [email] = useState(emailFromUrl);
  
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) return;
    setLoading(false);
  }, [db]);

  useEffect(() => {
    if (!nameFromUrl) return;
    const raw = nameFromUrl.trim();

    const capitalize = (str: string) =>
      str.split(' ').map(w => {
        if (!w) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(' ');

    if (raw.includes(',')) {
      const [lastPart, firstPart] = raw.split(',').map(s => s.trim());
      setLastName(lastPart);
      if (firstPart) {
        const parts = firstPart.split(' ').filter(Boolean);
        if (parts.length >= 2) {
          const lastWord = parts[parts.length - 1];
          if (lastWord.length <= 2) {
            setFirstName(parts.slice(0, -1).join(' '));
            setMiddleInitial(lastWord.replace('.', '').toUpperCase());
          } else {
            setFirstName(parts.join(' '));
          }
        } else {
          setFirstName(firstPart);
        }
      }
      return;
    }

    if (raw.includes('.') && raw === raw.toLowerCase()) {
      const parts = raw.split('.');
      if (parts.length >= 2) {
        setFirstName(capitalize(parts[0]));
        setLastName(capitalize(parts[parts.length - 1]));
        if (parts.length === 3) {
          setMiddleInitial(parts[1].charAt(0).toUpperCase());
        }
      } else {
        setFirstName(capitalize(raw));
      }
      return;
    }

    const parts = raw.split(' ').filter(Boolean);
    if (parts.length >= 2) {
      setLastName(parts[parts.length - 1]);
      
      let miIndex = -1;
      for (let i = 0; i < parts.length - 1; i++) {
        if (parts[i].length === 1 || (parts[i].length === 2 && parts[i].endsWith('.'))) {
          miIndex = i;
          break;
        }
      }

      if (miIndex !== -1) {
        setFirstName(parts.slice(0, miIndex).join(' '));
        setMiddleInitial(parts[miIndex].replace('.', '').toUpperCase());
      } else {
        setFirstName(parts.slice(0, -1).join(' '));
      }
    } else {
      setFirstName(raw);
    }
  }, [nameFromUrl]);

  const fullName = [firstName.trim(), middleInitial.trim() ? middleInitial.trim() + '.' : '', lastName.trim()]
    .filter(Boolean)
    .join(' ');

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase();
    const results: any[] = [];
    COLLEGES.forEach(college => {
      const matchedPrograms = college.programs.filter(p => 
        p.toLowerCase().includes(term) || college.name.toLowerCase().includes(term)
      );
      if (matchedPrograms.length > 0) {
        results.push({ type: 'header', label: college.name });
        matchedPrograms.forEach(p => { 
          results.push({ type: 'item', label: p, college: college.name }); 
        });
      }
    });
    return results;
  }, [search]);

  const handleSubmit = async () => {
    if (!db || submitting) return;
    setFormError(null);

    const nameRegex = /^[a-zA-ZÀ-ÿñÑ\s'\-\.]+$/;
    if (firstName.trim().length < 2 || lastName.trim().length < 2 || !nameRegex.test(firstName.trim()) || !nameRegex.test(lastName.trim())) {
      setFormError("Please enter a valid full name (letters only).");
      return;
    }

    if (!studentId.trim()) {
      setFormError('Please enter your Student ID.');
      return;
    }
    const idRegex = /^\d{2}-\d{5}-\d{3}$/;
    if (!idRegex.test(studentId.trim())) {
      setFormError('Invalid ID format. Must be XX-XXXXX-XXX (e.g. 25-12946-343).');
      return;
    }

    if (!selectedCollege) {
      setFormError(`Please select your College.`);
      return;
    }

    setSubmitting(true);
    try {
      const finalStudentId = studentId.trim();

      if (isGoogleSignIn) {
        const emailSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email)));
        if (!emailSnap.empty && emailSnap.docs[0].data().role === 'admin') {
          const adminDoc = emailSnap.docs[0].data();
          sessionStorage.setItem('kiosk_visitor', JSON.stringify({
            studentId: adminDoc.studentId || email,
            fullName: adminDoc.fullName || fullName,
            college: adminDoc.college || '',
            program: adminDoc.program || '',
            email: email,
            loginMethod: 'google',
            role: 'admin'
          }));
          window.location.href = '/kiosk/role-select';
          return;
        }
      }

      const docRef = doc(db, 'users', finalStudentId);
      const existingSnap = await getDoc(docRef);
      const existingData = existingSnap.exists() ? existingSnap.data() : null;
      const safeRole = existingData?.role === 'admin' ? 'admin' : 'visitor';
      
      const userData = {
        studentId: finalStudentId,
        fullName: fullName,
        displayName: fullName,
        college: selectedCollege,
        program: selectedProgram || 'N/A',
        visitorType: 'Student',
        email: email || '',
        role: safeRole,
        updatedAt: Timestamp.now()
      };

      await setDoc(docRef, { ...userData, createdAt: Timestamp.now() }, { merge: true });

      sessionStorage.setItem('kiosk_visitor', JSON.stringify({ 
        ...userData, 
        loginMethod: isGoogleSignIn ? 'google' : 'id' 
      }));

      router.push('/kiosk/purpose');
    } catch (err) {
      logAppError('Registration', 'SaveUser', err);
      setFormError("Registration failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#071a0f] relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_#1a5c2e30_0%,_transparent_55%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#c9a22710_0%,_transparent_50%)] pointer-events-none" />
      <AnnouncementToast />
      <div className="absolute top-16 left-6 z-20">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-[#c9a227] hover:bg-white/10 gap-2 font-bold h-10 rounded-full border border-white/10 text-xs">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 pb-12 overflow-y-auto relative z-10">
        <div className="max-w-[480px] w-full space-y-4">
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-black text-[#c9a227] tracking-tight uppercase leading-none drop-shadow-lg">Profile Setup</h2>
            <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.3em] mt-1">Complete your institutional record</p>
          </div>

          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl ring-1 ring-[#c9a227]/10">
            {isGoogleSignIn && (
              <div className="mb-4 p-3 bg-[#c9a227]/10 border border-[#c9a227]/20 rounded-2xl flex items-center gap-3 backdrop-blur-sm">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <div className="overflow-hidden">
                  <p className="text-[#c9a227] text-[10px] font-black uppercase tracking-widest">Signed in with Google</p>
                  <p className="text-white/60 text-[10px] truncate">{emailFromUrl}</p>
                </div>
              </div>
            )}

            {formError && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center">
                <p className="text-red-200 text-[9px] font-black uppercase tracking-widest">{formError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227]/70 ml-1">
                  Student ID
                </Label>
                <div className="relative">
                  <Input 
                    placeholder="XX-XXXXX-XXX" 
                    className={`h-12 text-sm font-bold bg-white/5 border text-white rounded-2xl px-4 ${idFromUrl ? 'border-[#c9a227]/50 opacity-70 cursor-not-allowed' : 'border-white/10 focus:border-[#c9a227]/60 focus:ring-1 focus:ring-[#c9a227]/30 placeholder:text-white/20'}`} 
                    value={studentId} 
                    onChange={(e) => {
                      if (idFromUrl) return;
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      let formatted = '';
                      if (raw.length <= 2) {
                        formatted = raw;
                      } else if (raw.length <= 7) {
                        formatted = raw.slice(0, 2) + '-' + raw.slice(2);
                      } else {
                        formatted = raw.slice(0, 2) + '-' + raw.slice(2, 7) + '-' + raw.slice(7, 10);
                      }
                      setStudentId(formatted);
                    }}
                    readOnly={!!idFromUrl} 
                    required 
                  />
                  {idFromUrl && <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a227]/50" />}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227]/70 ml-1">Full Name</Label>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      placeholder="First name"
                      className="h-12 text-sm font-bold bg-white/5 border border-white/10 text-white rounded-2xl px-4 focus:border-[#c9a227]/60 focus:outline-none placeholder:text-white/20 w-full"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoCapitalize={nameAutoCapitalize}
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="text-white/30 text-[8px] font-black uppercase text-center tracking-tighter">First</p>
                  </div>
                  <div className="w-[64px] space-y-1">
                    <input
                      type="text"
                      placeholder="MI"
                      className="h-12 text-sm font-bold bg-white/5 border border-white/10 text-white rounded-2xl px-4 focus:border-[#c9a227]/60 focus:outline-none placeholder:text-white/20 text-center w-full"
                      value={middleInitial}
                      maxLength={2}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-ZÀ-ÿñÑ]/g, '');
                        if (val.length <= 2) setMiddleInitial(val.toUpperCase());
                      }}
                      autoCapitalize={nameAutoCapitalize}
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="text-white/30 text-[8px] font-black uppercase text-center tracking-tighter">Middle Initial (optional)</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      placeholder="Last name"
                      className="h-12 text-sm font-bold bg-white/5 border border-white/10 text-white rounded-2xl px-4 focus:border-[#c9a227]/60 focus:outline-none placeholder:text-white/20 w-full"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoCapitalize={nameAutoCapitalize}
                      autoCorrect="off"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="text-white/30 text-[8px] font-black uppercase text-center tracking-tighter">Last</p>
                  </div>
                </div>
                {(firstName || lastName) && (
                  <p className="text-white/40 text-[9px] font-bold text-center italic">
                    Full name: <span className="text-[#c9a227]/70 font-black">{fullName}</span>
                  </p>
                )}
              </div>

              <div className="space-y-1 relative">
                <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227]/70 ml-1">
                  College / Program
                </Label>
                <div className="h-12 flex items-center justify-between px-4 bg-white/5 border border-white/10 text-white rounded-2xl cursor-pointer hover:border-[#c9a227]/60 transition-all" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                  <span className={`font-bold text-xs truncate ${selectedProgram || selectedCollege ? 'text-white' : 'text-white/20'}`}>
                    {selectedProgram || selectedCollege || "Select..."}
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-[#c9a227] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 z-50 mt-1 rounded-2xl overflow-hidden" style={{ background: '#071a0f', border: '1px solid #c9a227', boxShadow: '0 25px 50px rgba(0,0,0,0.9)', maxHeight: '240px', overflowY: 'auto', top: '100%' }}>
                      <div className="sticky top-0 p-2" style={{ background: '#071a0f', borderBottom: '1px solid rgba(201,162,39,0.2)' }}>
                        <input 
                          autoFocus 
                          style={{ background: '#0a2a1a', border: '1px solid rgba(201,162,39,0.3)', color: 'white', padding: '10px 14px', width: '100%', outline: 'none', fontSize: '14px', borderRadius: '12px' }} 
                          placeholder="Search..." 
                          value={search} 
                          onChange={(e) => setSearch(e.target.value)} 
                          onClick={(e) => e.stopPropagation()} 
                        />
                      </div>
                      <div className="py-2">
                        {filteredOptions.map((opt: any, i: number) => (
                          <div key={i}>
                            {opt.type === 'header' ? (
                              <div style={{ padding: '8px 16px 4px', color: '#c9a227', fontSize: '11px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{opt.label}</div>
                            ) : (
                              <div 
                                style={{ padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '13px' }} 
                                className="hover:bg-[#c9a227]/20 transition-colors flex items-center justify-between font-bold" 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setSelectedCollege(opt.college); 
                                  setSelectedProgram(opt.label); 
                                  setIsDropdownOpen(false); 
                                  setSearch(''); 
                                }}
                              >
                                <span className="truncate">{opt.label}</span>
                                {selectedProgram === opt.label && <Check className="h-4 w-4 text-[#c9a227]" />}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <Button 
              className="w-full h-14 text-base font-black rounded-2xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-lg shadow-[#c9a227]/20" 
              disabled={submitting} 
              onClick={handleSubmit}
            >
              {submitting ? <Loader2 className="animate-spin h-6 w-6" /> : "Complete Setup"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (<Suspense fallback={null}><RegisterForm /></Suspense>);
}