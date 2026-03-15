'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Loader2, RefreshCcw, Sparkles, BookOpen, GraduationCap, ArrowUpRight, ArrowDownRight, Settings2, AlertTriangle } from 'lucide-react';
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
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2rem] border border-[#d4e4d8] shadow-sm gap-6">
          <div className="flex items-center gap-6">
            <div className="h-20 w-20 bg-[#0a2a1a] rounded-[1.5rem] flex items-center justify-center shadow-xl">
              <Sparkles className="h-10 w-10 text-[#c9a227]" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-[#1a3a2a] tracking-tight uppercase">System Overview</h2>
              <p className="text-sm font-bold text-[#4a6741] uppercase tracking-widest mt-1 flex items-center gap-2">
                Live Metrics • <span className="text-[#c9a227]">{stats.today} recorded today</span>
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <Dialog open={isEditingCapacity} onOpenChange={setIsEditingCapacity}>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-14 px-8 rounded-2xl border-[#d4e4d8] font-black flex gap-3 text-sm">
                  <Settings2 className="h-5 w-5 text-[#c9a227]" />
                  CAPACITY: {dailyCapacity}
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[2rem] p-8 max-w-sm border-none shadow-2xl">
                <DialogHeader className="space-y-2">
                  <DialogTitle className="text-2xl font-black text-[#1a3a2a]">Daily Threshold</DialogTitle>
                  <DialogDescription className="font-bold text-xs text-[#4a6741] uppercase tracking-widest">Configure maximum kiosk entries.</DialogDescription>
                </DialogHeader>
                <div className="py-6">
                  <Input type="number" placeholder="200" className="h-16 rounded-2xl bg-[#f0f4f1] border-none font-black text-2xl text-center" value={newCapacity} onChange={(e) => setNewCapacity(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button className="w-full h-14 rounded-2xl bg-[#1a3a2a] font-black text-base" onClick={updateCapacity}>Apply Settings</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleRefresh} disabled={isRefreshing} className="h-14 w-14 rounded-2xl bg-[#f0f4f1] text-[#1a3a2a] hover:bg-[#d4e4d8] border-none p-0">
              {isRefreshing ? <Loader2 className="animate-spin h-6 w-6" /> : <RefreshCcw className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { label: 'Visits Today', value: stats.today, prev: stats.yesterday, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Weekly Traffic', value: stats.week, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Monthly Total', value: stats.month, icon: TrendingUp, color: 'text-[#1a3a2a]', bg: 'bg-slate-100' }
          ].map((s, i) => (
            <Card key={i} className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group hover:translate-y-[-4px] transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-8">
                <div className={`p-4 rounded-2xl ${s.bg}`}>
                  <s.icon className={`h-8 w-8 ${s.color}`} />
                </div>
                <div className="text-right">
                  <CardTitle className="text-xs font-black text-[#4a6741] uppercase tracking-widest leading-none">{s.label}</CardTitle>
                  <div className="text-4xl font-black text-[#1a3a2a] mt-2 tabular-nums">
                    {visitsLoading ? <Skeleton className="h-10 w-24 ml-auto rounded-xl" /> : <CountUp value={s.value} error={!!visitsError} />}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-8 pb-8 pt-0 flex justify-between items-center text-[10px] font-black text-[#4a6741]/40 uppercase tracking-[0.2em]">
                <span>Cloud Synced</span>
                {s.prev !== undefined && s.value >= s.prev ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-400" />}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="rounded-[3rem] shadow-xl border border-[#d4e4d8] bg-white p-10 space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#1a3a2a] tracking-tight uppercase">Activity Analytics</h3>
                <p className="text-xs text-[#4a6741] font-bold uppercase tracking-widest">Visit purpose distribution</p>
              </div>
              <BookOpen className="h-8 w-8 text-[#c9a227]" />
            </div>
            <div className="h-[350px] w-full">
              {visitsLoading ? <Skeleton className="h-full w-full rounded-3xl" /> : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={purposeData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">
                      {purposeData.map((entry, index) => <Cell key={`cell-${index}`} fill={PURPOSE_COLORS[entry.name] || '#ccc'} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '20px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="rounded-[3rem] shadow-xl border border-[#d4e4d8] bg-white p-10 space-y-8">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#1a3a2a] tracking-tight uppercase">College Metrics</h3>
                <p className="text-xs text-[#4a6741] font-bold uppercase tracking-widest">Top 5 visitor demographics</p>
              </div>
              <GraduationCap className="h-8 w-8 text-[#1a3a2a]" />
            </div>
            <div className="h-[350px] w-full">
              {visitsLoading ? <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}</div> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={collegeData} layout="vertical" margin={{ left: 20, right: 40, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} tick={{ fill: '#4a6741', fontSize: 11, fontWeight: 'bold' }} />
                    <Tooltip cursor={{ fill: '#f0f4f1' }} contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                    <Bar dataKey="count" radius={[0, 12, 12, 0]} barSize={28}>
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
