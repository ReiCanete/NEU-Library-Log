"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Download, Loader2, Library, LayoutDashboard, History, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection, useUser } from '@/firebase';
import { auth, db as firestore } from '@/firebase/config';
import { collection, query, orderBy, limit, where, Timestamp, addDoc, getDoc, doc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfDay, subDays, isSameDay, startOfWeek, startOfMonth } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminDashboard() {
  const router = useRouter();
  const { user: currentUser, loading: authLoading } = useUser();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Date filters
  const todayStart = startOfDay(new Date());
  const weekStart = startOfWeek(new Date());
  const monthStart = startOfMonth(new Date());

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/admin/login');
    } else if (currentUser) {
      const checkAdmin = async () => {
        const userDoc = await getDoc(doc(firestore, 'users', currentUser.uid));
        const userData = userDoc.data();
        const hasAdminAccess = userData?.role === 'admin' || userData?.studentId === '25-14294-549';

        if (userDoc.exists() && hasAdminAccess) {
          setIsAdmin(true);
        } else {
          toast({ title: "Unauthorized", description: "Admin permissions required.", variant: "destructive" });
          router.push('/admin/login');
        }
      };
      checkAdmin();
    }
  }, [currentUser, authLoading, router, toast]);

  // Firestore Queries
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

  // Chart data (Last 7 days)
  const chartData = useMemo(() => {
    if (!allVisits) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const day = subDays(todayStart, 6 - i);
      const count = allVisits.filter(v => isSameDay(v.timestamp.toDate(), day)).length;
      return { name: format(day, 'EEE'), count };
    });
  }, [allVisits, todayStart]);

  // Pagination logic
  const paginatedVisits = useMemo(() => {
    if (!allVisits) return [];
    const start = (currentPage - 1) * itemsPerPage;
    return allVisits.slice(start, start + itemsPerPage);
  }, [allVisits, currentPage]);

  // Block User State
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlockUser = async () => {
    if (!selectedVisit || !blockReason || !currentUser) return;
    setIsBlocking(true);
    try {
      await addDoc(collection(firestore, 'blocklist'), {
        studentId: selectedVisit.studentId,
        fullName: selectedVisit.fullName,
        reason: blockReason,
        blockedBy: currentUser.displayName || currentUser.email,
        blockedAt: Timestamp.now()
      });
      toast({ title: "Visitor Blocked", description: `${selectedVisit.fullName} has been added to the blocklist.` });
      setSelectedVisit(null);
      setBlockReason('');
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsBlocking(false);
    }
  };

  const generateReport = () => {
    if (!allVisits) return;
    const doc = new jsPDF();
    const now = new Date();
    doc.setFontSize(22);
    doc.setTextColor(10, 22, 40);
    doc.text("NEU Library Visitor Log Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${format(now, 'PPP p')}`, 14, 30);
    
    autoTable(doc, {
      startY: 40,
      head: [['Metric', 'Value']],
      body: [
        ['Total Visitors Today', stats.today.toString()],
        ['Total Visitors This Week', stats.week.toString()],
        ['Total Visitors This Month', stats.month.toString()]
      ],
      theme: 'grid',
      headStyles: { fillColor: [10, 22, 40] }
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 15,
      head: [['Visitor Name', 'College', 'Purpose', 'Method', 'Timestamp']],
      body: allVisits.map(v => [
        v.fullName,
        v.college,
        v.purpose,
        v.loginMethod,
        format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')
      ]),
      theme: 'striped',
      headStyles: { fillColor: [10, 22, 40] }
    });
    doc.save(`NEU_Library_Report_${format(now, 'yyyyMMdd')}.pdf`);
  };

  if (authLoading || isAdmin === null) {
    return (
      <div className="min-h-screen bg-[#0a1628] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f1f5f9]">
      {/* Sidebar */}
      <aside className="w-72 bg-[#0a1628] text-white flex flex-col fixed inset-y-0 shadow-2xl z-30">
        <div className="p-8 border-b border-white/10 flex items-center gap-4">
          <div className="bg-blue-500 p-2 rounded-xl">
            <Library className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-xl font-black tracking-tight">NEU Library</h1>
        </div>
        <nav className="flex-1 p-6 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-blue-100/60 hover:bg-white/5'}`}
          >
            <LayoutDashboard className="h-5 w-5" /> Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('logs')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'logs' ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-blue-100/60 hover:bg-white/5'}`}
          >
            <History className="h-5 w-5" /> Visitor Logs
          </button>
        </nav>
        <div className="p-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-10 w-10 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm">
              {currentUser?.displayName?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{currentUser?.displayName}</p>
              <p className="text-xs text-blue-100/40 truncate">{currentUser?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-400/10 transition-all"
          >
            <LogOut className="h-5 w-5" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-72 flex-1 p-10 space-y-10 animate-in fade-in duration-700">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-slate-900 capitalize">{activeTab}</h2>
            <p className="text-slate-500 font-medium">Manage and monitor library activities</p>
          </div>
          <Button onClick={generateReport} className="bg-blue-600 hover:bg-blue-700 rounded-xl px-6 h-12 font-bold shadow-lg flex gap-2">
            <Download className="h-5 w-5" /> Generate Report
          </Button>
        </div>

        {activeTab === 'dashboard' ? (
          <div className="space-y-10">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-8">
              {[
                { label: 'Today', value: stats.today, icon: Users, color: 'border-blue-500' },
                { label: 'This Week', value: stats.week, icon: Calendar, color: 'border-emerald-500' },
                { label: 'This Month', value: stats.month, icon: TrendingUp, color: 'border-purple-500' }
              ].map((s, i) => (
                <Card key={i} className={`border-l-8 ${s.color} shadow-sm rounded-2xl`}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold text-slate-400 uppercase tracking-widest">{s.label}</CardTitle>
                    <s.icon className="h-5 w-5 text-slate-400" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-5xl font-black text-slate-900">{s.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Chart */}
            <Card className="rounded-3xl shadow-sm overflow-hidden border-none">
              <CardHeader className="p-8 pb-0">
                <CardTitle className="text-2xl font-black text-slate-900">Visitor Distribution</CardTitle>
                <CardDescription className="text-slate-500 font-medium">Daily count for the last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px] p-8 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 6 ? '#2563eb' : '#cbd5e1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="rounded-3xl shadow-sm border-none overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-8 h-16 font-bold text-slate-500">Visitor Name</TableHead>
                    <TableHead className="h-16 font-bold text-slate-500">College</TableHead>
                    <TableHead className="h-16 font-bold text-slate-500">Purpose</TableHead>
                    <TableHead className="h-16 font-bold text-slate-500">Method</TableHead>
                    <TableHead className="h-16 font-bold text-slate-500">Time</TableHead>
                    <TableHead className="h-16 text-right px-8 font-bold text-slate-500">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitsLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6} className="px-8"><Skeleton className="h-12 w-full rounded-xl" /></TableCell>
                      </TableRow>
                    ))
                  ) : paginatedVisits.map((visit) => (
                    <TableRow key={visit.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="px-8 font-bold text-slate-900">{visit.fullName}</TableCell>
                      <TableCell className="text-slate-600 font-medium">{visit.college}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-3 py-1 font-bold">
                          {visit.purpose}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-slate-200 text-slate-500 px-3 py-1 font-bold uppercase tracking-tighter">
                          {visit.loginMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500 font-medium">
                        {format(visit.timestamp.toDate(), 'MMM dd, p')}
                      </TableCell>
                      <TableCell className="text-right px-8">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="rounded-full px-4 h-8 font-bold shadow-sm" onClick={() => setSelectedVisit(visit)}>
                              Block
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-3xl border-none">
                            <DialogHeader>
                              <DialogTitle className="text-2xl font-black">Block Access</DialogTitle>
                              <DialogDescription className="text-slate-500 font-medium pt-2">
                                Are you sure you want to block <span className="text-slate-900 font-bold">{selectedVisit?.fullName}</span>? They will be restricted from entering the library.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-6 space-y-2">
                              <Label className="font-bold text-slate-900">Reason for blocking</Label>
                              <Textarea 
                                placeholder="State the reason clearly..." 
                                className="rounded-xl border-slate-200 min-h-[120px]"
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                              />
                            </div>
                            <DialogFooter className="gap-2">
                              <Button variant="outline" className="rounded-xl h-12 px-6 font-bold" onClick={() => setSelectedVisit(null)}>Cancel</Button>
                              <Button 
                                variant="destructive" 
                                className="rounded-xl h-12 px-8 font-bold"
                                disabled={isBlocking || !blockReason}
                                onClick={handleBlockUser}
                              >
                                {isBlocking ? "Blocking..." : "Confirm Block"}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-8 border-t border-slate-100 flex justify-between items-center bg-slate-50/30">
                <p className="text-sm text-slate-500 font-medium">
                  Showing <span className="font-bold text-slate-900">{paginatedVisits.length}</span> of <span className="font-bold text-slate-900">{allVisits?.length || 0}</span> entries
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="rounded-xl font-bold" 
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    className="rounded-xl font-bold" 
                    disabled={!allVisits || currentPage * itemsPerPage >= allVisits.length}
                    onClick={() => setCurrentPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
