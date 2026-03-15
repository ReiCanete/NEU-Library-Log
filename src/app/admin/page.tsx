'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Loader2, RefreshCcw, Sparkles, BookOpen, GraduationCap, Clock, ArrowUpRight, ArrowDownRight, Settings2, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, Timestamp } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { format, startOfDay, getHours, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from "@/components/ui/alert";
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

  if (error) return <span className="flex items-center gap-2">— <AlertTriangle className="h-3 w-3 text-red-500" /></span>;
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
  "Other Purpose": "#6b7280"
};

export default function AdminDashboard() {
  const { toast } = useToast();
  const db = useFirestore();
  const auth = useAuth();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);
  const [newCapacity, setNewCapacity] = useState('');

  const todayDate = useMemo(() => typeof window !== 'undefined' ? startOfDay(new Date()) : null, []);
  
  const visitsQuery = useMemo(() => {
    if (typeof window === 'undefined' || !db) return null;
    return query(collection(db, 'visits'), orderBy('timestamp', 'desc'));
  }, [db]);
  
  const { data: allVisits, loading: visitsLoading, error: visitsError } = useCollection(visitsQuery);
  
  const settingsRef = useMemo(() => (typeof window !== 'undefined' && db) ? doc(db, 'settings', 'library') : null, [db]);
  const { data: settings, error: settingsError } = useDoc(settingsRef);

  const dailyCapacity = settings?.dailyCapacity || 200;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
      toast({ title: "Dashboard Synchronized", description: "Latest metrics loaded." });
    }, 600);
  };

  const updateCapacity = async () => {
    if (!db || !auth) return;
    const val = parseInt(newCapacity);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Invalid Input", description: "Please enter a positive number.", variant: "destructive" });
      return;
    }
    try {
      await setDoc(doc(db, 'settings', 'library'), {
        dailyCapacity: val,
        lastUpdatedBy: auth?.currentUser?.email || 'Admin',
        updatedAt: Timestamp.now()
      }, { merge: true });
      toast({ title: "Settings Saved", description: `Daily capacity updated to ${val}.` });
      setIsEditingCapacity(false);
    } catch (e: any) {
      logAppError('Dashboard', 'UpdateCapacity', e);
      toast({ title: "Update Failed", description: e.message, variant: "destructive" });
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

  const insights = useMemo(() => {
    if (!allVisits || allVisits.length === 0) return { peakHour: '--', activeDay: '--', topPurpose: '--' };
    const hours: Record<number, number> = {};
    const days: Record<string, number> = {};
    const purposes: Record<string, number> = {};
    allVisits.forEach(v => {
      const date = v.timestamp.toDate();
      const h = getHours(date);
      const d = format(date, 'EEEE');
      hours[h] = (hours[h] || 0) + 1;
      days[d] = (days[d] || 0) + 1;
      purposes[v.purpose] = (purposes[v.purpose] || 0) + 1;
    });
    const peakH = Object.entries(hours).sort((a, b) => b[1] - a[1])[0]?.[0];
    const activeD = Object.entries(days).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topP = Object.entries(purposes).sort((a, b) => b[1] - a[1])[0]?.[0];
    return {
      peakHour: peakH !== undefined ? format(new Date().setHours(Number(peakH)), 'hh:00 a') : '--',
      activeDay: activeD || '--',
      topPurpose: topP || '--'
    };
  }, [allVisits]);

  return (
    <AdminLayout>
      <div className="space-y-8 pb-10">
        {visitsError && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-800 rounded-xl mb-6">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="font-bold text-[10px] uppercase tracking-widest">
                  Live data connection unstable. Showing cached metrics.
                </AlertDescription>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-[9px] font-black" onClick={() => window.location.reload()}>Retry Sync</Button>
            </div>
          </Alert>
        )}

        <div className="bg-gradient-to-br from-[#0a2a1a] to-[#1a5c2e] rounded-3xl p-8 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-6 border-b-2 border-[#c9a227]">
          <div className="z-10 text-center sm:text-left space-y-2">
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <img src="/neu-logo.png" alt="Logo" className="h-8 w-8 rounded-full" />
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                Overview <Sparkles className="h-4 w-4 text-[#c9a227]" />
              </h2>
            </div>
            <p className="text-white/60 font-medium text-sm">
              Today: <span className="text-[#c9a227] font-black">{stats.today}</span> visitors logged in.
            </p>
          </div>
          <div className="flex items-center gap-3 z-10">
            <Dialog open={isEditingCapacity} onOpenChange={setIsEditingCapacity}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl h-11 px-5 font-black flex gap-2 text-xs">
                  <Settings2 className="h-4 w-4 text-[#c9a227]" />
                  Limit: {dailyCapacity}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl p-6 max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black text-[#1a3a2a]">Daily Capacity</DialogTitle>
                  <DialogDescription className="font-medium text-xs text-[#4a6741]">Max visitors allowed per day.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input type="number" className="h-12 rounded-lg bg-[#f0f4f1] border-none font-black text-xl text-center" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button className="w-full h-11 rounded-lg bg-[#1a3a2a] font-black text-sm" onClick={updateCapacity}>Save Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleRefresh} disabled={isRefreshing} className="bg-white/10 hover:bg-white/20 text-white border-white/20 rounded-xl h-11 px-5 font-black text-xs">
              {isRefreshing ? <Loader2 className="animate-spin h-4 w-4" /> : <RefreshCcw className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { label: 'Today\'s Visits', value: stats.today, prev: stats.yesterday, icon: Users, circle: 'bg-emerald-50', iconColor: 'text-emerald-600' },
            { label: 'Weekly Total', value: stats.week, icon: Calendar, circle: 'bg-amber-50', iconColor: 'text-amber-600' },
            { label: 'Monthly Traffic', value: stats.month, icon: TrendingUp, circle: 'bg-slate-100', iconColor: 'text-[#0a2a1a]' }
          ].map((s, i) => (
            <Card key={i} className="border-none shadow-lg rounded-2xl bg-white overflow-hidden group hover:translate-y-[-2px] transition-all border-t-2 border-[#c9a227]">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-6">
                <div className={`p-3 rounded-xl ${s.circle}`}>
                  <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
                <div className="text-right">
                  <CardTitle className="text-[9px] font-black text-[#4a6741] uppercase tracking-widest">{s.label}</CardTitle>
                  <div className="text-3xl font-black text-[#1a3a2a] mt-1 tabular-nums">
                    {visitsLoading ? <Skeleton className="h-8 w-16 ml-auto" /> : <CountUp value={s.value} error={!!visitsError} />}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-6 pb-5 pt-0 flex justify-between items-center text-[8px] font-bold text-[#4a6741]/50 uppercase tracking-widest">
                <span>Updated recently</span>
                {s.prev !== undefined && s.value >= s.prev ? <ArrowUpRight className="h-3 w-3 text-emerald-500" /> : <ArrowDownRight className="h-3 w-3 text-red-400" />}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-3xl shadow-lg border border-[#d4e4d8] bg-white p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-[#1a3a2a] tracking-tight">Visit Purpose</h3>
                <p className="text-[9px] text-[#4a6741] font-bold uppercase tracking-widest">Category Distribution</p>
              </div>
              <BookOpen className="h-4 w-4 text-[#c9a227]" />
            </div>
            <div className="h-[300px] w-full relative flex items-center justify-center">
              {visitsLoading ? <Skeleton className="h-48 w-48 rounded-full" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={purposeData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                      {purposeData.map((entry, index) => <Cell key={`cell-${index}`} fill={PURPOSE_COLORS[entry.name] || '#ccc'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px', fontWeight: 'bold' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="rounded-3xl shadow-lg border border-[#d4e4d8] bg-white p-8 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-[#1a3a2a] tracking-tight">Active Colleges</h3>
                <p className="text-[9px] text-[#4a6741] font-bold uppercase tracking-widest">Top Visitor Groups</p>
              </div>
              <GraduationCap className="h-4 w-4 text-[#1a3a2a]" />
            </div>
            <div className="h-[300px] w-full">
              {visitsLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full rounded-lg" />)}</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collegeData} layout="vertical" margin={{ left: 10, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={80} axisLine={false} tickLine={false} tick={{ fill: '#4a6741', fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip cursor={{ fill: '#f0f4f1' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '11px' }} />
                    <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={24}>
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
