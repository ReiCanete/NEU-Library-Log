"use client";

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/admin-layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { UserX, Search, ShieldX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { firebaseService } from '@/lib/firebase-mock';
import { useToast } from '@/hooks/use-toast';

export default function BlocklistPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [blockId, setBlockId] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  const handleBlockUser = async () => {
    if (!blockId || !blockReason) return;
    
    setIsBlocking(true);
    try {
      await firebaseService.blockUser(blockId, blockReason);
      toast({
        title: "User Blocked",
        description: `Student ID ${blockId} has been added to the blocklist.`,
      });
      setBlockId('');
      setBlockReason('');
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-primary">Access Management</h2>
            <p className="text-muted-foreground">Manage blocked users and library access restrictions</p>
          </div>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" className="flex items-center gap-2">
                <UserX className="h-4 w-4" />
                Block New User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block Library Access</DialogTitle>
                <DialogDescription>
                  Adding a student to the blocklist will prevent them from logging in at any kiosk.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sid">School ID</Label>
                  <Input 
                    id="sid" 
                    placeholder="e.g. 25-12946-343" 
                    value={blockId}
                    onChange={(e) => setBlockId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Blocking</Label>
                  <Textarea 
                    id="reason" 
                    placeholder="Describe the violation or reason for restricted access..." 
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setBlockId(''); setBlockReason(''); }}>Cancel</Button>
                <Button variant="destructive" disabled={isBlocking || !blockId || !blockReason} onClick={handleBlockUser}>
                  {isBlocking ? "Processing..." : "Confirm Block"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active Blocklist</CardTitle>
                <CardDescription>View and manage currently blocked students</CardDescription>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by ID or Name..." 
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Date Blocked</TableHead>
                  <TableHead>Blocked By</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Mock data for blocklist */}
                <TableRow>
                  <TableCell className="font-mono">2021-00432</TableCell>
                  <TableCell>Frequent noise violations in quiet zone</TableCell>
                  <TableCell>Oct 12, 2023</TableCell>
                  <TableCell>Head Librarian</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">Remove Block</Button>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-mono">2022-10921</TableCell>
                  <TableCell>Unreturned overdue research materials</TableCell>
                  <TableCell>Jan 05, 2024</TableCell>
                  <TableCell>System Admin</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm">Remove Block</Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            
            <div className="mt-20 text-center space-y-4 opacity-30">
              <ShieldX className="h-24 w-24 mx-auto text-slate-300" />
              <p className="text-slate-500">End of active records</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
