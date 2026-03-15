
"use client";

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Download, Loader2, Library, LayoutDashboard, History, LogOut, Search, Clock, RefreshCcw, Sparkles, BookOpen, GraduationCap, Monitor, MessageSquare, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCollection } from '@/firebase';
import { auth, db } from '@/firebase/config';
import { collection, query, orderBy, where, Timestamp, addDoc, getDocs } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Sector } from 'recharts';
import { format, startOfDay, subDays, isSameDay, startOfWeek, startOfMonth, endOfDay, getHours } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const { toast } = useToast();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Firestore Queries
  const todayStart = startOfDay(new Date());
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const monthStart = startOfMonth(new Date());

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

  // Stats derivation
  const stats = useMemo(() => {
    if (!allVisits) return { today: 0, week: 0, month: 0 };
    return {
      today: allVisits.filter(v => v.timestamp.toDate() >= todayStart).length,
      week: allVisits.filter(v => v.timestamp.toDate() >= weekStart).length,
      month: allVisits.filter(v => v.timestamp.toDate() >= monthStart).length
    };
  }, [allVisits, todayStart, weekStart, monthStart]);

  // Purpose breakdown for Donut Chart
  const purposeData = useMemo(() => {
    if (!allVisits) return [];
    const counts: Record<string, number> = {};
    allVisits.forEach(v => {
      counts[v.purpose] = (counts[v.purpose] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allVisits]);

  // Top Colleges for Bar Chart
  const collegeData = useMemo(() => {
    if (!allVisits) return [];
    const counts: Record<string, number> = {};
    allVisits.forEach(v => {
      counts[v.college] = (counts[v.college] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allVisits]);

  // Peak Hour and Most Active Day
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

  const greeting = useMemo(() => {
    const h = getHours(new Date());
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  return (
    <div className="space-y-12">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-[#0a2a1a] to-[#1a5c2e] rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="z-10 text-center md:text-left space-y-3">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <Sparkles className="h-6 w-6 text-[#c9a227]" />
            <h2 className="text-4xl font-black tracking-tight">{greeting}, Staff!</h2>
          </div>
          <p className="text-white/60 font-bold max-w-lg text-lg leading-tight">
            The NEU Library Log system is active. We have recorded <span className="text-[#c9a227]">{stats.today}</span> visits today so far.
          </p>
        </div>
        <div className="flex gap-4 z-10">
          <Button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-2xl h-14 px-8 font-black transition-all"
          >
            {isRefreshing ? <Loader2 className="animate-spin h-5 w-5" /> : <RefreshCcw className="h-5 w-5 mr-2" />}
            Sync Data
          </Button>
        </div>
        {/* Background blobs */}
        <div className="absolute top-[-50%] right-[-10%] w-[400px] h-[400px] bg-[#c9a227]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-50%] left-[-10%] w-[300px] h-[300px] bg-white/5 rounded-full blur-[80px]" />
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Today\'s Visitors', value: stats.today, icon: Users, circle: 'bg-[#1a5c2e]/10', iconColor: 'text-[#1a5c2e]', sub: 'Live active entries' },
          { label: 'Weekly Total', value: stats.week, icon: Calendar, circle: 'bg-[#c9a227]/10', iconColor: 'text-[#c9a227]', sub: 'Past 7 days performance' },
          { label: 'Monthly Traffic', value: stats.month, icon: TrendingUp, circle: 'bg-[#0a2a1a]/10', iconColor: 'text-[#0a2a1a]', sub: 'Aggregated monthly log' }
        ].map((s, i) => (
          <Card key={i} className="border-none shadow-xl shadow-slate-200/50 rounded-[2.5rem] bg-white overflow-hidden group hover:scale-[1.02] transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-8">
              <div className={`p-4 rounded-2xl ${s.circle} transition-transform group-hover:scale-110`}>
                <s.icon className={`h-6 w-6 ${s.iconColor}`} />
              </div>
              <div className="text-right">
                <CardTitle className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</CardTitle>
                <div className="text-5xl font-black text-[#0a2a1a] mt-1 tabular-nums animate-in slide-in-from-bottom-2">
                  {visitsLoading ? <Skeleton className="h-12 w-20 ml-auto" /> : s.value}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-8 pb-8 pt-2 border-t border-slate-50 mt-2 flex justify-between items-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{s.sub}</p>
              <span className="text-[9px] text-slate-300 font-bold uppercase">Updated {format(lastUpdated, 'p')}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card className="rounded-[3rem] shadow-xl border-none bg-white p-10 space-y-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-black text-[#0a2a1a] tracking-tight">Visit Purpose Breakdown</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Student distribution by activity</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl"><BookOpen className="h-5 w-5 text-slate-400" /></div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={purposeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {purposeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {purposeData.map((p, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-xs font-bold text-slate-600 truncate">{p.name}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="rounded-[3rem] shadow-xl border-none bg-white p-10 space-y-10">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-2xl font-black text-[#0a2a1a] tracking-tight">Top Active Colleges</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Most frequent visitor groups</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl"><GraduationCap className="h-5 w-5 text-slate-400" /></div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={collegeData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={140} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '16px' }}
                />
                <Bar dataKey="count" radius={[0, 10, 10, 0]}>
                  {collegeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Analytics Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Peak Hour', value: insights.peakHour, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Most Active Day', value: insights.activeDay, icon: Calendar, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Popular Purpose', value: insights.topPurpose, icon: BookOpen, color: 'text-emerald-600', bg: 'bg-emerald-50' }
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-6 p-8 bg-white rounded-[2rem] shadow-lg border border-slate-50 group hover:border-[#c9a227]/20 transition-all">
            <div className={`p-4 rounded-2xl ${item.bg} group-hover:scale-110 transition-transform`}>
              <item.icon className={`h-6 w-6 ${item.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</p>
              <p className="text-xl font-black text-[#0a2a1a] tracking-tight">{item.value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
