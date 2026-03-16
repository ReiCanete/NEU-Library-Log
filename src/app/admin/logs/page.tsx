"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Search, History, Mail, Filter, Loader2, UserCircle, X, ShieldOff, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth, useFirestore, useCollection } from '@/firebase';
import { collection, query, orderBy, deleteDoc, doc, Timestamp, where, getDocs, addDoc } from 'firebase/firestore';
import { format, isSameDay } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TYPE_STYLES: Record<string, string> = {
  'Student': 'bg-blue-50 text-blue-700 border-blue-200',
  'Faculty': 'bg-purple-50 text-purple-700 border-purple-200',
  'Administrative Staff': 'bg-orange-50 text-orange-700 border-orange-200',
  'Library Staff': 'bg-green-50 text-green-700 border-green-200',
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
        const q = query(collection(db, 'visits'), where('studentId', '==', studentId));
        const snap = await getDocs(q);
        const visits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        visits.sort((a: any, b: any) => (b.timestamp?.toDate?.()?.getTime() || 0) - (a.timestamp?.toDate?.()?.getTime() || 0));
        setHistory(visits.slice(0, 10));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    fetchHistory();
  }, [db, studentId]);
  if (loading) return <div className="py-4 flex gap-2"><Loader2 className="h-4 w-4 animate-spin" /></div>;
  return (<div className="space-y-2 mt-2">{history.map(v => (<div key={v.id} className={`text-xs p-3 rounded-xl border ${v.id === currentVisitId ? 'bg-[#c9a227]/10 border-[#c9a227]' : 'bg-white'}`}><div className="flex justify-between font-bold"><span>{v.purpose}</span><span>{v.timestamp?.toDate ? format(v.timestamp.toDate(), 'MMM dd') : ''}</span></div></div>))}</div>);
};

export default function VisitorLogs() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);

  const visitsQuery = useMemo(() => db ? query(collection(db, 'visits'), orderBy('timestamp', 'desc')) : null, [db]);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);
  const { data: blocklist } = useCollection(db ? query(collection(db, 'blocklist')) : null);

  const filteredVisits = useMemo(() => {
    if (!allVisits) return [];
    return allVisits.filter(v => {
      const visitType = v.visitorType || 'Student';
      const matchesSearch = v.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || v.studentId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPurpose = purposeFilter === 'all' || v.purpose === purposeFilter;
      const matchesDate = !dateFilter || isSameDay(v.timestamp.toDate(), new Date(dateFilter));
      let matchesType = typeFilter === 'all' ? true : (typeFilter === 'employee' ? ['Faculty', 'Administrative Staff', 'Library Staff'].includes(visitType) : visitType === typeFilter);
      return matchesSearch && matchesPurpose && matchesType && matchesDate;
    });
  }, [allVisits, searchTerm, purposeFilter, typeFilter, dateFilter]);

  const isBlocked = (id: string) => blocklist?.some(b => b.studentId === id);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h2 className="text-3xl font-black text-[#1a3a2a] uppercase tracking-tight">Visitor Logs</h2>
        <Card className="p-6 rounded-2xl border-[#d4e4d8] bg-white border-t-2 border-t-[#c9a227]"><div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input placeholder="Search name/ID..." className="bg-[#f0f4f1]" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="bg-[#f0f4f1]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Roles</SelectItem><SelectItem value="Student">Students</SelectItem><SelectItem value="Faculty">Faculty</SelectItem><SelectItem value="employee">All Staff</SelectItem></SelectContent></Select>
          <Select value={purposeFilter} onValueChange={setPurposeFilter}><SelectTrigger className="bg-[#f0f4f1]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Purposes</SelectItem></SelectContent></Select>
          <Input type="date" className="bg-[#f0f4f1]" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        </div></Card>
        <Card className="rounded-2xl border-[#d4e4d8] overflow-hidden"><Table><TableHeader className="bg-[#1a3a2a]"><TableRow><TableHead className="text-white">ID</TableHead><TableHead className="text-white">Visitor</TableHead><TableHead className="text-white">Role</TableHead><TableHead className="text-white">Purpose</TableHead><TableHead className="text-white">Date</TableHead><TableHead className="text-white text-right">Access</TableHead></TableRow></TableHeader><TableBody>
          {visitsLoading ? <TableRow><TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell></TableRow> : filteredVisits.map(v => (
            <TableRow key={v.id} onClick={() => { setSelectedVisit(v); setSidePanelOpen(true); }} className="cursor-pointer hover:bg-[#f0f7f2] transition-colors">
              <TableCell className="font-mono text-xs">{v.studentId}</TableCell>
              <TableCell className="font-bold">{v.fullName}</TableCell>
              <TableCell><Badge className={TYPE_STYLES[v.visitorType || 'Student']}>{v.visitorType || 'Student'}</Badge></TableCell>
              <TableCell className="text-xs uppercase font-black">{v.purpose}</TableCell>
              <TableCell className="text-[10px] uppercase font-bold text-slate-400">{format(v.timestamp.toDate(), 'MMM dd, HH:mm')}</TableCell>
              <TableCell className="text-right">{isBlocked(v.studentId) ? <Badge variant="destructive">Blocked</Badge> : <Badge className="bg-emerald-50 text-emerald-600">Active</Badge>}</TableCell>
            </TableRow>
          ))}</TableBody></Table></Card>
      </div>
      {sidePanelOpen && <div className="fixed inset-0 bg-black/40 z-[90]" onClick={() => setSidePanelOpen(false)} />}
      <div className={`fixed right-0 top-0 h-full w-[420px] bg-white z-[100] transition-transform ${sidePanelOpen ? 'translate-x-0' : 'translate-x-full'} p-8`}>
        {selectedVisit && (<div className="space-y-6">
          <div className="flex justify-between items-center"><h3 className="text-xl font-black uppercase">Visitor Profile</h3><button onClick={() => setSidePanelOpen(false)}><X /></button></div>
          <div className="flex flex-col items-center py-4"><div className="w-20 h-20 rounded-2xl bg-[#1a3a2a] text-[#c9a227] flex items-center justify-center text-3xl font-black">{selectedVisit.fullName[0]}</div><h4 className="mt-4 text-2xl font-black">{selectedVisit.fullName}</h4><p className="font-mono text-[#c9a227]">{selectedVisit.studentId}</p></div>
          <VisitHistory studentId={selectedVisit.studentId} currentVisitId={selectedVisit.id} />
        </div>)}
      </div>
    </AdminLayout>
  );
}
