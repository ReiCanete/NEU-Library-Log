'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import { useRouter } from 'next/navigation';

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

  if (loading) return <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '10px 0' }}>Loading history...</p>;
  if (history.length === 0) return <p style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', margin: '10px 0' }}>No previous visits recorded.</p>;

  return (
    <div style={{ marginTop: '16px' }}>
      <p style={{ fontSize: '11px', color: '#4a6741', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600', marginBottom: '8px' }}>
        {history.length} recent activity logs
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {history.map((visit: any) => (
          <div key={visit.id} style={{ padding: '12px', borderRadius: '12px', background: 'white', border: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', color: '#1a3a2a', fontSize: '11px', textTransform: 'uppercase' }}>{visit.purpose}</span>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#9ca3af' }}>
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

  const closePanel = useCallback(() => {
    setSidePanelOpen(false);
    setTimeout(() => setSelectedVisit(null), 350);
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

  const SidePanel = () => {
    if (!selectedVisit) return null;
    
    return createPortal(
      <>
        {/* Overlay */}
        <div
          onClick={closePanel}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
            background: 'rgba(0,0,0,0.2)',
            cursor: 'default',
          }}
        />
        
        {/* Panel */}
        <div
          style={{
            position: 'fixed',
            right: 0,
            top: 0,
            height: '100%',
            width: '400px',
            background: 'white',
            zIndex: 9999,
            boxShadow: '-4px 0 30px rgba(0,0,0,0.15)',
            overflowY: 'auto',
            transform: sidePanelOpen ? 'translateX(0)' : 'translateX(100%)',
            transition: 'transform 0.3s ease',
          }}
        >
          {/* Header */}
          <div style={{ background: '#1a3a2a', padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
            <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '18px', margin: 0 }}>Visitor Details</h2>
            <button
              onClick={closePanel}
              style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ padding: '24px' }}>
            {/* Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#1a3a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ color: '#c9a227', fontSize: '24px', fontWeight: 'bold' }}>
                  {selectedVisit.fullName?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1a3a2a', margin: 0 }}>{selectedVisit.fullName}</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0' }}>{selectedVisit.studentId}</p>
              </div>
            </div>

            {/* Visit info */}
            <div style={{ background: '#f0f7f2', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', color: '#4a6741', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600', marginBottom: '8px' }}>This Visit</p>
              <p style={{ fontWeight: '600', color: '#1a3a2a', margin: '0 0 4px' }}>{selectedVisit.purpose}</p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                {selectedVisit.timestamp?.toDate?.()?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '2px 0 0' }}>
                {selectedVisit.timestamp?.toDate?.()?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Profile info */}
            <div style={{ background: '#f0f7f2', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
              <p style={{ fontSize: '11px', color: '#4a6741', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: '600', marginBottom: '12px' }}>Profile</p>
              {[
                { label: 'Visitor Type', value: selectedVisit.visitorType || 'Student' },
                { label: 'College', value: selectedVisit.college || '—' },
                { label: 'Program', value: selectedVisit.program || '—' },
                { label: 'Email', value: selectedVisit.email || '—' },
                { label: 'Login Method', value: selectedVisit.loginMethod || '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', gap: '16px' }}>
                  <span style={{ fontSize: '14px', color: '#6b7280', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1a3a2a', textAlign: 'right' }}>{value}</span>
                </div>
              ))}
              
              {/* Historical Activity */}
              <VisitHistory studentId={selectedVisit.studentId} />
            </div>

            {/* Block button */}
            {!isBlocked(selectedVisit.studentId) ? (
              <button
                onClick={() => {
                  setBlockTarget(selectedVisit);
                  setBlockModalOpen(true);
                  closePanel();
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '14px',
                }}
              >
                <ShieldAlert size={16} />
                Block This Visitor
              </button>
            ) : (
              <div style={{ padding: '12px', background: '#f3f4f6', borderRadius: '12px', textAlign: 'center', color: '#6b7280', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <ShieldOff size={16} />
                Visitor is Blocked
              </div>
            )}
          </div>
        </div>
      </>,
      document.body
    );
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

      {/* Portal Panel */}
      {typeof window !== 'undefined' && sidePanelOpen && <SidePanel />}

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