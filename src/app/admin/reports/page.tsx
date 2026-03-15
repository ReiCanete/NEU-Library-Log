"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Download, Calendar, FileText, Loader2, TrendingUp, Users, Share2, Info, LayoutList, ShieldAlert, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection } from '@/firebase';
import { db, auth } from '@/firebase/config';
import { collection, query, orderBy } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, subDays, differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AdminLayout } from '@/components/admin/admin-layout';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logAppError } from '@/lib/errorMessages';

export default function ReportsPage() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingCSV, setIsExportingCSV] = useState(false);

  const visitsQuery = useMemo(() => query(collection(db, 'visits'), orderBy('timestamp', 'desc')), []);
  const { data: allVisits, loading: visitsLoading, error: visitsError } = useCollection(visitsQuery);

  const blocklistQuery = useMemo(() => query(collection(db, 'blocklist')), []);
  const { data: allBlocked } = useCollection(blocklistQuery);

  const dateError = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return "Start date must be before end date.";
    return null;
  }, [startDate, endDate]);

  const dateWarning = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (differenceInDays(end, start) > 365) return "Large date ranges may take longer to generate. Continue?";
    return null;
  }, [startDate, endDate]);

  const filteredData = useMemo(() => {
    if (!allVisits || dateError) return [];
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    return allVisits.filter(v => isWithinInterval(v.timestamp.toDate(), { start, end }));
  }, [allVisits, startDate, endDate, dateError]);

  const filteredBlocked = useMemo(() => {
    if (!allBlocked || dateError) return [];
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));
    return allBlocked.filter(b => isWithinInterval(b.blockedAt.toDate(), { start, end }));
  }, [allBlocked, startDate, endDate, dateError]);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const p: Record<string, number> = {};
    const c: Record<string, number> = {};
    const m: Record<string, number> = { id: 0, google: 0 };
    filteredData.forEach(v => {
      p[v.purpose] = (p[v.purpose] || 0) + 1;
      const col = v.college || 'Other';
      c[col] = (c[col] || 0) + 1;
      m[v.loginMethod || 'id'] = (m[v.loginMethod || 'id'] || 0) + 1;
    });
    return { 
      total: filteredData.length, 
      p, c, m, 
      topP: Object.entries(p).sort((a,b)=>b[1]-a[1])[0], 
      topC: Object.entries(c).sort((a,b)=>b[1]-a[1])[0] 
    };
  }, [filteredData]);

  const exportCSV = async () => {
    if (filteredData.length === 0) return;
    setIsExportingCSV(true);
    try {
      const headers = "Student ID,Full Name,College,Purpose,Date,Time,Method\n";
      const rows = filteredData.map(v => `${v.studentId},${v.fullName},${v.college},${v.purpose},${format(v.timestamp.toDate(), 'yyyy-MM-dd')},${format(v.timestamp.toDate(), 'HH:mm')},${v.loginMethod}`).join("\n");
      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NEU-Library-Log-${startDate}-to-${endDate}.csv`;
      a.click();
      toast({ title: "CSV Exported", description: "Records ready for analysis." });
    } catch (e: any) {
      logAppError('Reports', 'ExportCSV', e);
      toast({ title: "CSV Export Failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsExportingCSV(false);
    }
  };

  const generatePDF = async () => {
    if (!stats) return;
    setIsGenerating(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      const adminEmail = auth.currentUser?.email || 'N/A';
      
      // Header
      doc.setFillColor(10, 42, 26); doc.rect(0, 0, 210, 40, 'F');
      doc.setFillColor(201, 162, 39); doc.circle(25, 20, 10, 'F');
      doc.setTextColor(10, 42, 26); doc.setFontSize(8); doc.text("NEU", 25, 21, { align: 'center' });
      
      doc.setTextColor(201, 162, 39); doc.setFontSize(18); doc.setFont("helvetica", "bold");
      doc.text("NEW ERA UNIVERSITY — LIBRARY VISITOR REPORT", 115, 20, { align: 'center' });
      doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "normal");
      doc.text(`Official Log Record | Period: ${startDate} to ${endDate}`, 115, 28, { align: 'center' });
      doc.text(`Generated by: ${adminEmail}`, 115, 33, { align: 'center' });

      // Summary Table
      doc.setTextColor(10, 42, 26); doc.setFontSize(12); doc.text("Executive Summary", 14, 50);
      autoTable(doc, {
        startY: 55, head: [['Metric', 'Summary Value']], 
        body: [['Total Visitors Recorded', stats.total.toString()], ['Primary Purpose', stats.topP?.[0] || 'N/A'], ['Most Active College', stats.topC?.[0] || 'N/A'], ['Blocked During Period', filteredBlocked.length.toString()]],
        headStyles: { fillColor: [26, 92, 46] },
        alternateRowStyles: { fillColor: [240, 247, 242] }
      });

      // Purpose Breakdown
      doc.text("Purpose Breakdown", 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['Purpose', 'Visit Count', 'Percentage']],
        body: Object.entries(stats.p).map(([n, c]) => [n, c.toString(), `${((c/stats.total)*100).toFixed(1)}%`]),
        headStyles: { fillColor: [201, 162, 39], textColor: [10, 42, 26] },
        alternateRowStyles: { fillColor: [240, 247, 242] }
      });

      // College Breakdown
      doc.text("College Participation", 14, (doc as any).lastAutoTable.finalY + 15);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [['College', 'Visit Count']],
        body: Object.entries(stats.c).sort((a,b)=>b[1]-a[1]).map(([n, c]) => [n, c.toString()]),
        headStyles: { fillColor: [26, 92, 46] },
        alternateRowStyles: { fillColor: [240, 247, 242] }
      });

      // Visitor Logs
      doc.addPage();
      doc.setFontSize(14); doc.text("Detailed Visitor Activity Archives", 14, 20);
      autoTable(doc, {
        startY: 25,
        head: [['ID', 'Name', 'College', 'Purpose', 'Date & Time']],
        body: filteredData.map(v => [v.studentId, v.fullName, v.college || '—', v.purpose, format(v.timestamp.toDate(), 'yyyy-MM-dd HH:mm')]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [26, 92, 46] },
        alternateRowStyles: { fillColor: [240, 247, 242] }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`NEU Library Log System | Confidential | Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
      }

      doc.save(`NEU-Report-${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast({ title: "PDF Generated", description: "Report downloaded successfully." });
    } catch (e: any) {
      logAppError('Reports', 'GeneratePDF', e);
      toast({ title: "PDF Generation Failed", description: "Please try again. If problem persists, try a smaller date range.", variant: "destructive" });
    } finally { setIsGenerating(true); setIsGenerating(false); }
  };

  return (
    <AdminLayout>
      <div className="space-y-12">
        {isGenerating && (
          <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
            <Loader2 className="h-16 w-16 animate-spin text-[#c9a227] mb-4" />
            <h2 className="text-2xl font-black uppercase tracking-widest">Generating PDF...</h2>
            <p className="text-white/60 mt-2">Compiling visitor analytics and history</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-end gap-6">
          <div>
            <h2 className="text-4xl font-black text-[#1a3a2a] tracking-tight">System Reporting</h2>
            <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest mt-1">Official database archives and analytics</p>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <Button variant="outline" onClick={exportCSV} disabled={filteredData.length === 0 || isExportingCSV} className="flex-1 md:flex-none h-16 px-8 rounded-[1.5rem] border-[#d4e4d8] text-[#1a3a2a] font-black flex gap-2 shadow-sm transition-all hover:bg-slate-50">
              {isExportingCSV ? <Loader2 className="animate-spin h-5 w-5" /> : <Share2 className="h-5 w-5" />}
              Export CSV
            </Button>
            <Button onClick={generatePDF} disabled={isGenerating || !stats || !!dateError} className="flex-1 md:flex-none bg-[#c9a227] text-[#0a2a1a] hover:bg-[#b08d20] rounded-[1.5rem] px-10 h-16 font-black shadow-xl flex gap-3 transition-all">
              {isGenerating ? <Loader2 className="animate-spin" /> : <Download className="h-6 w-6" />}
              Generate PDF
            </Button>
          </div>
        </div>

        <Card className="rounded-[2.5rem] border-[#d4e4d8] shadow-xl bg-white overflow-hidden">
          <CardHeader className="p-10 border-b border-[#f0f4f1]">
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-8 items-end">
                <div className="flex-1 space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Period Start</Label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`h-14 pl-12 bg-[#f0f4f1] border-none rounded-2xl font-black text-[#1a3a2a] ${dateError ? 'ring-2 ring-red-500' : ''}`} />
                  </div>
                </div>
                <div className="flex-1 space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-[#4a6741] ml-1">Period End</Label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`h-14 pl-12 bg-[#f0f4f1] border-none rounded-2xl font-black text-[#1a3a2a] ${dateError ? 'ring-2 ring-red-500' : ''}`} />
                  </div>
                </div>
              </div>
              
              {dateError && (
                <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-600 rounded-xl">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs font-black uppercase tracking-widest">{dateError}</AlertDescription>
                </Alert>
              )}
              {dateWarning && !dateError && (
                <Alert className="bg-amber-50 border-amber-200 text-amber-700 rounded-xl">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs font-black uppercase tracking-widest">{dateWarning}</AlertDescription>
                </Alert>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-10">
            {visitsLoading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin text-[#c9a227] h-12 w-12" />
                <p className="font-black uppercase text-[10px] text-[#4a6741] tracking-[0.2em]">Retrieving visitor data...</p>
              </div>
            ) : visitsError ? (
              <div className="h-96 flex flex-col items-center justify-center gap-6 text-center">
                <div className="h-24 w-24 bg-red-50 rounded-full flex items-center justify-center"><AlertCircle className="h-12 w-12 text-red-500" /></div>
                <div className="space-y-2">
                  <p className="font-black uppercase text-2xl tracking-tighter text-[#1a3a2a]">Failed to load report data</p>
                  <p className="text-[#4a6741] font-bold">Please select a different date range or try again.</p>
                </div>
                <Button onClick={() => window.location.reload()} className="bg-[#1a3a2a] h-12 px-8 rounded-xl font-black">Retry Fetch</Button>
              </div>
            ) : !stats ? 
              <div className="h-96 flex flex-col items-center justify-center opacity-20"><FileText className="h-32 w-32" /><p className="font-black uppercase text-2xl tracking-tighter mt-4">No Records Found for Period</p></div> : 
              <div className="space-y-12 animate-in fade-in duration-500">
                <div className="flex items-center gap-3 pb-4 border-b border-[#f0f4f1]">
                  <Info className="h-6 w-6 text-[#c9a227]" />
                  <h3 className="text-xl font-black text-[#1a3a2a] uppercase tracking-tighter">Report Preview</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div className="bg-[#f0f4f1] p-8 rounded-[2rem] border-t-4 border-[#c9a227]"><p className="text-[9px] font-black text-[#4a6741] uppercase tracking-widest">Selected Entries</p><p className="text-4xl font-black text-[#1a3a2a]">{stats.total}</p></div>
                  <div className="bg-[#f0f4f1] p-8 rounded-[2rem] border-t-4 border-[#c9a227]"><p className="text-[9px] font-black text-[#4a6741] uppercase tracking-widest">Primary Purpose</p><p className="text-xl font-black text-[#1a3a2a] truncate">{stats.topP?.[0]}</p></div>
                  <div className="bg-[#f0f4f1] p-8 rounded-[2rem] border-t-4 border-[#c9a227]"><p className="text-[9px] font-black text-[#4a6741] uppercase tracking-widest">Active College</p><p className="text-xl font-black text-[#1a3a2a] truncate">{stats.topC?.[0]}</p></div>
                  <div className="bg-[#f0f4f1] p-8 rounded-[2rem] border-t-4 border-red-500"><p className="text-[9px] font-black text-red-500 uppercase tracking-widest">Blocks Issued</p><p className="text-4xl font-black text-[#1a3a2a]">{filteredBlocked.length}</p></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                   <div className="space-y-6">
                    <h4 className="text-sm font-black text-[#1a3a2a] uppercase tracking-widest flex gap-2 items-center"><TrendingUp className="h-5 w-5 text-[#c9a227]" /> Activity Breakdown</h4>
                    <div className="rounded-[1.5rem] border border-[#d4e4d8] overflow-hidden">
                      <Table>
                        <TableHeader className="bg-[#f0f4f1]">
                          <TableRow className="border-none">
                            <TableHead className="font-black text-[9px] h-10 uppercase">Purpose</TableHead>
                            <TableHead className="font-black text-[9px] h-10 uppercase text-right">Visits</TableHead>
                            <TableHead className="font-black text-[9px] h-10 uppercase text-right">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(stats.p).map(([n,c])=>(
                            <TableRow key={n} className="border-b-[#f0f4f1]">
                              <TableCell className="font-bold text-xs">{n}</TableCell>
                              <TableCell className="text-right font-black text-xs">{c}</TableCell>
                              <TableCell className="text-right font-black text-[10px] text-[#c9a227]">{((c/stats.total)*100).toFixed(0)}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                   </div>

                   <div className="space-y-6">
                    <h4 className="text-sm font-black text-[#1a3a2a] uppercase tracking-widest flex gap-2 items-center"><LayoutList className="h-5 w-5 text-[#1a3a2a]" /> Top 5 Colleges</h4>
                    <div className="rounded-[1.5rem] border border-[#d4e4d8] overflow-hidden">
                      <Table>
                        <TableHeader className="bg-[#f0f4f1]">
                          <TableRow className="border-none">
                            <TableHead className="font-black text-[9px] h-10 uppercase">College</TableHead>
                            <TableHead className="font-black text-[9px] h-10 uppercase text-right">Entries</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(stats.c).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([n,c])=>(
                            <TableRow key={n} className="border-b-[#f0f4f1]">
                              <TableCell className="font-bold text-xs truncate max-w-[200px]">{n}</TableCell>
                              <TableCell className="text-right font-black text-xs">{c}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
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
