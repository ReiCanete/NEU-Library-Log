
"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Search, Trash2, FileText, Calendar, History, ArrowRight, Mail, CreditCard, Filter, Loader2, UserCircle, X, ShieldOff, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, Timestamp, where, getDocs, addDoc, limit } from 'firebase/firestore';
import { format, isSameDay } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPE_COLORS: Record<string, string> = {
  'Student': 'bg-blue-50 text-blue-700 border-blue-200',
  'Faculty': 'bg-purple-50 text-purple-700 border-purple-200',
  'Administrative Staff': 'bg-orange-50 text-orange-700 border-orange-200',
  'Library Staff': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Guest': 'bg-slate-50 text-slate-700 border-slate-200',
};

const VisitHistory = ({ studentId, currentVisitId }: { studentId: string, currentVisitId: string }) => {
  const db = useFirestore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!db || !studentId) return;
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'visits'),
          where('studentId', '==', studentId),
          orderBy('timestamp', 'desc'),
          limit(10)
        );
        const snap = await getDocs(q);
        setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("[NEU Library Log Error] [VisitHistory]:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [db, studentId]);
  
  if (loading) return <div className="flex items-center gap-2 py-4"><Loader2 className="h-4 w-4 animate-spin text-[#c9a227]" /> <span className="text-xs text-gray-400">Loading history...</span></div>;
  if (history.length === 0) return <p className="text-sm text-gray-400 py-4">No previous visits found.</p>;
  
  return (
    <div className="space-y-2 mt-2">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{history.length} total recorded visit{history.length !== 1 ? 's' : ''}</p>
      <div className="space-y-2">
        {history.map(visit => (
          <div key={visit.id} className={`text-sm p-3 rounded-xl transition-all ${visit.id === currentVisitId ? 'bg-[#c9a227]/10 border border-[#c9a227]/30 ring-1 ring-[#c9a227]/20' : 'bg-white border border-gray-100'}`}>
            <div className="flex justify-between items-start">
              <span className="font-bold text-[#1a3a2a] text-xs">{visit.purpose}</span>
              <span className="text-[9px] font-black text-gray-400 uppercase">
                {format(visit.timestamp?.toDate(), 'MMM dd')}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-[9px] text-gray-400">{format(visit.timestamp?.toDate(), 'p')}</span>
              {visit.id === currentVisitId && (
                <span className="text-[9px] text-[#c9a227] font-black uppercase tracking-tighter">Selected Visit</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default function VisitorLogs() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const visitsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'visits'), orderBy('timestamp', 'desc'));
  }, [db]);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  const blocklistQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'blocklist'));
  }, [db]);
  const { data: blocklist } = useCollection(blocklistQuery);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const matchesSearch = v.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           v.studentId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      const matchesCollege = collegeFilter === 'all' || v.college === collegeFilter;
      const matchesDate = !dateFilter || isSameDay(v.timestamp.toDate(), new Date(dateFilter));
      
      let matchesType = typeFilter === 'all';
      if (typeFilter === 'employee') {
        matchesType = ['Faculty', 'Administrative Staff', 'Library Staff'].includes(v.visitorType);
      } else if (typeFilter !== 'all') {
        matchesType = v.visitorType === typeFilter;
      }
      
      return matchesSearch && matchesPurpose && matchesCollege && matchesType && matchesDate;
    });
  }, [allVisits, searchTerm, purposeFilter, collegeFilter, typeFilter, dateFilter]);

  const paginatedVisits = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredVisits.slice(start, start + itemsPerPage);
  }, [filteredVisits, currentPage]);

  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);

  const isBlocked = (studentId: string) => blocklist?.some(b => b.studentId === studentId);

  const handleRowClick = (visit: any) => {
    setSelectedVisit(visit);
    setSidePanelOpen(true);
  };

  const handleBlockFromPanel = async () => {
    if (!selectedVisit || !db) return;
    setIsProcessing(true);
    try {
      await addDoc(collection(db, 'blocklist'), {
        studentId: selectedVisit.studentId,
        fullName: selectedVisit.fullName,
        college: selectedVisit.college || '',
        program: selectedVisit.program || '',
        reason: 'Restricted from visitor detail panel',
        blockedBy: auth?.currentUser?.email || 'Staff',
        blockedAt: Timestamp.now()
      });
      toast({ title: "Access Restricted", description: `${selectedVisit.fullName} is now blocked.` });
      setSidePanelOpen(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnblockUser = async (studentId: string) => {
    if (!db) return;
    setIsProcessing(true);
    try {
      const q = query(collection(db, 'blocklist'), where('studentId', '==', studentId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await deleteDoc(doc(db, 'blocklist', snap.docs[0].id));
        toast({ title: "Access Restored", description: "Restriction removed." });
      }
    } catch (e: any) {
      toast({ title: "Action Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-[#1a3a2a]">Visitor Activity Logs</h2>
          <p className="text-xs tracking-widest text-[#4a6741] uppercase mt-1">Institutional Activity Archive</p>
        </div>

        <Card className="rounded-2xl border-[#d4e4d8] shadow-sm bg-white p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                <Input placeholder="Name or ID..." className="h-11 pl-10 rounded-xl bg-[#f0f4f1] border-none font-medium" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Visitor Type</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold text-xs">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Student">Student</SelectItem>
                  <SelectItem value="Faculty">Faculty</SelectItem>
                  <SelectItem value="Administrative Staff">Admin Staff</SelectItem>
                  <SelectItem value="Library Staff">Library Staff</SelectItem>
                  <SelectItem value="Guest">Guest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Purpose</Label>
              <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                <SelectTrigger className="h-11 rounded-xl bg-[#f0f4f1] border-none font-bold text-xs">
                  <SelectValue placeholder="All Activities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="Reading Books">Reading Books</SelectItem>
                  <SelectItem value="Research / Study">Research / Study</SelectItem>
                  <SelectItem value="Computer / Internet">Computer / Internet</SelectItem>
                  <SelectItem value="Group Discussion">Group Discussion</SelectItem>
                  <SelectItem value="Thesis / Archival">Thesis / Archival</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-[#4a6741]">Date</Label>
              <Input type="date" className="h-11 px-4 rounded-xl bg-[#f0f4f1] border-none font-medium" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-[#d4e4d8] shadow-sm bg-white overflow-hidden">
          <Table>
            <TableHeader className="bg-[#1a3a2a]">
              <TableRow className="border-none hover:bg-[#1a3a2a]">
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold h-12 px-6">ID</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Full Name</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold text-center">Type</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Purpose</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold">Time</TableHead>
                <TableHead className="text-white text-[10px] tracking-widest uppercase font-bold text-right px-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitsLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6} className="px-6 py-4"><Skeleton className="h-10 w-full rounded-lg" /></TableCell></TableRow>
                ))
              ) : paginatedVisits.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-96 text-center text-slate-400 font-medium">No activity records found.</TableCell></TableRow>
              ) : paginatedVisits.map((v) => (
                <TableRow 
                  key={v.id} 
                  onClick={() => handleRowClick(v)}
                  className="cursor-pointer group hover:bg-[#f0f7f2] border-b-[#f0f4f1] transition-colors even:bg-[#f7faf8]"
                >
                  <TableCell className="px-6 font-mono text-xs font-semibold text-[#1a3a2a]">{v.studentId}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-[#1a3a2a]">{v.fullName}</span>
                      {v.email && <span className="text-[9px] text-[#c9a227] font-bold flex items-center gap-1"><Mail className="h-2.5 w-2.5" /> {v.email}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`${TYPE_COLORS[v.visitorType || 'Student']} text-[8px] font-black uppercase px-2 py-0.5 border`}>
                      {v.visitorType || 'Student'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-white text-[#1a3a2a] text-[9px] font-bold px-3 py-1 rounded-full border border-[#d4e4d8] uppercase">
                      {v.purpose}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500 font-medium text-[10px] tabular-nums">
                    {format(v.timestamp.toDate(), 'MMM dd, hh:mm a')}
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    {isBlocked(v.studentId) ? (
                      <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 text-[8px] font-black uppercase">Blocked</Badge>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-black uppercase">Active</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="p-6 bg-[#f7faf8] flex justify-between items-center border-t border-[#d4e4d8]">
            <p className="text-[10px] font-bold text-[#4a6741] uppercase tracking-widest">Page {currentPage} of {totalPages}</p>
            <div className="flex gap-2">
              <Button variant="outline" disabled={currentPage === 1} onClick={(e) => { e.stopPropagation(); setCurrentPage(p => p - 1); }} className="rounded-lg h-9 px-4 font-bold border-[#d4e4d8]">Prev</Button>
              <Button variant="outline" disabled={currentPage >= totalPages} onClick={(e) => { e.stopPropagation(); setCurrentPage(p => p + 1); }} className="rounded-lg h-9 px-4 font-bold border-[#d4e4d8]">Next</Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Side Detail Panel */}
      <div className={`fixed right-0 top-0 h-full w-full md:w-[420px] bg-white shadow-[0_0_50px_rgba(0,0,0,0.2)] z-[100] transform transition-transform duration-300 ease-out flex flex-col ${sidePanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedVisit && (
          <>
            <div className="bg-[#1a3a2a] p-6 flex items-center justify-between text-white shrink-0">
              <div className="flex items-center gap-3">
                <UserCircle className="h-5 w-5 text-[#c9a227]" />
                <h2 className="font-black uppercase tracking-widest text-sm">Visitor Details</h2>
              </div>
              <button onClick={() => setSidePanelOpen(false)} className="h-8 w-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
              {/* Profile Header */}
              <div className="flex flex-col items-center text-center gap-4 py-4">
                <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-[#1a3a2a] to-[#0a2a1a] flex items-center justify-center shadow-xl relative group">
                  <span className="text-[#c9a227] text-4xl font-black">
                    {selectedVisit.fullName?.charAt(0).toUpperCase()}
                  </span>
                  <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-lg border border-gray-100">
                    <Badge className={`${TYPE_COLORS[selectedVisit.visitorType || 'Student']} text-[8px] font-black uppercase px-2 py-0.5 border`}>
                      {selectedVisit.visitorType || 'Student'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[#1a3a2a] tracking-tight">{selectedVisit.fullName}</h3>
                  <p className="text-xs font-mono font-bold text-[#c9a227] mt-1">{selectedVisit.studentId}</p>
                </div>
              </div>

              {/* Data Cards */}
              <div className="space-y-4">
                <div className="bg-[#f0f7f2] rounded-2xl p-5 border border-[#d4e4d8]/30">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">Entry Metadata</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Purpose</p>
                      <p className="text-xs font-bold text-[#1a3a2a]">{selectedVisit.purpose}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Method</p>
                      <p className="text-xs font-bold text-[#1a3a2a]">{selectedVisit.loginMethod === 'email' ? 'Institutional Email' : 'School ID Card'}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-gray-100">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">College / Department</p>
                      <p className="text-xs font-bold text-[#1a3a2a]">{selectedVisit.college || 'Not Specified'}</p>
                    </div>
                    {selectedVisit.program && (
                      <div className="col-span-2">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Degree Program</p>
                        <p className="text-xs font-bold text-[#1a3a2a]">{selectedVisit.program}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-[#f0f7f2] rounded-2xl p-5 border border-[#d4e4d8]/30">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">Visit Timeline</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Date</p>
                      <p className="text-xs font-bold text-[#1a3a2a]">{format(selectedVisit.timestamp?.toDate(), 'MMMM dd, yyyy')}</p>
                    </div>
                    <div className="space-y-1 text-right">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Time</p>
                      <p className="text-xs font-bold text-[#1a3a2a] tabular-nums">{format(selectedVisit.timestamp?.toDate(), 'p')}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-[#f0f7f2] rounded-2xl p-5 border border-[#d4e4d8]/30">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="h-4 w-4 text-[#c9a227]" />
                    <span className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">Visitor History</span>
                  </div>
                  <VisitHistory studentId={selectedVisit.studentId} currentVisitId={selectedVisit.id} />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 space-y-3">
                {isBlocked(selectedVisit.studentId) ? (
                  <Button
                    onClick={() => handleUnblockUser(selectedVisit.studentId)}
                    disabled={isProcessing}
                    className="w-full h-12 bg-emerald-600 text-white font-black uppercase text-xs rounded-xl shadow-lg hover:bg-emerald-700"
                  >
                    Restore Access
                  </Button>
                ) : (
                  <Button
                    onClick={handleBlockFromPanel}
                    disabled={isProcessing}
                    className="w-full h-12 bg-red-600 text-white font-black uppercase text-xs rounded-xl shadow-lg hover:bg-red-700 flex gap-2"
                  >
                    <ShieldOff className="h-4 w-4" />
                    Block This Visitor
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Overlay */}
      {sidePanelOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[90] animate-in fade-in duration-300"
          onClick={() => setSidePanelOpen(false)}
        />
      )}
    </AdminLayout>
  );
}

