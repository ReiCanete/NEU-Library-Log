'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Search, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { isSameDay } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from '@/components/ui/textarea';

export default function VisitorLogs() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  const visitsQuery = useMemo(() => db ? query(collection(db, 'visits'), orderBy('timestamp', 'desc')) : null, [db]);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);
  const { data: blocklist } = useCollection(db ? query(collection(db, 'blocklist')) : null);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const visitType = v.visitorType || 'Student';
      const matchesSearch = (v.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (v.studentId || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      const visitDate = v.timestamp?.toDate ? v.timestamp.toDate() : new Date();
      const matchesDate = !dateFilter || isSameDay(visitDate, new Date(dateFilter));
      let matchesType = typeFilter === 'all' ? true : (typeFilter === 'employee' ? ['Faculty', 'Administrative Staff', 'Library Staff'].includes(visitType) : visitType === typeFilter);
      return matchesSearch && matchesPurpose && matchesType && matchesDate;
    });
  }, [allVisits, searchTerm, purposeFilter, typeFilter, dateFilter]);

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
              <Input 
                type="date" 
                className="bg-[#f8fafc] h-10 border-[#d4e4d8] text-xs font-bold" 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)} 
              />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-[#d4e4d8] overflow-hidden shadow-sm">
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
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={6} className="px-6 py-4"><Skeleton className="h-10 w-full rounded-xl" /></TableCell></TableRow>
                ))
              ) : filteredVisits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-40 text-center font-bold text-slate-400">No records matching filters found.</TableCell>
                </TableRow>
              ) : filteredVisits.map(v => (
                <TableRow key={v.id} className="border-b-[#f0f4f1]">
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
        </Card>
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
                placeholder="Violation details..." 
                className="rounded-2xl bg-[#f8fafc] min-h-[120px] p-5 font-bold border-[#d4e4d8] text-sm" 
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