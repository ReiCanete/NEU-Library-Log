"use client";

import { useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Download, Loader2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection, useUser } from '@/firebase';
import { auth, db as firestore } from '@/firebase/config';
import { collection, query, orderBy, limit, where, Timestamp, addDoc } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfDay, subDays, isSameDay } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AdminDashboard() {
  const { user: currentUser } = useUser();
  const { toast } = useToast();
  
  // Date states
  const todayStart = startOfDay(new Date());
  const weekAgo = subDays(todayStart, 7);
  const monthAgo = subDays(todayStart, 30);

  // Firestore Queries
  const recentVisitsQuery = useMemo(() => {
    return query(collection(firestore, 'visits'), orderBy('timestamp', 'desc'), limit(10));
  }, []);

  const statsQuery = useMemo(() => {
    return query(collection(firestore, 'visits'), where('timestamp', '>=', monthAgo));
  }, [monthAgo]);

  const { data: recentVisits, loading: visitsLoading } = useCollection(recentVisitsQuery);
  const { data: allStats, loading: statsLoading } = useCollection(statsQuery);

  // Derived Stats
  const stats = useMemo(() => {
    if (!allStats) return { today: 0, week: 0, month: 0 };
    return {
      today: allStats.filter(v => v.timestamp.toDate() >= todayStart).length,
      week: allStats.filter(v => v.timestamp.toDate() >= weekAgo).length,
      month: allStats.length
    };
  }, [allStats, todayStart, weekAgo]);

  // Chart Data (Last 7 days)
  const chartData = useMemo(() => {
    if (!allStats) return [];
    const days = Array.from({ length: 7 }, (_, i) => subDays(todayStart, 6 - i));
    return days.map(day => {
      const count = allStats.filter(v => isSameDay(v.timestamp.toDate(), day)).length;
      return {
        name: format(day, 'EEE'),
        count,
        fullDate: format(day, 'MMM dd')
      };
    });
  }, [allStats, todayStart]);

  // Block Modal State
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlockUser = async () => {
    if (!selectedStudent || !blockReason || !currentUser) return;
    
    setIsBlocking(true);
    try {
      await addDoc(collection(firestore, 'blocklist'), {
        studentId: selectedStudent.studentId,
        reason: blockReason,
        blockedBy: currentUser.displayName || currentUser.email,
        blockedAt: Timestamp.now()
      });

      toast({
        title: "User Blocked",
        description: `Student ID ${selectedStudent.studentId} has been added to the blocklist.`,
      });
      setSelectedStudent(null);
      setBlockReason('');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to block user. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsBlocking(false);
    }
  };

  const exportReport = () => {
    if (!allStats || !recentVisits) return;
    
    const doc = new jsPDF();
    const now = new Date();
    
    doc.setFontSize(22);
    doc.setTextColor(23, 37, 84); 
    doc.text("NEU Library Log", 14, 20);
    
    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Generated on: ${format(now, 'PPP p')}`, 14, 30);
    
    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text("Visitor Statistics", 14, 45);
    
    autoTable(doc, {
      startY: 50,
      head: [['Metric', 'Count']],
      body: [
        ['Visitors Today', stats.today.toString()],
        ['Visitors This Week', stats.week.toString()],
        ['Visitors This Month', stats.month.toString()]
      ],
      theme: 'striped',
      headStyles: { fillStyle: 'fill', fillColor: [23, 37, 84] }
    });

    doc.text("Recent Activity", 14, doc.lastAutoTable.finalY + 15);
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      head: [['Visitor', 'College', 'Purpose', 'Method', 'Time']],
      body: recentVisits.map(v => [
        v.fullName,
        v.college,
        v.purpose,
        v.loginMethod,
        format(v.timestamp.toDate(), 'MMM dd, hh:mm a')
      ]),
      theme: 'grid',
      headStyles: { fillStyle: 'fill', fillColor: [23, 37, 84] }
    });

    doc.save(`NEU_Library_Report_${format(now, 'yyyyMMdd')}.pdf`);
  };

  return (
    <AdminLayout>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-primary">Library Overview</h2>
            <p className="text-muted-foreground">Real-time visitor statistics and analytics</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={exportReport} className="flex items-center gap-2" disabled={statsLoading} suppressHydrationWarning>
              <Download className="h-4 w-4" />
              Download PDF Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Visitors</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-10 w-20" /> : <div className="text-4xl font-bold">{stats.today}</div>}
              <p className="text-xs text-muted-foreground mt-1">Snapshot of the day</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
              <Calendar className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-10 w-20" /> : <div className="text-4xl font-bold">{stats.week}</div>}
              <p className="text-xs text-muted-foreground mt-1">Last 7 rolling days</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-indigo-500 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
              <TrendingUp className="h-5 w-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              {statsLoading ? <Skeleton className="h-10 w-20" /> : <div className="text-4xl font-bold">{stats.month}</div>}
              <p className="text-xs text-muted-foreground mt-1">Total visitor engagement</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Visitor Distribution</CardTitle>
              <CardDescription>Daily count for the last 7 days</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {statsLoading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      labelStyle={{ fontWeight: 'bold' }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 6 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.4)'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Latest Activity</CardTitle>
              <CardDescription>Real-time entry feed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {visitsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-2/3" />
                      </div>
                    </div>
                  ))
                ) : recentVisits && recentVisits.length > 0 ? (
                  recentVisits.slice(0, 5).map((visit) => (
                    <div key={visit.id} className="flex items-center gap-4 animate-in slide-in-from-right-4 duration-300">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                        {visit.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{visit.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{visit.purpose}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">{format(visit.timestamp.toDate(), 'hh:mm a')}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center py-10 text-muted-foreground">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Logs</CardTitle>
            <CardDescription>Detailed visitor history</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visitor</TableHead>
                  <TableHead>College</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : recentVisits?.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="font-medium">{visit.fullName}</TableCell>
                    <TableCell>{visit.college}</TableCell>
                    <TableCell>{visit.purpose}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {visit.loginMethod}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(visit.timestamp.toDate(), 'MMM dd, hh:mm a')}</TableCell>
                    <TableCell className="text-right">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setSelectedStudent(visit)}
                            suppressHydrationWarning
                          >
                            Block
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Block Student Access</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to block <strong>{selectedStudent?.fullName}</strong> ({selectedStudent?.studentId})? They will be unable to log in until the block is removed.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="reason">Reason for Blocking</Label>
                              <Textarea 
                                id="reason" 
                                placeholder="State the reason for access restriction..." 
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setSelectedStudent(null)} suppressHydrationWarning>Cancel</Button>
                            <Button 
                              variant="destructive" 
                              disabled={isBlocking || !blockReason} 
                              onClick={handleBlockUser}
                              suppressHydrationWarning
                            >
                              {isBlocking ? "Processing..." : "Confirm Block"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
