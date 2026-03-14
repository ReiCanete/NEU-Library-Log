"use client";

import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Download, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { firebaseService, Visit } from '@/lib/firebase-mock';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      const s = await firebaseService.getStats();
      setStats(s);
      
      const logs = await firebaseService.getVisits(10);
      setRecentVisits(logs);

      // Generate dummy chart data for the current week
      const start = startOfWeek(new Date());
      const end = endOfWeek(new Date());
      const days = eachDayOfInterval({ start, end });
      
      const data = days.map(day => ({
        name: format(day, 'EEE'),
        count: Math.floor(Math.random() * 50) + 10, // Mock counts
      }));
      setChartData(data);
    };

    fetchData();
  }, []);

  const exportReport = () => {
    // Report generation logic using jsPDF would go here
    alert('Generating PDF Report...');
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-primary">Library Overview</h2>
            <p className="text-muted-foreground">Real-time visitor statistics and analytics</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Custom Range
            </Button>
            <Button onClick={exportReport} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Download PDF Report
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Visitors</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.today}</div>
              <p className="text-xs text-muted-foreground mt-1">+12% from yesterday</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
              <Calendar className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.week}</div>
              <p className="text-xs text-muted-foreground mt-1">On track for weekly goal</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-indigo-500 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
              <TrendingUp className="h-5 w-5 text-indigo-500" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{stats.month}</div>
              <p className="text-xs text-muted-foreground mt-1">Highest peak in semester</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart Section */}
          <Card className="lg:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle>Visitor Distribution</CardTitle>
              <CardDescription>Daily count for the current week</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 4 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.4)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Activity Section */}
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Recent Entries</CardTitle>
              <CardDescription>Latest visitor logins</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recentVisits.length === 0 ? (
                  <p className="text-center py-10 text-muted-foreground">No recent activity</p>
                ) : (
                  recentVisits.map((visit) => (
                    <div key={visit.id} className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                        {visit.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{visit.fullName}</p>
                        <p className="text-xs text-muted-foreground truncate">{visit.college} • {visit.purpose}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium">{format(visit.timestamp, 'hh:mm a')}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <Button variant="link" className="w-full mt-6 text-primary">View Full History</Button>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Recent Logs</CardTitle>
            <CardDescription>Detailed history of visitor activities</CardDescription>
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
                {recentVisits.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell className="font-medium">{visit.fullName}</TableCell>
                    <TableCell>{visit.college}</TableCell>
                    <TableCell>{visit.purpose}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {visit.loginMethod}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(visit.timestamp, 'MMM dd, hh:mm a')}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">Block</Button>
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
