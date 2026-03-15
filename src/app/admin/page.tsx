
'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Loader2, RefreshCcw, Sparkles, BookOpen, GraduationCap, ArrowUpRight, ArrowDownRight, Settings2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, Timestamp } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { format, startOfDay, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { logAppError } from '@/lib/errorMessages';

function CountUp({ value, error }: { value: number; error?: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (error) return;
    let start = 0;
    const end = value;
    if (start === end) {
      setCount(end);
      return;
    }
    const duration = 1000;
    const increment = Math.ceil(end / (duration / 16)) || 1;
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(start);
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, error]);

  if (error) return <span className="flex items-center gap-2">— <AlertTriangle className="h-4 w-4 text-red-500" /></span>;
  return <>{count}</>;
}

const ABBREVIATIONS: Record<string, string> = {
  "College of Informatics and Computing Studies": "CICS",
  "College of Engineering and Architecture": "CEA",
  "College of Business Administration": "CBA",
  "College of Arts and Sciences": "CAS",
  "College of Accountancy": "COA",
  "College of Education": "COE",
  "College of Medical Technology": "CMT",
  "College of Nursing": "CON",
  "College of Agriculture": "CAG",
  "College of Music": "CMU",
  "College of Physical Therapy": "CPT",
  "College of Respiratory Therapy": "CRT",
  "College of Criminology": "CC",
  "College of Midwifery": "CMID",
  "College of Communication": "CCOM",
  "School of International Relations": "SIR"
};

const PURPOSE_COLORS: Record<string, string> = {
  "Reading Books": "#1a5c2e",
  "Research / Study": "#c9a227",
  "Computer / Internet": "#0d7377",
  "Group Discussion": "#4a7c59",
  "Thesis / Archival": "#8b6914",
  "Other Purpose": "#9ca3af"
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [newCapacity, setNewCapacity] = useState('');

  const todayDate = useMemo(() => startOfDay(new Date()), []);
  
  const visitsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'visits'), orderBy('timestamp', 'desc'));
  }, [db]);
  
  const { data: allVisits, loading: visitsLoading, error: visitsError } = useCollection(visitsQuery);
  
  const settingsRef = useMemo(() => (db ? doc(db, 'settings', 'library') : null), [db]);
  const { data: settings } = useDoc(settingsRef);

  const dailyCapacity = settings?.dailyCapacity || 200;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
      toast({ title: "Metrics Updated", description: "Latest database snapshots loaded." });
    }, 800);
  };

  const updateCapacity = async () => {
    if (!db || !auth) return;
    const val = parseInt(newCapacity);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Invalid Input", description: "Capacity must be a positive number.", variant: "destructive" });
      return;
    }
    try {
      await setDoc(doc(db, 'settings', 'library'), {
        dailyCapacity: val,
        lastUpdatedBy: auth?.currentUser?.email || 'Admin',
        updatedAt: Timestamp.now()
      }, { merge: true });
      toast({ title: "Threshold Updated", description: `Daily capacity set to ${val}.` });
      setIsEditingCapacity(false);
    } catch (e: any) {
      logAppError('Dashboard', 'UpdateCapacity', e);
      toast({ title: "Failed", description: "Could not update capacity. Check permissions.", variant: "destructive" });
    }
  };

  const stats = useMemo(() => {
    if (!allVisits || !todayDate) return { today: 0, yesterday: 0, week: 0, month: 0 };
    const yesterdayDate = subDays(todayDate, 1);
    const weekDate = subDays(todayDate, 7);
    const monthDate = subDays(todayDate, 30);
    
    return {
      today: allVisits.filter(v => v.timestamp.toDate() >= todayDate).length,
      yesterday: allVisits.filter(v => {
        const d = v.timestamp.toDate();
        return d >= yesterdayDate && d < todayDate;
      }).length,
      week: allVisits.filter(v => v.timestamp.toDate() >= weekDate).length,
      month: allVisits.filter(v => v.timestamp.toDate() >= monthDate).length
    };
  }, [allVisits, todayDate]);

  const purposeData = useMemo(() => {
    if (!allVisits) return [];
    const counts: Record<string, number> = {};
    allVisits.forEach(v => { counts[v.purpose] = (counts[v.purpose] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allVisits]);

  const collegeData = useMemo(() => {
    if (!allVisits) return [];
    const counts: Record<string, number> = {};
    allVisits.forEach(v => { 
      const college = v.college || 'Other';
      const label = ABBREVIATIONS[college] || college;
      counts[label] = (counts[label] || 0) + 1; 
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count).slice(0, 5);
  }, [allVisits]);

  return (
    <AdminLayout>
      <title>NEU Library Log — Dashboard</title>
      <div className="space-y-8">
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-[#d4e4d8] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#1a3a2a] rounded-xl text-[#c9a227]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-[#1a3a2a]">System Overview</h2>
              <p className="text-xs tracking-widest text-[#4a6741] uppercase mt-1">Live Institutional Metrics</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Dialog open={isEditingCapacity} onOpenChange={setIsEditingCapacity}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-10 px-4 rounded-xl border-[#d4e4d8] font-semibold text-[#1a3a2a] flex gap-2">
                  <Settings2 className="h-4 w-4" />
                  CAPACITY: {dailyCapacity}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl p-6 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-xl font-bold text-[#1a3a2a]">Daily Threshold</DialogTitle>
                  <DialogDescription className="text-xs text-[#4a6741] font-medium uppercase tracking-widest">Maximum kiosk entries allowed per day.</DialogDescription>
                </DialogHeader>
                <div className="py-6">
                  <Input type="number" placeholder="200" className="h-14 rounded-xl bg-[#f0f4f1] border-none font-bold text-xl text-center" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button className="w-full h-12 rounded-xl bg-[#1a3a2a] font-bold" onClick={updateCapacity}>Apply Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleRefresh} disabled={isRefreshing} variant="ghost" className="h-10 w-10 p-0 rounded-xl hover:bg-[#f0f4f1]">
              <RefreshCcw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: 'Visits Today', value: stats.today, prev: stats.yesterday, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Weekly Traffic', value: stats.week, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Monthly Total', value: stats.month, icon: TrendingUp, color: 'text-[#1a3a2a]', bg: 'bg-slate-100' }
          ].map((s, i) => (
            <Card key={i} className="border border-[#d4e4d8] shadow-sm rounded-2xl bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${s.bg}`}>
                  <s.icon className={`h-6 w-6 ${s.color}`} />
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-[#4a6741] uppercase tracking-[0.15em]">{s.label}</p>
                  <h3 className="text-3xl font-bold text-[#1a3a2a] tabular-nums mt-1">
                    {visitsLoading ? <Skeleton className="h-8 w-16 ml-auto rounded-lg" /> : <CountUp value={s.value} error={!!visitsError} />}
                  </h3>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] font-bold text-[#4a6741]/50 uppercase tracking-widest pt-4 border-t border-[#f0f4f1]">
                <span>Sync Active</span>
                {s.prev !== undefined && s.value >= s.prev ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-red-400" />}
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-2xl shadow-sm border border-[#d4e4d8] bg-white p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#1a3a2a]">Activity Analytics</h3>
                <p className="text-[10px] text-[#4a6741] font-bold uppercase tracking-widest">Visit purpose distribution</p>
              </div>
              <BookOpen className="h-6 w-6 text-[#c9a227]" />
            </div>
            <div className="h-[300px] w-full">
              {visitsLoading ? <Skeleton className="h-full w-full rounded-2xl" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={purposeData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                      {purposeData.map((entry, index) => <Cell key={`cell-${index}`} fill={PURPOSE_COLORS[entry.name] || '#9ca3af'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="rounded-2xl shadow-sm border border-[#d4e4d8] bg-white p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-lg font-bold text-[#1a3a2a]">College Demographics</h3>
                <p className="text-[10px] text-[#4a6741] font-bold uppercase tracking-widest">Top 5 active colleges</p>
              </div>
              <GraduationCap className="h-6 w-6 text-[#1a3a2a]" />
            </div>
            <div className="h-[300px] w-full">
              {visitsLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collegeData} layout="vertical" margin={{ left: 10, right: 30, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fill: '#4a6741', fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip cursor={{ fill: '#f0f4f1' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                    <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={24}>
                      {collegeData.map((entry, index) => <Cell key={`cell-${index}`} fill={index === 0 ? '#1a3a2a' : '#c9a227'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
