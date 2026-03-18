'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore } from '@/firebase';
import { collection, query, orderBy, addDoc, Timestamp, limit, getDocs, where, updateDoc, doc } from 'firebase/firestore';
import { isSameDay, format } from 'date-fns';
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

export default function VisitorLogs() {
  const { toast, dismiss } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const pathname = usePathname();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Edit states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editPurpose, setEditPurpose] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [allVisits, setAllVisits] = useState<any[]>([]);
  const [blocklist, setBlocklist] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);

  // Side panel state
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [visitHistory, setVisitHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchData = async (isRefresh = false) => {
    if (!db) return;
    try {
      if (isRefresh) setVisitsLoading(true);
      const [visitsSnap, blockSnap] = await Promise.all([
        getDocs(query(collection(db, 'visits'), orderBy('timestamp', 'desc'), limit(200))),
        getDocs(query(collection(db, 'blocklist'), limit(500)))
      ]);
      setAllVisits(visitsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setBlocklist(blockSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error('Failed to fetch logs:', e);
      toast({ title: "Fetch Failed", description: "Could not load library logs.", variant: "destructive" });
    } finally {
      setVisitsLoading(false);
    }
  };

  useEffect(() => {
    if (db) {
      setVisitsLoading(true);
      fetchData();
    }
  }, [db]);

  useEffect(() => {
    if (!blockModalOpen) return;
    const dismissToast = () => {
      const toastEl = document.querySelector('[data-radix-toast-viewport] li');
      if (toastEl) (toastEl as HTMLElement).click();
    };
    document.addEventListener('click', dismissToast, { once: true, capture: true });
    return () => document.removeEventListener('click', dismissToast, true);
  }, [blockModalOpen]);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const name = (v.fullName || '').toLowerCase();
      const id = (v.studentId || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch = name.includes(term) || id.includes(term);
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      const visitDate = v.timestamp?.toDate ? v.timestamp.toDate() : new Date();
      const matchesDate = !dateFilter || isSameDay(visitDate, new Date(dateFilter));
      return matchesSearch && matchesPurpose && matchesDate;
    });
  }, [allVisits, searchTerm, purposeFilter, dateFilter]);

  // Clean up states on navigation
  useEffect(() => {
    setBlockModalOpen(false);
    setBlockTarget(null);
    setEditModalOpen(false);
    setEditTarget(null);
    setSidePanelOpen(false);
    setSelectedVisit(null);
  }, [pathname]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, purposeFilter, dateFilter]);

  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
  const paginatedVisits = filteredVisits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const isBlocked = (id: string) => blocklist?.some(b => b.studentId === id);

  const closePanel = () => {
    setSidePanelOpen(false);
    setTimeout(() => {
      setSelectedVisit(null);
      setVisitHistory([]);
    }, 300);
  };

  const handleRowClick = async (visit: any) => {
    // If clicking the same row that is already open — close the panel
    if (selectedVisit?.id === visit.id && sidePanelOpen) {
      closePanel();
      return;
    }

    // Otherwise open panel with new visit
    setSelectedVisit(visit);
    setSidePanelOpen(true);
    
    // Fetch visit history for this visitor
    if (!db || !visit.studentId) return;
    setHistoryLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'visits'),
          where('studentId', '==', visit.studentId),
          orderBy('timestamp', 'desc'),
          limit(10)
        )
      );
      setVisitHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      setVisitHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

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
      const { id } = toast({ title: "Visitor Restricted", description: `${blockTarget.fullName} has been added to the blocklist.`, duration: 999999 });
      const dismissOnClick = () => dismiss(id);
      document.addEventListener('click', dismissOnClick, { once: true });
      
      setBlockModalOpen(false);
      setBlockReason('');
      setBlockTarget(null);
      // Re-fetch to update block status in local UI
      fetchData();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsBlocking(false);
    }
  };

  const handleEditVisit = async () => {
    if (!editTarget || !editPurpose || !db) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'visits', editTarget.id), { purpose: editPurpose });
      setAllVisits(prev => prev.map(v => v.id === editTarget.id ? { ...v, purpose: editPurpose } : v));
      toast({ title: "Log Updated", description: "Visit purpose has been updated." });
      setEditModalOpen(false);
    } catch (e: any) {
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-10 rounded-full bg-gradient-to-b from-[#c9a227] to-[#1a3a2a]" />
            <div>
              <h2 className="text-3xl font-black text-[#1a3a2a] uppercase tracking-tight">Visitor Logs</h2>
              <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest mt-1">Institutional Activity Archive</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={() => fetchData(true)} 
            disabled={visitsLoading}
            className="h-10 px-5 rounded-xl border border-[#c8ddd0] bg-white text-[#1a3a2a] font-bold flex gap-2 hover:bg-[#f4f8f5] hover:border-[#1a3a2a]/30 transition-all shadow-sm"
          >
            {visitsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <Card className="p-6 rounded-2xl border border-[#d4e4d8] bg-white ring-1 ring-[#1a3a2a]/5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase tracking-widest text-[#4a6741]">Search</Label>
              <Input 
                placeholder="Search name/ID..." 
                className="bg-[#f8fafc] h-10 border-[#d4e4d8] text-xs font-bold" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
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
              <Input 
                type="date" 
                className="bg-[#f8fafc] h-10 border-[#d4e4d8] text-xs font-bold" 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)} 
              />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border border-[#d4e4d8] overflow-hidden shadow-sm bg-white ring-1 ring-[#1a3a2a]/5">
          <Table>
            <TableHeader className="bg-gradient-to-r from-[#0d2b1a] to-[#1a3a2a]">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest px-6 h-12">ID</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12">Full Name</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12">College</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12">Role</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12">Purpose</TableHead>
                <TableHead className="text-white font-black uppercase text-[10px] tracking-widest h-12 text-right px-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitsLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6} className="px-6 py-4"><Skeleton className="h-10 w-full rounded-xl" /></TableCell></TableRow>
                ))
              ) : paginatedVisits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center font-bold text-slate-400">No records matching filters found.</TableCell>
                </TableRow>
              ) : paginatedVisits.map(v => (
                <TableRow 
                  key={v.id} 
                  onClick={() => handleRowClick(v)}
                  className={`cursor-pointer transition-colors border-b-[#f0f4f1] ${
                    selectedVisit?.id === v.id && sidePanelOpen
                      ? 'bg-[#f0f7f2] border-l-2 border-l-[#c9a227]'
                      : 'hover:bg-[#f0f4f1]/40'
                  }`}
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
                  <TableCell className="px-6 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[#1a3a2a] hover:text-white hover:bg-[#1a3a2a] font-black text-[9px] uppercase tracking-widest border border-[#d4e4d8] rounded-lg px-3 transition-all mr-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTarget(v);
                          setEditPurpose(v.purpose || '');
                          setEditModalOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      {isBlocked(v.studentId) ? (
                        <Badge className="font-black uppercase text-[9px] px-3 py-1 rounded-full bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed select-none">
                          Blocked
                        </Badge>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-red-600 hover:text-white hover:bg-red-600 font-black text-[9px] uppercase tracking-widest border border-red-100 rounded-lg px-3 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            setBlockTarget(v);
                            setBlockModalOpen(true);
                          }}
                        >
                          Block
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!visitsLoading && totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#f0f4f1]">
              <div className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredVisits.length)} of {filteredVisits.length} logs
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-[#d4e4d8]"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          className={`h-8 w-8 rounded-lg text-[10px] font-black ${
                            currentPage === page ? 'bg-[#1a3a2a] text-white' : 'border-[#d4e4d8] text-[#1a3a2a]'
                          }`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      );
                    }
                    if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="text-slate-300 px-1">...</span>;
                    }
                    return null;
                  })}
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg border-[#d4e4d8]"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Dialog open={blockModalOpen} onOpenChange={setBlockModalOpen}>
        <DialogContent className="rounded-2xl p-10 max-w-md">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-2xl font-black text-[#1a3a2a]">Restrict Visitor</DialogTitle>
            <DialogDescription className="text-sm text-[#4a6741] font-bold">Block access for <span className="text-red-600 font-black">{blockTarget?.fullName}</span>?</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-[#1a3a2a]">Reason for Block</Label>
              <Textarea 
                placeholder="Details of violation..." 
                className="rounded-xl bg-[#f8fafc] min-h-[100px] p-4 font-bold border-[#d4e4d8] text-sm" 
                value={blockReason} 
                onChange={(e) => setBlockReason(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={() => setBlockModalOpen(false)}>Cancel</Button>
            <Button 
              className="h-12 rounded-xl font-black bg-red-600 text-white hover:bg-red-700" 
              disabled={isBlocking || !blockReason.trim()} 
              onClick={handleBlockUser}
            >
              {isBlocking ? <Loader2 className="animate-spin h-4 w-4" /> : "Restrict Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="rounded-2xl p-10 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-[#1a3a2a]">Edit Visit Log</DialogTitle>
            <DialogDescription>Update purpose for <span className="font-black text-[#1a3a2a]">{editTarget?.fullName}</span></DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-[#1a3a2a]">Visit Purpose</Label>
            <Select value={editPurpose} onValueChange={setEditPurpose}>
              <SelectTrigger className="h-11 rounded-xl border-[#d4e4d8]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['Reading Books','Research / Study','Computer / Internet','Group Discussion','Thesis / Archival','Other Purpose'].map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="outline" className="h-12 rounded-xl font-bold" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button className="h-12 rounded-xl font-black bg-[#1a3a2a] text-white" disabled={isSaving || !editPurpose} onClick={handleEditVisit}>
              {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Side panel - no overlay, just the drawer itself */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          height: '100%',
          width: '380px',
          background: 'white',
          zIndex: 50,
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          overflowY: 'auto',
          transform: sidePanelOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          pointerEvents: sidePanelOpen ? 'all' : 'none',
        }}
      >
        {selectedVisit && (
          <>
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #0d2b1a 0%, #1a3a2a 100%)', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
              <h2 style={{ color: 'white', fontWeight: 'bold', fontSize: '16px', margin: 0 }}>Visitor Details</h2>
              <button onClick={closePanel} style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              {/* Avatar + name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#1a3a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ color: '#c9a227', fontSize: '22px', fontWeight: 'bold' }}>
                    {selectedVisit.fullName?.charAt(0)?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <h3 style={{ fontWeight: 'bold', color: '#1a3a2a', fontSize: '18px', margin: 0 }}>{selectedVisit.fullName}</h3>
                  <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>{selectedVisit.studentId}</p>
                </div>
              </div>

              {/* This visit */}
              <div style={{ background: '#f0f7f2', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', color: '#4a6741', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600', marginBottom: '8px' }}>This Visit</p>
                <p style={{ fontWeight: '600', color: '#1a3a2a', margin: '0 0 4px', fontSize: '14px' }}>{selectedVisit.purpose}</p>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                  {selectedVisit.timestamp?.toDate?.()?.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p style={{ fontSize: '13px', color: '#6b7280', margin: '2px 0 0' }}>
                  {selectedVisit.timestamp?.toDate?.()?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Profile */}
              <div style={{ background: '#f0f7f2', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', color: '#4a6741', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600', marginBottom: '10px' }}>Profile</p>
                {[
                  { label: 'Visitor Type', value: selectedVisit.visitorType || 'Student' },
                  { label: 'College', value: selectedVisit.college || '—' },
                  { label: 'Program', value: selectedVisit.program || '—' },
                  { label: 'Email', value: selectedVisit.email || '—' },
                  { label: 'Login Method', value: selectedVisit.loginMethod || '—' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '7px' }}>
                    <span style={{ fontSize: '13px', color: '#6b7280', flexShrink: 0 }}>{label}</span>
                    <span style={{ fontSize: '13px', fontWeight: '500', color: '#1a3a2a', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Visit history */}
              <div style={{ background: '#f0f7f2', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                <p style={{ fontSize: '11px', color: '#4a6741', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '600', marginBottom: '10px' }}>
                  Visit History
                </p>
                {historyLoading ? (
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>Loading...</p>
                ) : visitHistory.length === 0 ? (
                  <p style={{ fontSize: '13px', color: '#9ca3af' }}>No visit history found.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '0 0 4px' }}>{visitHistory.length} total visit{visitHistory.length !== 1 ? 's' : ''}</p>
                    {visitHistory.map((v: any) => (
                      <div key={v.id} style={{ background: 'white', borderRadius: '8px', padding: '8px 10px', border: v.id === selectedVisit.id ? '1px solid #c9a227' : '1px solid #d4e4d8' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: '500', color: '#1a3a2a' }}>{v.purpose}</span>
                          <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                            {v.timestamp?.toDate?.()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        </div>
                        {v.id === selectedVisit.id && (
                          <span style={{ fontSize: '11px', color: '#c9a227', fontWeight: '600' }}>Current visit</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Block button */}
              {isBlocked(selectedVisit.studentId) ? (
                <div style={{ width: '100%', padding: '11px', background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13px', textAlign: 'center', cursor: 'not-allowed', userSelect: 'none' }}>
                  Already Restricted
                </div>
              ) : (
                <button
                  onClick={() => {
                    closePanel();
                    setTimeout(() => {
                      setBlockTarget(selectedVisit);
                      setBlockModalOpen(true);
                    }, 300);
                  }}
                  style={{ width: '100%', padding: '11px', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '12px', fontWeight: '500', cursor: 'pointer', fontSize: '13px' }}
                >
                  Block This Visitor
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
