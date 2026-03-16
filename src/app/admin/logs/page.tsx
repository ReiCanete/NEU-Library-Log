'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Search, Filter, Loader2, UserCircle, X, ShieldOff, Clock, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, where, getDocs, addDoc, Timestamp } from 'firebase/firestore';
import { format, isSameDay } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';
import { usePathname } from 'next/navigation';

const TYPE_STYLES: Record<string, string> = {
  'Student': 'bg-blue-50 text-blue-700 border-blue-200',
  'Faculty': 'bg-purple-50 text-purple-700 border-purple-200',
  'Administrative Staff': 'bg-orange-50 text-orange-700 border-orange-200',
  'Library Staff': 'bg-green-50 text-green-700 border-green-200',
  'Guest': 'bg-slate-50 text-slate-700 border-slate-200',
};

const VisitHistory = ({ studentId }: { studentId: string }) => {
  const db = useFirestore();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId || !db) return;
    
    let cancelled = false;
    
    const fetchHistory = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'visits'), where('studentId', '==', studentId))
        );
        if (cancelled) return;
        
        const visits = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => {
            const timeA = a.timestamp?.toDate?.()?.getTime() || 0;
            const timeB = b.timestamp?.toDate?.()?.getTime() || 0;
            return timeB - timeA;
          });
        
        setHistory(visits.slice(0, 5));
      } catch (err) {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    
    fetchHistory();
    
    return () => {
      cancelled = true;
    };
  }, [studentId, db]);

  if (loading) return <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Loading history...</p>;
  if (history.length === 0) return <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 italic">No previous visits recorded.</p>;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#4a6741]">{history.length} recent activity logs</p>
      <div className="space-y-2">
        {history.map((visit: any) => (
          <div key={visit.id} className="p-3 rounded-xl bg-white border border-[#f0f4f1] flex justify-between items-center group hover:border-[#c9a227] transition-all">
            <span className="font-black text-[#1a3a2a] text-[11px] uppercase tracking-tight">{visit.purpose}</span>
            <span className="text-[9px] font-bold text-slate-400 tabular-nums">
              {visit.timestamp?.toDate ? format(visit.timestamp.toDate(), 'MMM dd') : '--'}
            </span>
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
  const pathname = usePathname();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [enrichedVisits, setEnrichedVisits] = useState<any[]>([]);
  const [enriching, setEnriching] = useState(false);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  const closePanel = () => {
    setSidePanelOpen(false);
    // Small delay before clearing selected visit so animation completes
    setTimeout(() => setSelectedVisit(null), 300);
  };

  // Force close on navigation or unmount
  useEffect(() => {
    setSidePanelOpen(false);
    setSelectedVisit(null);
  }, [pathname]);

  // Global listener for nav changes
  useEffect(() => {
    const handler = () => closePanel();
    window.addEventListener('closeSidePanel', handler);
    return () => window.removeEventListener('closeSidePanel', handler);
  }, []);

  const visitsQuery = useMemo(() => db ? query(collection(db, 'visits'), orderBy('timestamp', 'desc')) : null, [db]);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);
  const { data: blocklist } = useCollection(db ? query(collection(db, 'blocklist')) : null);

  useEffect(() => {
    if (!allVisits || !db) return;
    
    const enrich = async () => {
      setEnriching(true);
      const enriched = await Promise.all(allVisits.map(async (visit) => {
        if (!visit.college && visit.studentId) {
          try {
            const userSnap = await getDocs(query(collection(db, 'users'), where('studentId', '==', visit.studentId)));
            if (!userSnap.empty) {
              const userData = userSnap.docs[0].data();
              return {
                ...visit,
                college: userData.college || visit.college || '',
                program: userData.program || visit.program || '',
                visitorType: userData.visitorType || visit.visitorType || 'Student',
                email: userData.email || visit.email || ''
              };
            }
          } catch (e) {}
        }
        return visit;
      }));
      setEnrichedVisits(enriched);
      setEnriching(false);
    };

    enrich();
  }, [allVisits, db]);

  const filteredVisits = useMemo(() => {
    return enrichedVisits.filter(v => {
      const visitType = v.visitorType || 'Student';
      const matchesSearch = (v.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (v.studentId || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      const visitDate = v.timestamp?.toDate ? v.timestamp.toDate() : new Date();
      const matchesDate = !dateFilter || isSameDay(visitDate, new Date(dateFilter));
      let matchesType = typeFilter === 'all' ? true : (typeFilter === 'employee' ? ['Faculty', 'Administrative Staff', 'Library Staff'].includes(visitType) : visitType === typeFilter);
      return matchesSearch && matchesPurpose && matchesType && matchesDate;
    });
  }, [enrichedVisits, searchTerm, purposeFilter, typeFilter, dateFilter]);

  const isBlocked = (id: string) => blocklist?.some(b => b.studentId === id);

  const handleBlockUser = async () => {
    if (!selectedVisit || !blockReason || !db) return;
    setIsBlocking(true);
    try {
      await addDoc(collection(db, 'blocklist'), {
        studentId: selectedVisit.studentId,
        fullName: selectedVisit.fullName,
        reason: blockReason,
        blockedBy: auth?.currentUser?.email || 'Admin',
        blockedAt: Timestamp.now()
      });
      toast({ title: "Visitor Blocked", description: `${selectedVisit.fullName} access restricted.` });
      setBlockModalOpen(false);
      setBlockReason('');
      closePanel();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-[#1a3a2a] uppercase tracking-tight">Visitor Logs</h2>
            <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest mt-1">Institutional Activity Archive</p>
          </div>
        </div>

        <Card className="p-6 rounded-2xl border-[#d4e4d8] bg-white border-t-2 border-t-[#c9a227] shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#4a6741]">Search</Label>
              <Input placeholder="Search name/ID..." className="bg-[#f8fafc] h-10 border-[#d4e4d8] text-xs font-bold" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#4a6741]">Role Filter</Label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="bg-[#f8fafc] h-10 border-[#d4e4d8] text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="Student">Students</SelectItem>
                  <SelectItem value="Faculty">Faculty</SelectItem>
                  <SelectItem value="employee">All Staff</SelectItem>
                  <SelectItem value="Guest">Guests</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#4a6741]">Purpose</Label>
              <Select value={purposeFilter} onValueChange={setPurposeFilter}>
                <SelectTrigger className="bg-[#f8fafc] h-10 border-[#d4e4d8] text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Purposes</SelectItem>
                  <SelectItem value="Reading Books">Reading Books</SelectItem>
                  <SelectItem value="Research / Study">Research / Study</SelectItem>
                  <SelectItem value="Computer / Internet">Computer / Internet</SelectItem>
                  <SelectItem value="Group Discussion">Group Discussion</SelectItem>
                  <SelectItem value="Thesis / Archival">Thesis / Archival</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#4a6741]">Visit Date</Label>
              <Input type="date" className="bg-[#f8fafc] h-10 border-[#d4e4d8] text-xs font-bold" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-[#d4e4d8] overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-[#1a3a2a]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest px-6 h-12">ID</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12">Full Name</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12">College</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12">Role</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12">Purpose</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12">Date & Time</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12 text-right px-6">Access</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitsLoading || enriching ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={7} className="px-6 py-4"><Skeleton className="h-10 w-full rounded-xl" /></TableCell></TableRow>
                ))
              ) : filteredVisits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center font-bold text-slate-400">No records matching filters found.</TableCell>
                </TableRow>
              ) : filteredVisits.map(v => (
                <TableRow 
                  key={v.id} 
                  onClick={() => { setSelectedVisit(v); setSidePanelOpen(true); }} 
                  className="cursor-pointer hover:bg-[#f0f7f2] transition-colors border-b-[#f0f4f1]"
                >
                  <TableCell className="px-6 font-mono text-[11px] font-bold text-slate-500">{v.studentId}</TableCell>
                  <TableCell className="font-black text-[#1a3a2a] text-sm">{v.fullName}</TableCell>
                  <TableCell className="text-xs font-bold text-slate-600">{v.college || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`font-black uppercase text-[9px] tracking-widest border-none ${TYPE_STYLES[v.visitorType || 'Student']}`}>
                      {v.visitorType || 'Student'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] uppercase font-black text-[#4a6741]">{v.purpose}</TableCell>
                  <TableCell className="text-[10px] uppercase font-bold text-slate-400 tabular-nums">
                    {v.timestamp?.toDate ? format(v.timestamp.toDate(), 'MMM dd, HH:mm') : '--'}
                  </TableCell>
                  <TableCell className="px-6 text-right">
                    {isBlocked(v.studentId) ? (
                      <Badge variant="destructive" className="font-black uppercase text-[9px] px-3 py-1 rounded-full">Blocked</Badge>
                    ) : (
                      <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black uppercase text-[9px] px-3 py-1 rounded-full">Active</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Overlay - only exists in DOM when panel is open */}
      {sidePanelOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity" 
          onClick={closePanel} 
        />
      )}

      {/* Side panel */}
      <div 
        className={`fixed right-0 top-0 h-full w-[420px] bg-white shadow-2xl z-[70] transform transition-transform duration-500 ease-in-out ${
          sidePanelOpen ? 'translate-x-0' : 'translate-x-full'
        } border-l border-[#d4e4d8] flex flex-col`}
        style={{ pointerEvents: sidePanelOpen ? 'auto' : 'none' }}
      >
        {selectedVisit && (
          <>
            <div className="bg-[#1a3a2a] p-10 flex flex-col items-center justify-center text-center relative">
              <button 
                onClick={closePanel} 
                className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              <div className="w-24 h-24 rounded-3xl bg-[#c9a227] flex items-center justify-center text-[#1a3a2a] text-4xl font-black shadow-2xl">
                {selectedVisit.fullName?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <h3 className="mt-6 text-2xl font-black text-white uppercase tracking-tight leading-none">{selectedVisit.fullName}</h3>
              <p className="mt-2 text-[#c9a227] font-mono text-sm font-bold">{selectedVisit.studentId}</p>
            </div>

            <div className="p-10 flex-1 overflow-y-auto space-y-8 custom-scrollbar">
              <div className="bg-[#f8fafc] rounded-2xl p-6 border border-[#f0f4f1] space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#c9a227]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#4a6741]">Visit Record</span>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-black text-[#1a3a2a]">{selectedVisit.purpose}</p>
                  <p className="text-xs font-bold text-slate-500">
                    {selectedVisit.timestamp?.toDate ? format(selectedVisit.timestamp.toDate(), 'PPPP p') : '--'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-[#c9a227]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#4a6741]">Profile Details</span>
                </div>
                <div className="bg-white rounded-2xl border border-[#f0f4f1] overflow-hidden mb-6">
                  {[
                    { label: 'Visitor Type', value: selectedVisit.visitorType || 'Student' },
                    { label: 'College', value: selectedVisit.college || '—' },
                    { label: 'Program', value: selectedVisit.program || '—' },
                    { label: 'Official Email', value: selectedVisit.email || '—' },
                    { label: 'Login Method', value: selectedVisit.loginMethod || 'id' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center px-6 py-4 border-b border-[#f0f4f1] last:border-none">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                      <span className="text-xs font-bold text-[#1a3a2a] text-right max-w-[180px]">{value}</span>
                    </div>
                  ))}
                </div>
                
                {/* Historical Activity */}
                <VisitHistory studentId={selectedVisit.studentId} />
              </div>

              <div className="pt-6">
                {!isBlocked(selectedVisit.studentId) ? (
                  <Button
                    onClick={() => setBlockModalOpen(true)}
                    className="w-full h-14 bg-red-50 text-red-600 border border-red-100 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <ShieldAlert className="w-5 h-5" />
                    Block This Visitor
                  </Button>
                ) : (
                  <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3">
                    <ShieldOff className="w-5 h-5 text-red-600" />
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-600">Account Restricted</p>
                      <p className="text-xs font-bold text-red-800/60">This visitor is currently on the blocklist.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Block Modal */}
      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-lg border-none shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-3xl font-black text-[#1a3a2a]">Confirm Restriction</DialogTitle>
            <DialogDescription className="text-[#4a6741] font-bold">You are about to block access for <span className="text-red-600">{selectedVisit?.fullName}</span>.</DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase tracking-widest text-[#1a3a2a] ml-1">Reason for Block</Label>
              <Textarea 
                placeholder="e.g. Violation of library policies, excessive noise, etc." 
                className="rounded-2xl bg-[#f8fafc] min-h-[120px] p-5 font-bold border-[#d4e4d8] text-sm focus:border-red-500" 
                value={blockReason} 
                onChange={(e) => setBlockReason(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="gap-4">
            <Button variant="outline" className="rounded-2xl h-14 px-8 font-black border-[#d4e4d8]" onClick={() => setBlockModalOpen(false)}>Cancel</Button>
            <Button 
              className="rounded-2xl h-14 px-10 font-black bg-red-600 text-white hover:bg-red-700" 
              disabled={isBlocking || !blockReason} 
              onClick={handleBlockUser}
            >
              {isBlocking ? <Loader2 className="animate-spin" /> : "Restrict Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
