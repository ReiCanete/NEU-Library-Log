'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Loader2, BookOpen, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore } from '@/firebase';
import { collection, query, orderBy, addDoc, Timestamp, limit, getDocs } from 'firebase/firestore';
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
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const pathname = usePathname();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Switching from useCollection to manual one-time fetch to prevent navigation blocking
  const [allVisits, setAllVisits] = useState<any[]>([]);
  const [blocklist, setBlocklist] = useState<any[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);

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
    let cancelled = false;
    
    if (db) {
      setVisitsLoading(true);
      fetchData();
    }
    
    return () => { cancelled = true; };
  }, [db]);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const visitType = v.visitorType || 'Student';
      const name = (v.fullName || '').toLowerCase();
      const id = (v.studentId || '').toLowerCase();
      const term = searchTerm.toLowerCase();
      const matchesSearch = name.includes(term) || id.includes(term);
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      const visitDate = v.timestamp?.toDate ? v.timestamp.toDate() : new Date();
      const matchesDate = !dateFilter || isSameDay(visitDate, new Date(dateFilter));
      let matchesType = typeFilter === 'all' ? true : (typeFilter === 'employee' ? ['Faculty', 'Administrative Staff', 'Library Staff'].includes(visitType) : visitType === typeFilter);
      return matchesSearch && matchesPurpose && matchesType && matchesDate;
    });
  }, [allVisits, searchTerm, purposeFilter, typeFilter, dateFilter]);

  // Clean up states on navigation
  useEffect(() => {
    setBlockModalOpen(false);
    setBlockTarget(null);
  }, [pathname]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, purposeFilter, typeFilter, dateFilter]);

  const totalPages = Math.ceil(filteredVisits.length / itemsPerPage);
  const paginatedVisits = filteredVisits.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
      toast({ title: "Visitor Restricted", description: `${blockTarget.fullName} has been added to the blocklist.` });
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-black text-[#1a3a2a] uppercase tracking-tight">Visitor Logs</h2>
            <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest mt-1">Institutional Activity Archive</p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => fetchData(true)} 
            disabled={visitsLoading}
            className="h-10 px-4 rounded-xl border-[#d4e4d8] text-[#1a3a2a] font-bold flex gap-2"
          >
            {visitsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <Card className="p-6 rounded-2xl border-[#d4e4d8] bg-white border-t-2 border-t-[#c9a227] shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <Input 
                type="date" 
                className="bg-[#f8fafc] h-10 border-[#d4e4d8] text-xs font-bold" 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)} 
              />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-[#d4e4d8] overflow-hidden shadow-sm bg-white">
          <Table>
            <TableHeader className="bg-[#1a3a2a]">
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
                  className="border-b-[#f0f4f1] hover:bg-[#f0f4f1]/40 transition-colors"
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
                    {isBlocked(v.studentId) ? (
                      <Badge variant="destructive" className="font-black uppercase text-[9px] px-3 py-1 rounded-full">Blocked</Badge>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 font-black text-[9px] uppercase tracking-widest"
                        onClick={() => {
                          setBlockTarget(v);
                          setBlockModalOpen(true);
                        }}
                      >
                        Block
                      </Button>
                    )}
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
    </AdminLayout>
  );
}
