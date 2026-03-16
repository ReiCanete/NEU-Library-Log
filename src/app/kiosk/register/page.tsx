"use client";

import { useState, Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, limit, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronDown, UserPlus, ArrowLeft, Lock } from 'lucide-react';
import { validateFullName } from '@/lib/validation';
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

const FACULTY_DEPARTMENTS = [
  'College of Accountancy',
  'College of Agriculture', 
  'College of Arts and Sciences',
  'College of Business Administration',
  'College of Communication',
  'College of Informatics and Computing Studies',
  'College of Criminology',
  'College of Education',
  'College of Engineering and Architecture',
  'College of Medical Technology',
  'College of Midwifery',
  'College of Music',
  'College of Nursing',
  'College of Physical Therapy',
  'College of Respiratory Therapy',
  'School of International Relations',
  'Office of the President',
  'Office of the Registrar',
  'Finance Department',
  'Human Resources',
  'IT Department',
  'Library Department',
  'Security Office',
  'Maintenance Department',
];

const VISITOR_TYPES = ['Student', 'Faculty', 'Administrative Staff', 'Library Staff', 'Guest'];

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
  
  const [visitorType, setVisitorType] = useState(searchParams.get('type') || 'Student');
  const [fullName, setFullName] = useState(nameFromUrl);
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

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase();
    if (visitorType === 'Faculty' || visitorType === 'Administrative Staff' || visitorType === 'Library Staff') {
      return FACULTY_DEPARTMENTS
        .filter(d => d.toLowerCase().includes(term))
        .map(d => ({ type: 'item', label: d, college: d }));
    }
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
  }, [search, visitorType]);

  const handleSubmit = async () => {
    if (!db || submitting) return;
    setFormError(null);

    if (!validateFullName(fullName)) {
      setFormError("Please enter your full name.");
      return;
    }

    if (visitorType !== 'Guest' && !studentId.trim()) {
      setFormError(`Please enter your ${visitorType === 'Student' ? 'Student' : 'Employee'} ID.`);
      return;
    }

    if (visitorType !== 'Guest' && !selectedCollege) {
      setFormError(`Please select your ${visitorType === 'Student' ? 'College' : 'Department'}.`);
      return;
    }

    setSubmitting(true);
    try {
      const guestId = `GUEST-${Date.now()}`;
      const finalStudentId = visitorType === 'Guest' ? guestId : studentId.trim();
      
      const userData = {
        studentId: finalStudentId,
        fullName: fullName.trim(),
        displayName: fullName.trim(),
        college: selectedCollege,
        program: visitorType === 'Student' ? (selectedProgram || 'N/A') : '',
        visitorType,
        email: email || '',
        role: 'visitor',
        updatedAt: Timestamp.now()
      };

      // Save to Firestore users collection (skip for guests to avoid clutter, or save as transient)
      if (visitorType !== 'Guest') {
        const docRef = doc(db, 'users', finalStudentId);
        await setDoc(docRef, { ...userData, createdAt: Timestamp.now() }, { merge: true });
      }

      // Save to session storage for the immediate flow
      sessionStorage.setItem('kiosk_visitor', JSON.stringify({ 
        ...userData, 
        loginMethod: isGoogleSignIn ? 'google' : (method === 'email' ? 'email' : 'id') 
      }));

      // Navigate based on type
      router.push(visitorType === 'Guest' ? '/kiosk/welcome' : '/kiosk/purpose');
    } catch (err) {
      logAppError('Registration', 'SaveUser', err);
      setFormError("Registration failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24] overflow-hidden">
      <AnnouncementToast />
      <div className="absolute top-16 left-6">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-[#c9a227] hover:bg-white/10 gap-2 font-bold h-10 rounded-full border border-[#c9a227]/20 text-xs">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto">
        <div className="max-w-[480px] w-full space-y-4">
          <div className="text-center space-y-3">
            <h2 className="text-2xl font-black text-[#c9a227] tracking-tight uppercase leading-none">Profile Setup</h2>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">Complete your institutional record</p>
          </div>

          <div className="glass-neu rounded-[2rem] p-8 space-y-6 shadow-2xl border-none">
            {isGoogleSignIn && (
              <div className="mb-4 p-3 bg-[#c9a227]/10 border border-[#c9a227]/30 rounded-xl flex items-center gap-3">
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
              {/* Visitor Type Selector */}
              <div className="space-y-2">
                <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Visitor Type</Label>
                <div className="flex flex-wrap gap-1.5">
                  {VISITOR_TYPES.map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setVisitorType(type);
                        setSelectedCollege('');
                        setSelectedProgram('');
                        setFormError(null);
                      }}
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                        visitorType === type
                          ? 'bg-[#c9a227] text-[#0a2a1a]'
                          : 'bg-black/40 text-white/50 border border-[#c9a227]/20 hover:border-[#c9a227]/60'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic ID Field */}
              {visitorType !== 'Guest' && (
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">
                    {visitorType === 'Student' ? 'Student ID' : 'Employee ID'}
                  </Label>
                  <div className="relative">
                    <Input 
                      placeholder={visitorType === 'Student' ? "XX-XXXXX-XXX" : "EMP-XXX"} 
                      className={`h-12 text-base font-mono bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4 ${idFromUrl ? 'border-[#c9a227]/50 opacity-70 cursor-not-allowed' : ''}`} 
                      value={studentId} 
                      onChange={(e) => !idFromUrl && setStudentId(e.target.value)} 
                      readOnly={!!idFromUrl} 
                      required 
                    />
                    {idFromUrl && <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a227]/50" />}
                  </div>
                </div>
              )}

              {/* Name Field */}
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Full Name</Label>
                <Input placeholder="Enter your full name" className="h-12 text-base font-bold bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>

              {/* Dynamic Department/College Field */}
              {visitorType !== 'Guest' && (
                <div className="space-y-1 relative">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">
                    {visitorType === 'Student' ? 'College / Program' : 'Department / Office'}
                  </Label>
                  <div className="h-12 flex items-center justify-between px-4 bg-black/40 border border-[#c9a227]/20 text-white rounded-xl cursor-pointer hover:border-[#c9a227] transition-all" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                    <span className={`font-bold text-xs truncate ${selectedProgram || selectedCollege ? 'text-white' : 'text-white/20'}`}>
                      {selectedProgram || selectedCollege || "Select..."}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[#c9a227] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {isDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                      <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden" style={{ background: '#071a0f', border: '1px solid #c9a227', boxShadow: '0 25px 50px rgba(0,0,0,0.9)', maxHeight: '240px', overflowY: 'auto', top: '100%' }}>
                        <div className="sticky top-0 p-2" style={{ background: '#071a0f', borderBottom: '1px solid rgba(201,162,39,0.2)' }}>
                          <input 
                            autoFocus 
                            style={{ background: '#0a2a1a', border: '1px solid rgba(201,162,39,0.3)', color: 'white', padding: '10px 14px', width: '100%', outline: 'none', fontSize: '14px', borderRadius: '8px' }} 
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
                                    if (visitorType === 'Student') setSelectedProgram(opt.label); 
                                    setIsDropdownOpen(false); 
                                    setSearch(''); 
                                  }}
                                >
                                  <span className="truncate">{opt.label}</span>
                                  {(selectedProgram === opt.label || (visitorType !== 'Student' && selectedCollege === opt.label)) && <Check className="h-4 w-4 text-[#c9a227]" />}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <Button 
              className="w-full h-14 text-lg font-black rounded-xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-lg" 
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
