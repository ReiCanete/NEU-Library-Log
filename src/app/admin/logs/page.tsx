'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Search, Loader2, UserCircle, X, ShieldOff, Clock, ShieldAlert } from 'lucide-react';
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
import { useRouter, usePathname } from 'next/navigation';

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

  if (loading) return <p className="text-[11px] text-slate-400 uppercase tracking-widest my-2">Loading history...</p>;
  if (history.length === 0) return <p className="text-[11px] text-slate-400 italic my-2">No previous visits.</p>;

  return (
    <div className="mt-4">
      <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest mb-2">Recent Activity</p>
      <div className="space-y-2">
        {history.map((visit: any) => (
          <div key={visit.id} className="p-3 rounded-xl bg-white border border-[#f0f4f1] flex justify-between items-center shadow-sm">
            <span className="font-bold text-[#1a3a2a] text-[10px] uppercase">{visit.purpose}</span>
            <span className="text-[9px] font-bold text-slate-400">
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
  const router = useRouter();
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
  const [blockTarget, setBlockTarget] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

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
    if (!blockTarget || !blockReason || !db) return;
    setIsBlocking(true);
    try {
      await addDoc(collection(db, 'blocklist'), {
        studentId: blockTarget.studentId,
        fullName: blockTarget.fullName,
        reason: blockReason,
        blockedBy: auth?.currentUser?.email || 'Admin',
        blockedAt: Timestamp.now()
      });
      toast({ title: "Visitor Blocked", description: `${blockTarget.fullName} access restricted.` });
      setBlockModalOpen(false);
      setBlockReason('');
      setBlockTarget(null);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsBlocking(false);
    }
  };

  const closePanel = useCallback(() => {
    setSidePanelOpen(false);
    setTimeout(() => setSelectedVisit(null), 300);
  }, []);

  // Cleanup on route change
  useEffect(() => {
    setSidePanelOpen(false);
    setSelectedVisit(null);
  }, [pathname]);

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
                    <Badge variant="outline" className={`font-black uppercase text-[9px] tracking-widest border-none ${
                      v.visitorType === 'Student' ? 'bg-blue-50 text-blue-700' :
                      v.visitorType === 'Faculty' ? 'bg-purple-50 text-purple-700' :
                      v.visitorType === 'Guest' ? 'bg-slate-50 text-slate-700' :
                      'bg-green-50 text-green-700'
                    }`}>
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

      {/* Overlay - lower z-index than sidebar so sidebar stays clickable */}
      {sidePanelOpen && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 998, background: 'rgba(0,0,0,0.2)', cursor: 'default' }}
          onClick={closePanel}
        />
      )}

      {/* Side panel - slides in/out but pointer-events disabled when closed */}
      <div
        className={`fixed right-0 top-0 h-full w-[380px] bg-white shadow-2xl overflow-y-auto transition-transform duration-300 ${
          sidePanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ zIndex: 999, pointerEvents: sidePanelOpen ? 'auto' : 'none' }}
      >
        {selectedVisit && (
          <>
            <div className="bg-[#1a3a2a] p-5 flex items-center justify-between sticky top-0 z-10 shadow-md">
              <h2 className="text-white font-bold text-lg">Visitor Details</h2>
              <button
                onClick={closePanel}
                className="text-white/60 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* Avatar + name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#1a3a2a] flex items-center justify-center shrink-0 shadow-lg">
                  <span className="text-[#c9a227] text-2xl font-black">
                    {selectedVisit.fullName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div className="overflow-hidden">
                  <h3 className="font-black text-[#1a3a2a] text-xl truncate" title={selectedVisit.fullName}>{selectedVisit.fullName}</h3>
                  <p className="text-sm font-bold text-slate-400 tabular-nums uppercase tracking-widest">{selectedVisit.studentId}</p>
                </div>
              </div>

              {/* Visit info */}
              <div className="bg-[#f0f7f2] rounded-2xl p-5 border border-[#d4e4d8]/50 shadow-sm">
                <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-[0.2em] mb-3">Recent Interaction</p>
                <p className="font-black text-[#1a3a2a] text-lg leading-tight mb-2">{selectedVisit.purpose}</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    {selectedVisit.timestamp?.toDate?.()?.toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </div>
                  <div className="text-xs font-bold text-slate-400 ml-5">
                    {selectedVisit.timestamp?.toDate?.()?.toLocaleTimeString('en-US', {
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>

              {/* Profile info */}
              <div className="bg-[#f8fafc] rounded-2xl p-5 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Official Record</p>
                <div className="space-y-4">
                  {[
                    { label: 'Role / Type', value: selectedVisit.visitorType || 'Student' },
                    { label: 'College', value: selectedVisit.college || '—' },
                    { label: 'Program', value: selectedVisit.program || '—' },
                    { label: 'Email', value: selectedVisit.email || '—' },
                    { label: 'Login Method', value: selectedVisit.loginMethod || '—' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col gap-1 pb-3 border-b border-slate-50 last:border-none last:pb-0">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
                      <span className="text-sm font-bold text-[#1a3a2a] break-all">{value}</span>
                    </div>
                  ))}
                </div>
                
                {/* Historical visits inside panel */}
                <VisitHistory studentId={selectedVisit.studentId} />
              </div>

              {/* Block button */}
              {!isBlocked(selectedVisit.studentId) ? (
                <button
                  onClick={() => {
                    setSidePanelOpen(false);
                    setTimeout(() => {
                      setSelectedVisit(null);
                      setBlockTarget(selectedVisit);
                      setBlockModalOpen(true);
                    }, 300);
                  }}
                  className="w-full py-4 bg-red-50 text-red-700 border border-red-100 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <ShieldAlert className="w-4 h-4" />
                  Restrict Access
                </button>
              ) : (
                <div className="w-full py-4 bg-slate-100 text-slate-400 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-slate-200">
                  <ShieldOff className="w-4 h-4" />
                  Visitor is Restricted
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Block Modal */}
      <Dialog open={blockModalOpen} onOpenChange={(open) => {
        if (!open) {
          setBlockModalOpen(false);
          setBlockTarget(null);
        }
      }}>
        <DialogContent className="rounded-[2.5rem] p-10 max-w-lg border-none shadow-2xl">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-3xl font-black text-[#1a3a2a]">Confirm Restriction</DialogTitle>
            <DialogDescription className="text-[#4a6741] font-bold">You are about to block access for <span className="text-red-600">{blockTarget?.fullName}</span>.</DialogDescription>
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
            <Button variant="outline" className="rounded-2xl h-14 px-8 font-black border-[#d4e4d8]" onClick={() => { setBlockModalOpen(false); setBlockTarget(null); }}>Cancel</Button>
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