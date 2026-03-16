
"use client";

import { useState, Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, limit, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronDown, UserPlus, ArrowLeft, Lock, UserCircle } from 'lucide-react';
import { validateFullName, validateStudentId } from '@/lib/validation';
import { logAppError } from '@/lib/errorMessages';

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

const VISITOR_TYPES = [
  { id: 'Student', label: 'Student' },
  { id: 'Faculty', label: 'Faculty' },
  { id: 'Administrative Staff', label: 'Admin Staff' },
  { id: 'Library Staff', label: 'Library Staff' },
  { id: 'Guest', label: 'Guest' },
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
  const [visitorType, setVisitorType] = useState('Student');
  const [email, setEmail] = useState('');
  
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  
  const method = searchParams.get('method');
  const idFromUrl = searchParams.get('id');
  const emailFromUrl = searchParams.get('email');

  useEffect(() => {
    if (!db) return;
    if (method === 'email' && emailFromUrl) setEmail(emailFromUrl);
    else if (idFromUrl) setStudentId(idFromUrl);
    setLoading(false);
  }, [db, method, idFromUrl, emailFromUrl]);

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

    if (!validateFullName(fullName)) {
      setFormError("Please enter your full name.");
      return;
    }

    if (!validateStudentId(studentId)) {
      setFormError("Invalid Student ID format.");
      return;
    }

    if (!selectedCollege) {
      setFormError("Please select your college/program.");
      return;
    }

    setSubmitting(true);
    try {
      const userId = studentId; 
      const docRef = doc(db, 'users', userId);
      const userData = {
        studentId,
        fullName,
        displayName: fullName,
        college: selectedCollege,
        program: selectedProgram || 'N/A',
        visitorType,
        email: email || '',
        role: 'visitor',
        updatedAt: Timestamp.now()
      };

      const existingSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', studentId), limit(1)));
      if (existingSnap.empty) {
        await setDoc(docRef, { ...userData, createdAt: Timestamp.now(), uid: userId });
      } else {
        await updateDoc(docRef, userData);
      }

      sessionStorage.setItem('kiosk_visitor', JSON.stringify({
        ...userData,
        loginMethod: method === 'email' ? 'email' : 'id'
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
    <div className="h-screen neu-dark-bg flex flex-col items-center justify-center p-6 relative">
      <div className="absolute top-6 left-6">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-[#c9a227] hover:bg-white/10 gap-2 font-bold h-10 rounded-full border border-[#c9a227]/20 text-xs">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="max-w-[480px] w-full space-y-4 z-10 animate-in fade-in zoom-in duration-700">
        <div className="text-center space-y-1">
          <div className="mx-auto bg-[#c9a227]/10 h-14 w-14 rounded-2xl flex items-center justify-center border border-[#c9a227]/20 shadow-xl mb-2">
            <UserPlus className="h-7 w-7 text-[#c9a227]" />
          </div>
          <h2 className="text-2xl font-black text-[#c9a227] tracking-tight uppercase leading-none">Complete Your Profile</h2>
          <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">First time? Let's set up your library profile.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="glass-neu rounded-[2rem] p-8 space-y-6 shadow-2xl border-none">
          {formError && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center">
              <p className="text-red-200 text-[9px] font-black uppercase tracking-widest">{formError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Visitor Type</Label>
              <div className="flex flex-wrap gap-2">
                {VISITOR_TYPES.map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setVisitorType(type.id)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                      visitorType === type.id
                        ? 'bg-[#c9a227] text-[#0a2a1a]'
                        : 'bg-[#0d3d24] text-white/60 border border-[#c9a227]/30 hover:border-[#c9a227]'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {email && (
              <div className="space-y-1">
                <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Institutional Email</Label>
                <div className="relative">
                  <Input value={email} readOnly className="h-12 text-xs font-bold bg-black/40 border-2 border-[#c9a227] text-[#c9a227] rounded-xl px-4 cursor-not-allowed" />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c9a227]/50" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Student ID</Label>
              <Input id="studentId-input" placeholder="XX-XXXXX-XXX" className="h-12 text-base font-mono bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4" value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
            </div>

            <div className="space-y-1">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Full Name</Label>
              <Input id="fullName-input" placeholder="Enter your full name" className="h-12 text-base font-bold bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div className="space-y-1 relative">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">College / Program</Label>
              <div 
                className={`h-12 flex items-center justify-between px-4 bg-black/40 border border-[#c9a227]/20 text-white rounded-xl cursor-pointer hover:border-[#c9a227] transition-all ${isDropdownOpen ? 'ring-2 ring-[#c9a227]/30' : ''}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              >
                <span className={`font-bold text-xs truncate ${selectedProgram || selectedCollege ? 'text-white' : 'text-white/20'}`}>
                  {selectedProgram || selectedCollege || "Search for your program..."}
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-[#c9a227] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl" style={{ background: '#071a0f', border: '1px solid #c9a227', maxHeight: '280px', overflowY: 'auto' }}>
                  <div className="sticky top-0 p-0">
                    <input autoFocus className="w-full bg-[#0a2a1a] border-none border-b border-[#c9a227] text-white p-3 text-sm outline-none" placeholder="Type to search..." value={search} onChange={(e) => setSearch(e.target.value)} onClick={(e) => e.stopPropagation()} />
                  </div>
                  {filteredOptions.map((opt, i) => (
                    <div key={i}>
                      {opt.type === 'header' ? (
                        <div className="p-3 text-[9px] font-black text-[#c9a227] uppercase tracking-widest bg-[#071a0f] border-t border-[#c9a227]/10">{opt.label}</div>
                      ) : (
                        <div 
                          className={`p-3 text-sm font-medium text-white cursor-pointer hover:bg-[#0d3d24] transition-colors flex items-center justify-between ${selectedProgram === opt.label ? 'border-l-4 border-[#c9a227]' : ''}`}
                          onClick={(e) => { e.stopPropagation(); setSelectedCollege(opt.college); setSelectedProgram(opt.label); setIsDropdownOpen(false); setSearch(''); }}
                        >
                          <span className="truncate">{opt.label}</span>
                          {selectedProgram === opt.label && <Check className="h-4 w-4 text-[#c9a227]" />}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button className="w-full h-14 text-lg font-black rounded-xl bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 shadow-lg" disabled={submitting} type="submit">
            {submitting ? <Loader2 className="animate-spin h-6 w-6" /> : "Register Profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
