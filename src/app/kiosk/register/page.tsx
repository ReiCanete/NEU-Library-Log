"use client";

import { useState, Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, limit, Timestamp, addDoc } from 'firebase/firestore';
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

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const db = useFirestore();
  
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedCollege, setSelectedCollege] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const method = searchParams.get('method');
  const idFromUrl = searchParams.get('id');
  const emailFromUrl = searchParams.get('email');
  const visitorType = searchParams.get('type') || 'Student';

  useEffect(() => {
    if (!db) return;
    if (method === 'email' && emailFromUrl) setEmail(emailFromUrl);
    else if (idFromUrl) setStudentId(idFromUrl);
    
    if (visitorType === 'Guest' && !idFromUrl) {
      setStudentId(`GUEST-${Date.now()}`);
    }
    setLoading(false);
  }, [db, method, idFromUrl, emailFromUrl, visitorType]);

  const filteredOptions = useMemo(() => {
    const term = search.toLowerCase();
    if (visitorType === 'Faculty') {
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
    setSubmitting(true);
    try {
      const finalStudentId = visitorType === 'Guest' && !idFromUrl ? `GUEST-${Date.now()}` : studentId;
      const docRef = doc(db, 'users', finalStudentId);
      const userData = {
        studentId: finalStudentId,
        fullName,
        displayName: fullName,
        college: ['Administrative Staff', 'Library Staff'].includes(visitorType) ? department : selectedCollege,
        program: visitorType === 'Student' ? (selectedProgram || 'N/A') : '',
        visitorType,
        email: email || '',
        role: 'visitor',
        updatedAt: Timestamp.now()
      };

      if (visitorType !== 'Guest') {
        const existingSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', finalStudentId), limit(1)));
        if (existingSnap.empty) {
          await setDoc(docRef, { ...userData, createdAt: Timestamp.now(), uid: finalStudentId });
        } else {
          await updateDoc(docRef, userData);
        }
      }

      sessionStorage.setItem('kiosk_visitor', JSON.stringify({ ...userData, loginMethod: method === 'email' ? 'email' : 'id' }));
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
            <div className="flex flex-col items-center gap-1 mb-2">
              <span className="text-[10px] font-black text-[#c9a227] uppercase tracking-widest">Step 1 of 2</span>
              <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="w-1/2 h-full bg-[#c9a227]" />
              </div>
            </div>
            <h2 className="text-2xl font-black text-[#c9a227] tracking-tight uppercase leading-none">Profile Setup</h2>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">{visitorType} Registration</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="glass-neu rounded-[2rem] p-8 space-y-6 shadow-2xl border-none">
            {formError && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center">
                <p className="text-red-200 text-[9px] font-black uppercase tracking-widest">{formError}</p>
              </div>
            )}
            <div className="space-y-4">
              {email && (
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Official Email</Label>
                  <div className="relative"><Input value={email} readOnly className="h-12 text-xs font-bold bg-black/40 border-2 border-[#c9a227] text-[#c9a227] rounded-xl px-4 cursor-not-allowed" /><Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c9a227]/50" /></div>
                </div>
              )}
              {visitorType !== 'Guest' && (
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">{visitorType === 'Student' ? 'Student ID' : 'Employee ID'}</Label>
                  <div className="relative">
                    <Input placeholder={visitorType === 'Student' ? "XX-XXXXX-XXX" : "EMP-XXX"} className={`h-12 text-base font-mono bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4 ${idFromUrl ? 'border-[#c9a227]/50 opacity-70 cursor-not-allowed' : ''}`} value={studentId} onChange={(e) => !idFromUrl && setStudentId(e.target.value)} readOnly={!!idFromUrl} required />
                    {idFromUrl && <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a227]/50" />}
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Full Name</Label>
                <Input placeholder="Enter your full name" className="h-12 text-base font-bold bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              {(visitorType === 'Student' || visitorType === 'Faculty') && (
                <div className="space-y-1 relative">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">{visitorType === 'Student' ? 'College / Program' : 'Department'}</Label>
                  <div className="h-12 flex items-center justify-between px-4 bg-black/40 border border-[#c9a227]/20 text-white rounded-xl cursor-pointer hover:border-[#c9a227] transition-all" onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                    <span className={`font-bold text-xs truncate ${selectedProgram || selectedCollege ? 'text-white' : 'text-white/20'}`}>{selectedProgram || selectedCollege || "Select..."}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[#c9a227] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {isDropdownOpen && (
                    <><div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                    <div className="absolute left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden" style={{ background: '#071a0f', border: '1px solid #c9a227', boxShadow: '0 25px 50px rgba(0,0,0,0.9)', maxHeight: '240px', overflowY: 'auto', top: '100%' }}>
                      <div className="sticky top-0 p-2" style={{ background: '#071a0f', borderBottom: '1px solid rgba(201,162,39,0.2)' }}><input autoFocus style={{ background: '#0a2a1a', border: '1px solid rgba(201,162,39,0.3)', color: 'white', padding: '10px 14px', width: '100%', outline: 'none', fontSize: '14px', borderRadius: '8px' }} placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} /></div>
                      <div className="py-2">{filteredOptions.map((opt: any, i: number) => (<div key={i}>{opt.type === 'header' ? <div style={{ padding: '8px 16px 4px', color: '#c9a227', fontSize: '11px', fontWeight: '800', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{opt.label}</div> : <div style={{ padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '13px' }} className="hover:bg-[#c9a227]/20 transition-colors flex items-center justify-between font-bold" onClick={(e) => { e.stopPropagation(); setSelectedCollege(opt.college); if (visitorType === 'Student') setSelectedProgram(opt.label); setIsDropdownOpen(false); setSearch(''); }}><span className="truncate">{opt.label}</span>{(selectedProgram === opt.label || (visitorType === 'Faculty' && selectedCollege === opt.label)) && <Check className="h-4 w-4 text-[#c9a227]" />}</div>}</div>))}</div>
                    </div></>
                  )}
                </div>
              )}
            </div>
            <Button className="w-full h-14 text-lg font-black rounded-xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-lg" disabled={submitting} type="submit">{submitting ? <Loader2 className="animate-spin h-6 w-6" /> : "Complete Setup"}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (<Suspense fallback={null}><RegisterForm /></Suspense>);
}
