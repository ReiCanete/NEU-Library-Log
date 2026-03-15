"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Download, Loader2, Library, LayoutDashboard, History, LogOut, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection } from '@/firebase';
import { auth, db as firestore } from '@/firebase/config';
import { collection, query, orderBy, where, Timestamp, addDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfDay, subDays, isSameDay, startOfWeek, startOfMonth, endOfDay } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('dashboard');

  // Chart Date Range
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 6), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [chartQueryDates, setChartQueryDates] = useState({ start: subDays(new Date(), 6), end: new Date() });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const email = sessionStorage.getItem('adminEmail');
    if (!email) {
      window.location.href = '/admin/login';
      return;
    }
    setAdminEmail(email);
    setAuthLoading(false);
  }, []);

  // Firestore Queries
  const todayStart = startOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const monthStart = startOfMonth(new Date());

  const visitsQuery = useMemo(() => query(collection(firestore, 'visits'), orderBy('timestamp', 'desc')), []);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  // Stats derivation
  const stats = useMemo(() => {
    if (!allVisits) return { today: 0, week: 0, month: 0 };
    return {
      today: allVisits.filter(v => v.timestamp.toDate() >= todayStart).length,
      week: allVisits.filter(v => v.timestamp.toDate() >= weekStart).length,
      month: allVisits.filter(v => v.timestamp.toDate() >= monthStart).length
    };
  }, [allVisits, todayStart, weekStart, monthStart]);

  // Chart data calculation
  const chartData = useMemo(() => {
    if (!allVisits) return [];
    const days = [];
    let curr = startOfDay(chartQueryDates.start);
    while (curr <= endOfDay(chartQueryDates.end)) {
      const count = allVisits.filter(v => isSameDay(v.timestamp.toDate(), curr)).length;
      days.push({ name: format(curr, 'MMM dd'), count });
      curr = subDays(curr, -1);
    }
    return days;
  }, [allVisits, chartQueryDates]);

  // Pagination logic
  const paginatedVisits = useMemo(() => {
    if (!allVisits) return [];
    const start = (currentPage - 1) * itemsPerPage;
    return allVisits.slice(start, start + itemsPerPage);
  }, [allVisits, currentPage]);

  // Blocking Logic
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlockUser = async () => {
    if (!selectedVisit || !blockReason || !adminEmail) return;
    setIsBlocking(true);
    try {
      await addDoc(collection(firestore, 'blocklist'), {
        studentId: selectedVisit.studentId,
        fullName: selectedVisit.fullName,
        reason: blockReason,
        blockedBy: adminEmail,
        blockedAt: Timestamp.now()
      });
      toast({ title: "Visitor Blocked", description: `${selectedVisit.fullName} is now on the blocklist.` });
      setSelectedVisit(null);
      setBlockReason('');
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsBlocking(false);
    }
  };

  const handleApplyRange = () => {
    setChartQueryDates({ start: new Date(startDate), end: new Date(endDate) });
  };

  const generateReport = () => {
    if (!allVisits) return;
    const doc = new jsPDF();
    const now = new Date();
    
    doc.setFontSize(22);
    doc.setTextColor(10, 42, 26);
    doc.text("NEU Library Log — Visitor Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generation Date: ${format(now, 'PPP p')}`, 14, 28);
    
    autoTable(doc, {
      startY: 35,
      head: [['Metric', 'Count']],
      body: [
        ['Total Visitors Today', stats.today.toString()],
        ['Total Visitors This Week', stats.week.toString()],
        ['Total Visitors This Month', stats.month.toString()]
      ],
      theme: 'grid',
      headStyles: { fillColor: [26, 92, 46] }
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Visitor Name', 'College', 'Program', 'Purpose', 'Method', 'Timestamp']],
      body: allVisits.slice(0, 100).map(v => [
        v.fullName,
        v.college,
        v.program || 'N/A',
        v.purpose,
        v.loginMethod.toUpperCase(),
        format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')
      ]),
      theme: 'striped',
      headStyles: { fillColor: [26, 92, 46] }
    });

    doc.save(`NEU-Library-Report-${format(now, 'yyyyMMdd')}.pdf`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    sessionStorage.removeItem('adminEmail');
    window.location.href = '/admin/login';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen neu-dark-bg flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-[#c9a227]" />
        <p className="text-white/60 font-black tracking-widest uppercase text-sm">Loading Panel...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f5f5f0]">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0a2a1a] text-white flex flex-col fixed inset-y-0 shadow-2xl z-40">
        <div className="p-8 border-b border-[#c9a227]/10 flex flex-col items-center gap-4">
          <img src="/neu-logo.png" alt="NEU Logo" className="w-16 h-16 object-contain" />
          <div className="text-center">
            <h1 className="text-lg font-black text-[#c9a227] tracking-tight leading-none uppercase">NEU Library</h1>
            <span className="text-[10px] text-[#c9a227]/40 font-bold uppercase tracking-widest">Admin Dashboard</span>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <button 
            onClick={() => setActiveSection('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === 'dashboard' ? 'bg-[#c9a227] text-[#0a2a1a] font-black' : 'text-white/50 hover:bg-white/5 font-bold'}`}
          >
            <LayoutDashboard className="h-5 w-5" /> Dashboard
          </button>
          <button 
            onClick={() => {
              setActiveSection('logs');
              document.getElementById('logs')?.scrollIntoView({ behavior: 'smooth' });
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === 'logs' ? 'bg-[#c9a227] text-[#0a2a1a] font-black' : 'text-white/50 hover:bg-white/5 font-bold'}`}
          >
            <History className="h-5 w-5" /> Visitor Logs
          </button>
        </nav>

        <div className="p-6 border-t border-[#c9a227]/10 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-10 w-10 rounded-full bg-[#c9a227] flex items-center justify-center font-black text-[#0a2a1a]">
              {adminEmail?.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">Administrator</p>
              <p className="text-[10px] text-white/30 truncate">{adminEmail}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all font-bold"
          >
            <LogOut className="h-5 w-5" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-72 flex-1 p-10 space-y-12 animate-in fade-in duration-1000">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-[#0a2a1a] tracking-tight">System Overview</h2>
            <p className="text-[#1a5c2e]/60 font-bold uppercase text-[10px] tracking-widest">Live statistics and monitoring</p>
          </div>
          <Button onClick={generateReport} className="bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] hover:opacity-90 rounded-xl px-8 h-14 font-black shadow-lg flex gap-2 transition-all">
            <Download className="h-5 w-5" /> Generate Report
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-8">
          {[
            { label: 'Today', value: stats.today, icon: Users, color: 'border-[#1a5c2e]', sub: 'active entries' },
            { label: 'This Week', value: stats.week, icon: Calendar, color: 'border-[#c9a227]', sub: 'last 7 days' },
            { label: 'This Month', value: stats.month, icon: TrendingUp, color: 'border-[#0a2a1a]', sub: 'monthly total' }
          ].map((s, i) => (
            <Card key={i} className={`border-l-[6px] ${s.color} shadow-md rounded-2xl bg-white`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{s.label}</CardTitle>
                <div className="p-2 bg-gray-50 rounded-lg"><s.icon className="h-4 w-4 text-gray-400" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-black text-[#0a2a1a]">{s.value}</div>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart Section */}
        <Card className="rounded-[2rem] shadow-md overflow-hidden border-none bg-white p-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <CardTitle className="text-2xl font-black text-[#0a2a1a]">Visitor Trends</CardTitle>
              <CardDescription className="text-gray-400 font-bold uppercase text-[10px]">Daily distribution analytics</CardDescription>
            </div>
            <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-2xl border border-gray-100">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-36 rounded-xl border-none bg-transparent font-bold text-gray-700" />
              <div className="h-4 w-px bg-gray-200" />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-36 rounded-xl border-none bg-transparent font-bold text-gray-700" />
              <Button onClick={handleApplyRange} size="sm" className="bg-[#1a5c2e] rounded-xl px-4 h-9 font-bold">Apply</Button>
            </div>
          </div>
          
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', padding: '12px' }}
                />
                <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#c9a227' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Table Section */}
        <div id="logs" className="space-y-6 pt-10">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black text-[#0a2a1a] tracking-tight">Visitor Activity Logs</h2>
          </div>

          <Card className="rounded-[2rem] shadow-md border-none overflow-hidden bg-white">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-[#1a5c2e]">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="px-8 h-14 font-black text-white uppercase tracking-widest text-[10px]">Visitor Name</TableHead>
                    <TableHead className="h-14 font-black text-white uppercase tracking-widest text-[10px]">Program / College</TableHead>
                    <TableHead className="h-14 font-black text-white uppercase tracking-widest text-[10px]">Purpose</TableHead>
                    <TableHead className="h-14 font-black text-white uppercase tracking-widest text-[10px]">Method</TableHead>
                    <TableHead className="h-14 font-black text-white uppercase tracking-widest text-[10px]">Time</TableHead>
                    <TableHead className="h-14 text-right px-8 font-black text-white uppercase tracking-widest text-[10px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitsLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6} className="px-8"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedVisits.map((visit) => (
                    <TableRow key={visit.id} className="hover:bg-gray-50/50 border-b-gray-100">
                      <TableCell className="px-8 font-black text-[#0a2a1a]">{visit.fullName}</TableCell>
                      <TableCell className="text-gray-500 font-bold text-xs">
                        <div className="flex flex-col">
                           <span>{visit.program || 'Visitor'}</span>
                           <span className="text-[10px] uppercase text-gray-400">{visit.college}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-[#1a5c2e]/10 text-[#1a5c2e] hover:bg-[#1a5c2e]/10 border-none px-4 py-1.5 font-black rounded-full text-[9px] uppercase">
                          {visit.purpose}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`border-none px-4 py-1.5 font-black rounded-full text-[9px] uppercase ${visit.loginMethod === 'google' ? 'bg-[#c9a227]/10 text-[#c9a227]' : 'bg-gray-100 text-gray-600'}`}>
                          {visit.loginMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-400 font-bold text-[10px]">
                        {format(visit.timestamp.toDate(), 'MMM dd, p')}
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="rounded-full px-6 h-9 font-black shadow-sm bg-red-600 text-[9px] uppercase" onClick={() => setSelectedVisit(visit)}>
                              Block
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10 max-w-lg">
                            <DialogHeader className="space-y-4">
                              <DialogTitle className="text-3xl font-black text-[#0a2a1a]">Restrict Access</DialogTitle>
                              <DialogDescription className="text-gray-500 font-medium">
                                Are you sure you want to block <span className="text-red-600 font-black underline">{selectedVisit?.fullName}</span>? This student will be immediately denied entry.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-8 space-y-3">
                              <Label className="font-black text-[#0a2a1a] text-[10px] uppercase tracking-widest ml-1">Reason for blocking</Label>
                              <Textarea 
                                placeholder="Describe the violation..." 
                                className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white min-h-[140px] p-5 font-bold text-sm"
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                              />
                            </div>
                            <DialogFooter className="gap-4">
                              <Button variant="outline" className="rounded-2xl h-14 px-8 font-black border-gray-200" onClick={() => setSelectedVisit(null)}>Cancel</Button>
                              <Button 
                                variant="destructive" 
                                className="rounded-2xl h-14 px-10 font-black shadow-lg"
                                disabled={isBlocking || !blockReason}
                                onClick={handleBlockUser}
                              >
                                {isBlocking ? <Loader2 className="animate-spin" /> : "Confirm Block"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <div className="p-8 flex justify-between items-center bg-gray-50/30">
                <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                  Showing <span className="text-[#0a2a1a]">{paginatedVisits.length}</span> / {allVisits?.length || 0} logs
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="rounded-xl h-10 px-6 font-black border-gray-200 text-[10px] uppercase disabled:opacity-30" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    className="rounded-xl h-10 px-6 font-black border-gray-200 text-[10px] uppercase disabled:opacity-30" 
                    disabled={!allVisits || currentPage * itemsPerPage >= allVisits.length}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}