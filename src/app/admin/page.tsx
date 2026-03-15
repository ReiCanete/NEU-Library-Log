"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Download, Loader2, Library, LayoutDashboard, History, LogOut, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection } from '@/firebase';
import { auth, db as firestore } from '@/firebase/config';
import { collection, query, orderBy, limit, where, Timestamp, addDoc, getDoc, doc } from 'firebase/firestore';
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
import { signOut, onAuthStateChanged } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [admin, setAdmin] = useState<any>(null);
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/admin/login');
        return;
      }
      
      const emailPrefix = user.email?.split('@')[0];
      const userDoc = await getDoc(doc(firestore, 'users', user.uid));
      const userData = userDoc.data();
      
      if (userData?.role === 'admin' || emailPrefix === '25-14294-549') {
        setAdmin(user);
        setAuthLoading(false);
      } else {
        await signOut(auth);
        router.push('/admin/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

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
    if (!selectedVisit || !blockReason || !admin) return;
    setIsBlocking(true);
    try {
      await addDoc(collection(firestore, 'blocklist'), {
        studentId: selectedVisit.studentId,
        fullName: selectedVisit.fullName,
        reason: blockReason,
        blockedBy: admin.email,
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
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(10, 22, 40);
    doc.text("NEU Library Log — Visitor Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generation Date: ${format(now, 'PPP p')}`, 14, 28);
    
    // Stats Table
    autoTable(doc, {
      startY: 35,
      head: [['Metric', 'Count']],
      body: [
        ['Total Visitors Today', stats.today.toString()],
        ['Total Visitors This Week', stats.week.toString()],
        ['Total Visitors This Month', stats.month.toString()]
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 22, 40] }
    });

    // Log Table
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
      headStyles: { fillColor: [10, 22, 40] }
    });

    doc.save(`NEU-Library-Report-${format(now, 'yyyyMMdd')}.pdf`);
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem('adminUser');
    router.push('/admin/login');
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setActiveSection(id);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
        <p className="text-blue-100 font-medium">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0a1628] text-white flex flex-col fixed inset-y-0 shadow-2xl z-40 transition-all">
        <div className="p-8 border-b border-white/5 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.4)]">
            <Library className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none">NEU Library</h1>
            <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Admin Panel</span>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-2">
          <button 
            onClick={() => scrollTo('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === 'dashboard' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-blue-100/50 hover:bg-white/5'}`}
          >
            <LayoutDashboard className="h-5 w-5" /> Dashboard
          </button>
          <button 
            onClick={() => scrollTo('logs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeSection === 'logs' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-blue-100/50 hover:bg-white/5'}`}
          >
            <History className="h-5 w-5" /> Visitor Logs
          </button>
        </nav>

        <div className="p-6 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm shadow-xl">
              {admin?.displayName?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{admin?.displayName || 'Administrator'}</p>
              <p className="text-[10px] text-blue-100/30 truncate">{admin?.email}</p>
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
        <div id="dashboard" className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Overview</h2>
            <p className="text-slate-500 font-medium">Real-time visitor monitoring and analytics</p>
          </div>
          <Button onClick={generateReport} className="bg-blue-600 hover:bg-blue-700 rounded-xl px-8 h-14 font-black shadow-lg flex gap-2 active:scale-95 transition-all">
            <Download className="h-5 w-5" /> Generate Report
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-8">
          {[
            { label: 'Today', value: stats.today, icon: Users, color: 'border-blue-500', sub: 'active entries' },
            { label: 'This Week', value: stats.week, icon: Calendar, color: 'border-emerald-500', sub: 'last 7 days' },
            { label: 'This Month', value: stats.month, icon: TrendingUp, color: 'border-purple-500', sub: 'monthly total' }
          ].map((s, i) => (
            <Card key={i} className={`border-l-8 ${s.color} shadow-sm rounded-2xl bg-white border-t-0 border-r-0 border-b-0`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-black text-slate-400 uppercase tracking-widest">{s.label}</CardTitle>
                <div className="p-2 bg-slate-50 rounded-lg"><s.icon className="h-4 w-4 text-slate-400" /></div>
              </CardHeader>
              <CardContent>
                <div className="text-5xl font-black text-slate-900">{s.value}</div>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{s.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart Section */}
        <Card className="rounded-[2rem] shadow-sm overflow-hidden border-none bg-white p-8 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <CardTitle className="text-2xl font-black text-slate-900">Visitor Distribution</CardTitle>
              <CardDescription className="text-slate-500 font-medium">Daily visitor traffic analysis</CardDescription>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 ml-2">From</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 w-36 rounded-xl border-none bg-transparent font-bold text-slate-700" />
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-2">
                <Label className="text-[10px] font-black uppercase text-slate-400">To</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 w-36 rounded-xl border-none bg-transparent font-bold text-slate-700" />
              </div>
              <Button onClick={handleApplyRange} size="sm" className="bg-blue-600 rounded-xl px-4 h-9 font-bold">Apply</Button>
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
                  contentStyle={{ borderRadius: '1.2rem', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px 16px' }}
                />
                <Bar dataKey="count" radius={[10, 10, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === chartData.length - 1 ? '#2563eb' : '#cbd5e1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Table Section */}
        <div id="logs" className="space-y-6 pt-10">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recent Activity</h2>
            <div className="flex gap-4">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <Input placeholder="Search logs..." className="pl-11 h-12 w-80 rounded-2xl border-none bg-white shadow-sm font-medium" />
              </div>
            </div>
          </div>

          <Card className="rounded-[2rem] shadow-sm border-none overflow-hidden bg-white">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-b-slate-100">
                    <TableHead className="px-8 h-16 font-black text-slate-400 uppercase tracking-widest text-[10px]">Visitor Name</TableHead>
                    <TableHead className="h-16 font-black text-slate-400 uppercase tracking-widest text-[10px]">Program / College</TableHead>
                    <TableHead className="h-16 font-black text-slate-400 uppercase tracking-widest text-[10px]">Purpose</TableHead>
                    <TableHead className="h-16 font-black text-slate-400 uppercase tracking-widest text-[10px]">Method</TableHead>
                    <TableHead className="h-16 font-black text-slate-400 uppercase tracking-widest text-[10px]">Time</TableHead>
                    <TableHead className="h-16 text-right px-8 font-black text-slate-400 uppercase tracking-widest text-[10px]">Action</TableHead>
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
                    <TableRow key={visit.id} className="hover:bg-slate-50/30 transition-colors border-b-slate-50">
                      <TableCell className="px-8 font-bold text-slate-900">{visit.fullName}</TableCell>
                      <TableCell className="text-slate-500 font-medium">
                        <div className="flex flex-col">
                           <span className="text-slate-700 font-bold">{visit.program || 'Staff/Visitor'}</span>
                           <span className="text-[10px] uppercase font-bold text-slate-400">{visit.college}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-4 py-1.5 font-bold rounded-full text-[10px] uppercase">
                          {visit.purpose}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-none px-4 py-1.5 font-bold rounded-full text-[10px] uppercase ${visit.loginMethod === 'google' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {visit.loginMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400 font-medium text-xs">
                        {format(visit.timestamp.toDate(), 'MMM dd, p')}
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="rounded-full px-6 h-9 font-black shadow-sm bg-red-500 hover:bg-red-600 active:scale-95 transition-all text-[10px] uppercase" onClick={() => setSelectedVisit(visit)}>
                              Block
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-[2rem] border-none shadow-2xl p-10 max-w-lg">
                            <DialogHeader className="space-y-4">
                              <DialogTitle className="text-3xl font-black text-slate-900">Block Access</DialogTitle>
                              <DialogDescription className="text-slate-500 text-lg leading-relaxed">
                                Are you sure you want to restrict <span className="text-slate-900 font-bold underline decoration-red-400 underline-offset-4">{selectedVisit?.fullName}</span>? This takes effect immediately at all kiosks.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-8 space-y-3">
                              <Label className="font-black text-slate-900 text-xs uppercase tracking-widest ml-1">Reason for blocking</Label>
                              <Textarea 
                                placeholder="Describe the violation..." 
                                className="rounded-2xl border-slate-100 bg-slate-50 focus:bg-white transition-all min-h-[140px] p-5 font-medium"
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                              />
                            </div>
                            <DialogFooter className="gap-4">
                              <Button variant="outline" className="rounded-2xl h-14 px-8 font-black border-slate-200" onClick={() => setSelectedVisit(null)}>Cancel</Button>
                              <Button 
                                variant="destructive" 
                                className="rounded-2xl h-14 px-10 font-black shadow-lg shadow-red-500/30"
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
              <div className="p-8 border-t border-slate-50 flex justify-between items-center bg-slate-50/20">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                  Showing <span className="text-slate-900">{paginatedVisits.length}</span> / {allVisits?.length || 0} logs
                </p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="rounded-xl h-10 px-6 font-black border-slate-200 text-xs uppercase disabled:opacity-30" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    Prev
                  </Button>
                  <Button 
                    variant="outline" 
                    className="rounded-xl h-10 px-6 font-black border-slate-200 text-xs uppercase disabled:opacity-30" 
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