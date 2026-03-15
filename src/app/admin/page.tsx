'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Loader2, RefreshCcw, Sparkles, BookOpen, GraduationCap, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, query, orderBy } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { format, startOfDay, startOfWeek, startOfMonth, getHours, subDays } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';

function CountUp({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) return;
    let totalDuration = 1000;
    let incrementTime = Math.abs(Math.floor(totalDuration / (end || 1)));
    let timer = setInterval(() => {
      start += 1;
      setCount(start);
      if (start === end) clearInterval(timer);
    }, incrementTime);
    return () => clearInterval(timer);
  }, [value]);
  return <>{count}</>;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateMarkers, setDateMarkers] = useState<{
    today: Date;
    yesterday: Date;
    week: Date;
    month: Date;
  } | null>(null);

  useEffect(() => {
    const now = new Date();
    setDateMarkers({
      today: startOfDay(now),
      yesterday: startOfDay(subDays(now, 1)),
      week: startOfWeek(now, { weekStartsOn: 1 }),
      month: startOfMonth(now)
    });
  }, []);

  const visitsQuery = useMemo(() => query(collection(db, 'visits'), orderBy('timestamp', 'desc')), []);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsRefreshing(false);
      toast({ title: "Data Synchronized", description: "Dashboard has been updated with latest records." });
    }, 800);
  };

  const stats = useMemo(() => {
    if (!allVisits || !dateMarkers) return { today: 0, yesterday: 0, week: 0, month: 0 };
    return {
      today: allVisits.filter(v => v.timestamp.toDate() >= dateMarkers.today).length,
      yesterday: allVisits.filter(v => {
        const d = v.timestamp.toDate();
        return d >= dateMarkers.yesterday && d < dateMarkers.today;
      }).length,
      week: allVisits.filter(v => v.timestamp.toDate() >= dateMarkers.week).length,
      month: allVisits.filter(v => v.timestamp.toDate() >= dateMarkers.month).length
    };
  }, [allVisits, dateMarkers]);

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
      counts[college] = (counts[college] || 0) + 1; 
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

  const COLORS = ['#1a5c2e', '#c9a227', '#0a2a1a', '#a07d1a', '#2d6a4f'];

  return (
    <AdminLayout>
      <div className="space-y-12">
        <div className="bg-gradient-to-br from-[#0a2a1a] to-[#1a5c2e] rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8 border-b-4 border-[#c9a227]">
          <div className="z-10 text-center md:text-left space-y-3">
            <div className="flex items-center gap-4 justify-center md:justify-start">
              <img src="/neu-logo.png" alt="Logo" className="h-10 w-10 rounded-full" />
              <h2 className="text-4xl font-black tracking-tight flex items-center gap-3">
                Staff Overview <Sparkles className="h-6 w-6 text-[#c9a227]" />
              </h2>
            </div>
            <p className="text-white/60 font-bold max-w-lg text-lg leading-tight">
              Good day, Staff! Library log is active. We have recorded <span className="text-[#c9a227]">{stats.today}</span> entries today.
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={isRefreshing} className="z-10 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl h-14 px-8 font-black">
            {isRefreshing ? <Loader2 className="animate-spin h-5 w-5" /> : <RefreshCcw className="h-5 w-5 mr-2" />}
            Refresh Stats
          </Button>
          <div className="absolute top-[-50%] right-[-10%] w-[400px] h-[400px] bg-[#c9a227]/10 rounded-full blur-[100px]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { label: 'Today\'s Visitors', value: stats.today, prev: stats.yesterday, icon: Users, circle: 'bg-emerald-500/10', iconColor: 'text-emerald-600' },
            { label: 'Weekly Total', value: stats.week, icon: Calendar, circle: 'bg-[#c9a227]/10', iconColor: 'text-[#c9a227]' },
            { label: 'Monthly Traffic', value: stats.month, icon: TrendingUp, circle: 'bg-[#0a2a1a]/10', iconColor: 'text-[#0a2a1a]' }
          ].map((s, i) => {
            const isUp = s.prev !== undefined ? s.value >= s.prev : true;
            return (
              <Card key={i} className="border-none shadow-xl rounded-[2.5rem] bg-white overflow-hidden group hover:scale-[1.02] transition-all duration-300 border-t-4 border-[#c9a227]">
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-8">
                  <div className={`p-4 rounded-2xl ${s.circle}`}>
                    <s.icon className={`h-6 w-6 ${s.iconColor}`} />
                  </div>
                  <div className="text-right">
                    <CardTitle className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">{s.label}</CardTitle>
                    <div className="text-5xl font-black text-[#1a3a2a] mt-1 tabular-nums">
                      {visitsLoading ? <Skeleton className="h-12 w-20 ml-auto" /> : <CountUp value={s.value} />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 pt-2 border-t border-[#f0f4f1] mt-2 flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    {s.prev !== undefined && (
                      <span className={`text-[9px] font-black uppercase flex items-center ${isUp ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {isUp ? 'Trending Up' : 'Trending Down'}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-[#4a6741]/50 font-black uppercase">Updated {format(lastUpdated, 'p')}</span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <Card className="rounded-[3rem] shadow-xl border border-[#d4e4d8] bg-white p-10 space-y-10">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-[#1a3a2a] tracking-tight">Visit Purpose Breakdown</h3>
                <p className="text-[10px] text-[#4a6741] font-black uppercase tracking-widest mt-1">Activity distribution</p>
              </div>
              <div className="p-3 bg-[#f0f4f1] rounded-2xl"><BookOpen className="h-5 w-5 text-[#1a3a2a]" /></div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={purposeData} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={8} dataKey="value" stroke="none">
                    {purposeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-[3rem] shadow-xl border border-[#d4e4d8] bg-white p-10 space-y-10">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-2xl font-black text-[#1a3a2a] tracking-tight">Top Active Colleges</h3>
                <p className="text-[10px] text-[#4a6741] font-black uppercase tracking-widest mt-1">Frequent visitor groups</p>
              </div>
              <div className="p-3 bg-[#f0f4f1] rounded-2xl"><GraduationCap className="h-5 w-5 text-[#1a3a2a]" /></div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={collegeData} layout="vertical">
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={140} axisLine={false} tickLine={false} tick={{ fill: '#4a6741', fontSize: 10, fontWeight: 900 }} />
                  <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }} />
                  <Bar dataKey="count" radius={[0, 10, 10, 0]}>
                    {collegeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { label: 'Peak Visit Hour', value: insights.peakHour, icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Most Active Day', value: insights.activeDay, icon: Calendar, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Top Visit Purpose', value: insights.topPurpose, icon: BookOpen, color: 'text-[#0a2a1a]', bg: 'bg-slate-100' }
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-6 p-8 bg-white rounded-[2rem] shadow-lg border-l-8 border-[#c9a227] group hover:border-[#1a3a2a] transition-all">
              <div className={`p-4 rounded-2xl ${item.bg} group-hover:scale-110 transition-transform`}>
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </div>
              <div>
                <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">{item.label}</p>
                <p className="text-xl font-black text-[#1a3a2a] tracking-tight">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
