
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Download, Calendar, FileText, Loader2, TrendingUp, Users, BookOpen, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection } from '@/firebase';
import { db } from '@/firebase/config';
import { collection, query, orderBy } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, subDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Label } from '@/components/ui/label';

export default function ReportsPage() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isGenerating, setIsGenerating] = useState(false);

  const visitsQuery = useMemo(() => query(collection(db, 'visits'), orderBy('timestamp', 'desc')), []);
  const { data: allVisits, loading: visitsLoading } = useCollection(visitsQuery);

  const filteredData = useMemo(() => {
    if (!allVisits) return [];
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    return allVisits.filter(v => isWithinInterval(v.timestamp.toDate(), { start, end }));
  }, [allVisits, startDate, endDate]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const p: Record<string, number> = {};
    const c: Record<string, number> = {};
    const m: Record<string, number> = { id: 0, google: 0 };
    filteredData.forEach(v => {
      p[v.purpose] = (p[v.purpose] || 0) + 1;
      c[v.college] = (c[v.college] || 0) + 1;
      m[v.loginMethod || 'id'] = (m[v.loginMethod || 'id'] || 0) + 1;
    });
    return { total: filteredData.length, p, c, m, topP: Object.entries(p).sort((a,b)=>b[1]-a[1])[0], topC: Object.entries(c).sort((a,b)=>b[1]-a[1])[0] };
  }, [filteredData]);

  const exportCSV = () => {
    if (filteredData.length === 0) return;
    const headers = "Student ID,Full Name,College,Purpose,Date,Time\n";
    const rows = filteredData.map(v => `${v.studentId},${v.fullName},${v.college},${v.purpose},${format(v.timestamp.toDate(), 'yyyy-MM-dd')},${format(v.timestamp.toDate(), 'HH:mm')}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NEU-Library-Log-${startDate}-to-${endDate}.csv`;
    a.click();
    toast({ title: "CSV Exported", description: "Data ready for Excel analysis." });
  };

  const generatePDF = () => {
    if (!stats) return;
    setIsGenerating(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      doc.setFillColor(10, 42, 26); doc.rect(0, 0, 210, 40, 'F');
      doc.setTextColor(201, 162, 39); doc.setFontSize(22); doc.text("NEU LIBRARY VISITOR REPORT", 105, 20, { align: 'center' });
      doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.text(`Official Log: ${startDate} to ${endDate}`, 105, 30, { align: 'center' });

      autoTable(doc, {
        startY: 50, head: [['Metric', 'Summary']], 
        body: [['Total Visitors', stats.total.toString()], ['Primary Purpose', stats.topP?.[0] || 'N/A'], ['Active College', stats.topC?.[0] || 'N/A']],
        headStyles: { fillColor: [26, 92, 46] }
      });

      doc.text("Visitor Log (Sample)", 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['ID', 'Name', 'Purpose', 'Timestamp']],
        body: filteredData.slice(0, 50).map(v => [v.studentId, v.fullName, v.purpose, format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')]),
        styles: { fontSize: 8 }
      });
      doc.save(`NEU-Report-${format(new Date(), 'yyyyMMdd')}.pdf`);
    } finally { setIsGenerating(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-12">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-[#1a3a2a] tracking-tight">System Reporting</h2>
            <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest mt-1">Official database archives and analytics</p>
          </div>
          <div className="flex gap-4">
            <Button variant="outline" onClick={exportCSV} disabled={filteredData.length === 0} className="h-16 px-8 rounded-[1.5rem] border-[#d4e4d8] text-[#1a3a2a] font-black flex gap-2 shadow-sm">
              <Share2 className="h-5 w-5" /> Export CSV
            </Button>
            <Button onClick={generatePDF} disabled={isGenerating || !stats} className="bg-[#c9a227] text-[#0a2a1a] hover:bg-[#b08d20] rounded-[1.5rem] px-10 h-16 font-black shadow-xl flex gap-3 transition-all">
              {isGenerating ? <Loader2 className="animate-spin" /> : <Download className="h-6 w-6" />}
              Generate PDF
            </Button>
          </div>
        </div>

        <Card className="rounded-[2.5rem] border-[#d4e4d8] shadow-xl bg-white overflow-hidden">
          <CardHeader className="p-10 border-b border-[#f0f4f1]">
            <div className="flex flex-col md:flex-row gap-8 items-end">
              <div className="flex-1 space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Period Start</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-14 bg-[#f0f4f1] border-none rounded-2xl font-bold text-[#1a3a2a]" />
              </div>
              <div className="flex-1 space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Period End</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-14 bg-[#f0f4f1] border-none rounded-2xl font-bold text-[#1a3a2a]" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            {visitsLoading ? <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin text-[#c9a227]" /></div> : !stats ? 
              <div className="h-64 flex flex-col items-center justify-center opacity-20"><FileText className="h-20 w-20" /><p className="font-black uppercase text-xl">No Data Found</p></div> : 
              <div className="space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div className="bg-[#f0f4f1] p-8 rounded-[2rem] border-t-4 border-[#c9a227]"><p className="text-[9px] font-black text-[#4a6741] uppercase">Selected Entries</p><p className="text-4xl font-black text-[#1a3a2a]">{stats.total}</p></div>
                  <div className="bg-[#f0f4f1] p-8 rounded-[2rem] border-t-4 border-[#c9a227]"><p className="text-[9px] font-black text-[#4a6741] uppercase">Top Activity</p><p className="text-xl font-black text-[#1a3a2a] truncate">{stats.topP?.[0]}</p></div>
                  <div className="bg-[#f0f4f1] p-8 rounded-[2rem] border-t-4 border-[#c9a227]"><p className="text-[9px] font-black text-[#4a6741] uppercase">Active College</p><p className="text-xl font-black text-[#1a3a2a] truncate">{stats.topC?.[0]}</p></div>
                  <div className="bg-[#f0f4f1] p-8 rounded-[2rem] border-t-4 border-[#c9a227]"><p className="text-[9px] font-black text-[#4a6741] uppercase">Google Logins</p><p className="text-4xl font-black text-[#c9a227]">{((stats.m.google/stats.total)*100).toFixed(0)}%</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-4">
                    <h4 className="text-lg font-black text-[#1a3a2a] uppercase flex gap-2 items-center"><TrendingUp className="h-5 w-5 text-emerald-600" /> Purpose Breakdown</h4>
                    {Object.entries(stats.p).map(([n,c])=>(<div key={n} className="flex justify-between p-4 bg-[#f0f4f1]/40 rounded-xl border border-[#d4e4d8] font-bold text-sm text-[#4a6741]"><span>{n}</span><span>{c} visits</span></div>))}
                   </div>
                   <div className="space-y-4">
                    <h4 className="text-lg font-black text-[#1a3a2a] uppercase flex gap-2 items-center"><Users className="h-5 w-5 text-amber-600" /> Top Colleges</h4>
                    {Object.entries(stats.c).slice(0,5).map(([n,c])=>(<div key={n} className="flex justify-between p-4 bg-[#f0f4f1]/40 rounded-xl border border-[#d4e4d8] font-bold text-sm text-[#4a6741]"><span className="truncate max-w-[200px]">{n}</span><span>{c} visits</span></div>))}
                   </div>
                </div>
              </div>
            }
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
