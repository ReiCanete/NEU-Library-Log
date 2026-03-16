"use client";

import { useState, Suspense, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, updateDoc, limit, Timestamp, addDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Check, ChevronDown, UserPlus, ArrowLeft, Lock, UserCircle, Briefcase, User, GraduationCap } from 'lucide-react';
import { validateFullName } from '@/lib/validation';
import { logAppError } from '@/lib/errorMessages';
import AnnouncementTicker from '@/components/kiosk/AnnouncementTicker';

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

const VISITOR_TYPES = [
  { id: 'Student', label: 'Student', icon: GraduationCap },
  { id: 'Faculty', label: 'Faculty', icon: Briefcase },
  { id: 'Administrative Staff', label: 'Admin', icon: UserCircle },
  { id: 'Library Staff', label: 'Library', icon: Briefcase },
  { id: 'Guest', label: 'Guest', icon: User },
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
  const [visitorType, setVisitorType] = useState('Student');
  const [email, setEmail] = useState('');
  
  const [search, setSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  const method = searchParams.get('method');
  const idFromUrl = searchParams.get('id');
  const emailFromUrl = searchParams.get('email');

  useEffect(() => {
    if (!db) return;
    if (method === 'email' && emailFromUrl) setEmail(emailFromUrl);
    else if (idFromUrl) setStudentId(idFromUrl);
    setLoading(false);
  }, [db, method, idFromUrl, emailFromUrl]);

  // Transition handling when visitor type changes
  useEffect(() => {
    setSelectedCollege('');
    setSelectedProgram('');
    setDepartment('');
    if (visitorType === 'Guest') {
      setStudentId('');
    }
  }, [visitorType]);

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

    // Dynamic Validation
    if (!validateFullName(fullName)) {
      setFormError("Please enter your full name.");
      return;
    }

    if (visitorType !== 'Guest') {
      if (!studentId.trim()) {
        setFormError(visitorType === 'Student' ? "Student ID is required." : "Employee ID is required.");
        return;
      }
    }

    if (visitorType === 'Student' && !selectedCollege) {
      setFormError("Please select your college and program.");
      return;
    }

    if (visitorType === 'Faculty' && !selectedCollege) {
      setFormError("Please select your department.");
      return;
    }

    if (['Administrative Staff', 'Library Staff'].includes(visitorType) && !department.trim()) {
      setFormError("Please enter your office/department.");
      return;
    }

    setSubmitting(true);
    try {
      const finalStudentId = visitorType === 'Guest' ? `GUEST-${Date.now()}` : studentId;
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

      // For non-guests, we save/update the user profile
      if (visitorType !== 'Guest') {
        const existingSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', finalStudentId), limit(1)));
        if (existingSnap.empty) {
          await setDoc(docRef, { ...userData, createdAt: Timestamp.now(), uid: finalStudentId });
        } else {
          await updateDoc(docRef, userData);
        }
      }

      const visitorSession = {
        ...userData,
        loginMethod: method === 'email' ? 'email' : 'id'
      };
      sessionStorage.setItem('kiosk_visitor', JSON.stringify(visitorSession));
      
      // Guest skip purpose
      if (visitorType === 'Guest') {
        await addDoc(collection(db, 'visits'), {
          ...userData,
          purpose: 'General Visit / Library Tour',
          loginMethod: 'id',
          timestamp: Timestamp.now(),
        });
        router.push('/kiosk/welcome');
      } else {
        router.push('/kiosk/purpose');
      }
    } catch (err) {
      logAppError('Registration', 'SaveUser', err);
      setFormError("Registration failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#0a2a1a] to-[#0d3d24]">
      <AnnouncementTicker />

      <div className="absolute top-16 left-6">
        <Button variant="ghost" onClick={() => router.push('/')} className="text-[#c9a227] hover:bg-white/10 gap-2 font-bold h-10 rounded-full border border-[#c9a227]/20 text-xs">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-700">
        <div className="max-w-[480px] w-full space-y-4">
          <div className="text-center space-y-1">
            <div className="mx-auto bg-[#c9a227]/10 h-14 w-14 rounded-2xl flex items-center justify-center border border-[#c9a227]/20 shadow-xl mb-2">
              <UserPlus className="h-7 w-7 text-[#c9a227]" />
            </div>
            <h2 className="text-2xl font-black text-[#c9a227] tracking-tight uppercase leading-none">Complete Your Profile</h2>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-widest">First time? Let's set up your library profile.</p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="glass-neu rounded-[2rem] p-8 space-y-6 shadow-2xl border-none">
            {formError && (
              <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl text-center animate-in slide-in-from-top-1">
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
                      className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                        visitorType === type.id
                          ? 'bg-[#c9a227] text-[#0a2a1a]'
                          : 'bg-[#0d3d24] text-white/60 border border-[#c9a227]/30 hover:border-[#c9a227]'
                      }`}
                    >
                      <type.icon className="h-3 w-3" />
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 animate-in fade-in duration-500">
                {email && (
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Institutional Email</Label>
                    <div className="relative">
                      <Input value={email} readOnly className="h-12 text-xs font-bold bg-black/40 border-2 border-[#c9a227] text-[#c9a227] rounded-xl px-4 cursor-not-allowed" />
                      <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#c9a227]/50" />
                    </div>
                  </div>
                )}

                {visitorType !== 'Guest' && (
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">
                      {visitorType === 'Student' ? 'Student ID' : 'Employee ID'}
                    </Label>
                    <div className="relative">
                      <Input 
                        id="studentId-input"
                        placeholder={visitorType === 'Student' ? "XX-XXXXX-XXX" : "EMP-2024-XXX"} 
                        className={`h-12 text-base font-mono bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4 ${idFromUrl ? 'border-[#c9a227]/50 opacity-70 cursor-not-allowed' : ''}`} 
                        value={studentId} 
                        onChange={(e) => !idFromUrl && setStudentId(e.target.value)} 
                        readOnly={!!idFromUrl}
                        required 
                      />
                      {idFromUrl && (
                        <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#c9a227]/50" />
                      )}
                    </div>
                    {idFromUrl && (
                      <p className="text-[9px] text-white/40 mt-1 font-black uppercase tracking-widest">ID carried over from entry screen</p>
                    )}
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Full Name</Label>
                  <Input 
                    id="fullName-input"
                    placeholder="Enter your full name" 
                    className="h-12 text-base font-bold bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    required 
                  />
                </div>

                {(visitorType === 'Student' || visitorType === 'Faculty') && (
                  <div className="space-y-1 relative">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">
                      {visitorType === 'Student' ? 'College / Program' : 'Department'}
                    </Label>
                    <div 
                      className={`h-12 flex items-center justify-between px-4 bg-black/40 border border-[#c9a227]/20 text-white rounded-xl cursor-pointer hover:border-[#c9a227] transition-all ${isDropdownOpen ? 'ring-2 ring-[#c9a227]/30' : ''}`}
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <span className={`font-bold text-xs truncate ${selectedProgram || selectedCollege ? 'text-white' : 'text-white/20'}`}>
                        {selectedProgram || selectedCollege || (visitorType === 'Student' ? "Search for your program..." : "Select your department...")}
                      </span>
                      <ChevronDown className={`h-4 w-4 shrink-0 text-[#c9a227] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </div>

                    {isDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-2xl" 
                           style={{ background: '#071a0f', border: '1px solid #c9a227', boxShadow: '0 25px 50px rgba(0,0,0,0.9)', maxHeight: '280px', overflowY: 'auto' }}>
                        <div className="sticky top-0 p-0">
                          <input 
                            autoFocus 
                            style={{ background: '#0a2a1a', border: 'none', borderBottom: '1px solid rgba(201, 162, 39, 0.2)', color: 'white', padding: '12px 16px', width: '100%', outline: 'none', fontSize: '14px' }}
                            placeholder="Type to search..." 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)} 
                            onClick={(e) => e.stopPropagation()} 
                          />
                        </div>
                        {filteredOptions.map((opt: any, i: number) => (
                          <div key={i}>
                            {opt.type === 'header' ? (
                              <div style={{ padding: '8px 16px 4px', color: '#c9a227', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', background: '#071a0f', borderTop: '1px solid rgba(201, 162, 39, 0.1)' }}>{opt.label}</div>
                            ) : (
                              <div 
                                style={{ padding: '10px 16px', color: 'white', cursor: 'pointer', fontSize: '14px', borderLeft: (selectedProgram === opt.label || (visitorType === 'Faculty' && selectedCollege === opt.label)) ? '3px solid #c9a227' : '3px solid transparent', background: 'transparent' }}
                                className="hover:bg-[#0d3d24] transition-colors flex items-center justify-between"
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  setSelectedCollege(opt.college); 
                                  if (visitorType === 'Student') setSelectedProgram(opt.label);
                                  setIsDropdownOpen(false); 
                                  setSearch(''); 
                                }}
                              >
                                <span className="truncate">{opt.label}</span>
                                {(selectedProgram === opt.label || (visitorType === 'Faculty' && selectedCollege === opt.label)) && <Check className="h-4 w-4 text-[#c9a227]" />}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {['Administrative Staff', 'Library Staff'].includes(visitorType) && (
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-[#c9a227] ml-1">Office / Department</Label>
                    <Input 
                      id="department-input"
                      placeholder="Enter your specific office" 
                      className="h-12 text-base font-bold bg-black/40 border-[#c9a227]/20 text-white rounded-xl px-4" 
                      value={department} 
                      onChange={(e) => setDepartment(e.target.value)} 
                      required 
                    />
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