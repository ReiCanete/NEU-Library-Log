
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Download, Calendar, Filter, FileText, Loader2, Sparkles, TrendingUp, Users, BookOpen } from 'lucide-react';
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
    return allVisits.filter(v => {
      const date = v.timestamp.toDate();
      return isWithinInterval(date, { start, end });
    });
  }, [allVisits, startDate, endDate]);

  const reportStats = useMemo(() => {
    if (filteredData.length === 0) return null;
    
    const purposes: Record<string, number> = {};
    const colleges: Record<string, number> = {};
    const methods: Record<string, number> = { id: 0, google: 0 };

    filteredData.forEach(v => {
      purposes[v.purpose] = (purposes[v.purpose] || 0) + 1;
      colleges[v.college] = (colleges[v.college] || 0) + 1;
      methods[v.loginMethod] = (methods[v.loginMethod] || 0) + 1;
    });

    const topPurpose = Object.entries(purposes).sort((a, b) => b[1] - a[1])[0];
    const topCollege = Object.entries(colleges).sort((a, b) => b[1] - a[1])[0];

    return { total: filteredData.length, topPurpose, topCollege, methods, purposes, colleges };
  }, [filteredData]);

  const handleGenerateReport = async () => {
    if (filteredData.length === 0) return;
    setIsGenerating(true);
    
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const now = new Date();
      
      // Header
      doc.setFillColor(10, 42, 26);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(201, 162, 39);
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.text("NEU LIBRARY VISITOR REPORT", 105, 20, { align: 'center' });
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(`REPORT PERIOD: ${format(new Date(startDate), 'PPP')} — ${format(new Date(endDate), 'PPP')}`, 105, 30, { align: 'center' });

      // Summary Section
      doc.setTextColor(10, 42, 26);
      doc.setFontSize(16);
      doc.text("EXECUTIVE SUMMARY", 14, 55);
      doc.setDrawColor(201, 162, 39);
      doc.setLineWidth(1);
      doc.line(14, 58, 60, 58);

      autoTable(doc, {
        startY: 65,
        head: [['Metric', 'Value']],
        body: [
          ['Total Unique Entries', reportStats?.total.toString() || '0'],
          ['Most Popular Purpose', reportStats?.topPurpose?.[0] || 'N/A'],
          ['Most Active College', reportStats?.topCollege?.[0] || 'N/A'],
          ['Manual ID Logins', reportStats?.methods.id.toString() || '0'],
          ['Google OAuth Logins', reportStats?.methods.google.toString() || '0']
        ],
        theme: 'grid',
        headStyles: { fillColor: [26, 92, 46] },
        styles: { fontSize: 10, cellPadding: 5 }
      });

      // Purpose Breakdown
      doc.setFontSize(16);
      doc.text("PURPOSE DISTRIBUTION", 14, (doc as any).lastAutoTable.finalY + 20);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 25,
        head: [['Purpose', 'Visit Count', 'Percentage']],
        body: Object.entries(reportStats?.purposes || {}).map(([name, count]) => [
          name,
          count.toString(),
          `${((count / filteredData.length) * 100).toFixed(1)}%`
        ]),
        headStyles: { fillColor: [201, 162, 39], textColor: [10, 42, 26] },
        styles: { fontSize: 9 }
      });

      // Detailed Activity Log (Top 100)
      doc.addPage();
      doc.text("VISITOR ACTIVITY LOG (Sample: Top 100)", 14, 20);
      autoTable(doc, {
        startY: 25,
        head: [['Student ID', 'Full Name', 'College', 'Purpose', 'Date & Time']],
        body: filteredData.slice(0, 100).map(v => [
          v.studentId,
          v.fullName,
          v.college,
          v.purpose,
          format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')
        ]),
        theme: 'striped',
        headStyles: { fillColor: [26, 92, 46] },
        styles: { fontSize: 8 }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generated by Staff Portal on ${format(now, 'PPP p')} | Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
      }

      doc.save(`NEU-Library-Report-${format(now, 'yyyyMMdd')}.pdf`);
      toast({ title: "Report Ready", description: "PDF has been downloaded successfully." });
    } catch (e: any) {
      toast({ title: "Generation Error", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-12">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-[#0a2a1a] tracking-tight">System Reporting</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Export database analytics and traffic logs</p>
          </div>
          <Button 
            onClick={handleGenerateReport} 
            disabled={isGenerating || filteredData.length === 0}
            className="bg-[#c9a227] text-[#0a2a1a] hover:bg-[#b08d20] rounded-[1.5rem] px-10 h-16 font-black shadow-xl flex gap-3 transition-all"
          >
            {isGenerating ? <Loader2 className="animate-spin" /> : <Download className="h-6 w-6" />}
            Download Analytics PDF
          </Button>
        </div>

        <Card className="rounded-[2.5rem] border-none shadow-xl bg-white overflow-hidden">
          <CardHeader className="p-10 border-b border-slate-50">
            <div className="flex flex-col md:flex-row gap-8 items-end">
              <div className="flex-1 space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Report Period Start</Label>
                <div className="relative">
                  <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#c9a227]" />
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-14 pl-14 bg-slate-50 border-none rounded-2xl font-bold text-[#0a2a1a]" />
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Report Period End</Label>
                <div className="relative">
                  <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#c9a227]" />
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-14 pl-14 bg-slate-50 border-none rounded-2xl font-bold text-[#0a2a1a]" />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-10">
            {visitsLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-[#c9a227]" />
                <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Querying Archives...</p>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center opacity-20">
                <FileText className="h-20 w-20 mb-4" />
                <h4 className="text-2xl font-black uppercase">No Data in Period</h4>
                <p className="text-sm font-bold">Select a wider date range to generate a report.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <div className="bg-slate-50 p-8 rounded-[2rem] space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Selected Entries</p>
                  <p className="text-4xl font-black text-[#0a2a1a]">{filteredData.length}</p>
                </div>
                <div className="bg-slate-50 p-8 rounded-[2rem] space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Top Purpose</p>
                  <p className="text-xl font-black text-[#0a2a1a] truncate">{reportStats?.topPurpose?.[0] || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-8 rounded-[2rem] space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Most Active College</p>
                  <p className="text-xl font-black text-[#0a2a1a] truncate">{reportStats?.topCollege?.[0] || 'N/A'}</p>
                </div>
                <div className="bg-slate-50 p-8 rounded-[2rem] space-y-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Google Auth Ratio</p>
                  <p className="text-4xl font-black text-[#c9a227]">{reportStats ? ((reportStats.methods.google / reportStats.total) * 100).toFixed(0) : 0}%</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analytics Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
           <Card className="rounded-[3rem] p-10 bg-white shadow-xl border-none space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-50 rounded-2xl"><TrendingUp className="h-6 w-6 text-emerald-600" /></div>
                <h4 className="text-xl font-black text-[#0a2a1a]">Purpose Distribution</h4>
              </div>
              <div className="space-y-4">
                {Object.entries(reportStats?.purposes || {}).sort((a,b) => b[1]-a[1]).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <span className="text-sm font-bold text-slate-600">{name}</span>
                    <span className="text-sm font-black text-[#0a2a1a]">{count} visits</span>
                  </div>
                ))}
              </div>
           </Card>

           <Card className="rounded-[3rem] p-10 bg-white shadow-xl border-none space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 rounded-2xl"><Users className="h-6 w-6 text-blue-600" /></div>
                <h4 className="text-xl font-black text-[#0a2a1a]">College Breakdown</h4>
              </div>
              <div className="space-y-4">
                {Object.entries(reportStats?.colleges || {}).sort((a,b) => b[1]-a[1]).slice(0, 6).map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <span className="text-sm font-bold text-slate-600 truncate max-w-[200px]">{name}</span>
                    <span className="text-sm font-black text-[#0a2a1a]">{count} visits</span>
                  </div>
                ))}
              </div>
           </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
