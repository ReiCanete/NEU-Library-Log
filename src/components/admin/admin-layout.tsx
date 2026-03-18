'use client';

import { useEffect, useState } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, UserX, LogOut, Loader2, FileText, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useFirestore, useAuth } from '@/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const db = useFirestore();
  const auth = useAuth();
  const { user, loading: authLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  const [todayCount, setTodayCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!db) return;
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const unsubVisits = onSnapshot(query(collection(db, 'visits'), where('timestamp', '>=', start), limit(500)), (snap) => {
      setTodayCount(snap.size);
    });

    const unsubBlocked = onSnapshot(query(collection(db, 'blocklist'), limit(500)), (snap) => {
      setBlockedCount(snap.size);
    });

    return () => {
      unsubVisits();
      unsubBlocked();
    };
  }, [db]);

  useEffect(() => {
    if (authLoading || !db || !auth) return;
    if (!user) {
      setIsAdmin(false);
      setCheckingRole(false);
      router.push('/admin/login');
      return;
    }

    const unsubscribe = onSnapshot(query(collection(db, 'users'), where('email', '==', user.email), limit(1)), (snap) => {
      let hasAdminAccess = false;
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        setAdminProfile(userData);
        hasAdminAccess = userData?.role === 'admin' || userData?.studentId === '25-14294-549';
      }
      
      const isWhitelisted = user.email?.toLowerCase() === 'reiangelo.canete@neu.edu.ph' || user.email?.toLowerCase().includes('25-14294-549');

      if (hasAdminAccess || isWhitelisted) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        signOut(auth).then(() => router.push('/admin/login'));
      }
      setCheckingRole(false);
    }, () => {
      setIsAdmin(false);
      setCheckingRole(false);
    });
    return () => unsubscribe();
  }, [user, authLoading, router, db, auth]);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      sessionStorage.clear();
      window.location.href = '/admin/login';
    } catch (err) {
      console.error("[NEU Library Log Error] [AdminLayout] [SignOut]:", err);
    }
  };

  if (authLoading || checkingRole || isAdmin === null || !currentTime) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0a2a1a]">
        <Loader2 className="h-10 w-10 animate-spin text-[#c9a227]" />
        <p className="text-[#c9a227] font-black uppercase tracking-widest text-sm">Validating Credentials...</p>
      </div>
    );
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/logs', label: 'Visitor Logs', icon: Users, badge: todayCount },
    { href: '/admin/blocklist', label: 'Blocklist', icon: UserX, badge: blockedCount },
    { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
    { href: '/admin/reports', label: 'Reports', icon: FileText },
  ];

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-[#f0f4f1] w-full font-body overflow-hidden">
        <Sidebar className="border-r border-[#c9a227]/20 bg-[#0a2a1a] text-white">
          <SidebarHeader className="p-6 border-b border-[#c9a227]/10 flex flex-col items-center gap-3 bg-gradient-to-b from-[#071a0f] to-[#0a2a1a]">
            <img 
              src="/neu-library-logo.png" 
              alt="NEU Logo" 
              width={56} 
              height={56} 
              className="rounded-full shadow-lg border-2 border-[#c9a227]/40 ring-4 ring-[#c9a227]/10" 
              loading="lazy"
            />
            <div className="text-center w-full">
              <h2 className="text-base font-black text-[#c9a227] tracking-tight uppercase leading-none">NEU Library</h2>
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-2">Staff Portal</p>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-4 space-y-1">
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={`h-11 rounded-xl px-4 transition-all ${
                        isActive 
                          ? 'bg-gradient-to-r from-[#c9a227] to-[#a07d1a] text-[#0a2a1a] font-black shadow-md shadow-[#c9a227]/20' 
                          : 'text-white/60 hover:bg-white/8 hover:text-white'
                      }`}
                    >
                      <Link href={item.href} className="flex items-center gap-3">
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-[#0a2a1a]' : 'text-[#c9a227]'}`} />
                        <span className="text-sm font-semibold">{item.label}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <Badge className={`ml-auto border-none text-[10px] px-2 py-0.5 rounded-full min-w-[20px] h-[20px] flex items-center justify-center ${
                            item.href === '/admin/blocklist' ? 'bg-red-500 text-white' : 'bg-[#c9a227]/20 text-[#c9a227]'
                          }`}>
                            {item.badge}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-[#c9a227]/10">
            <Button 
              variant="ghost" 
              onClick={() => setShowLogoutModal(true)}
              className="w-full justify-start gap-3 h-11 rounded-xl text-red-400 hover:bg-red-400/10 hover:text-red-400 font-bold"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Sign Out</span>
            </Button>
          </SidebarFooter>
        </Sidebar>
        
        <SidebarInset className="flex flex-col flex-1 bg-[#f0f4f1] overflow-hidden">
          <header className="h-16 bg-white border-b border-[#d4e4d8] flex items-center justify-between px-8 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-[#1a3a2a]" />
              <div className="h-6 w-px bg-[#d4e4d8]" />
              <p className="text-xs font-bold text-[#4a6741] uppercase tracking-widest leading-none">
                {currentTime ? format(currentTime, 'EEEE, MMMM do, yyyy') : '--'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-[#1a3a2a] leading-none">{adminProfile?.fullName || adminProfile?.displayName || 'Library Admin'}</p>
                <p className="text-[10px] font-black text-[#c9a227] uppercase tracking-widest tabular-nums mt-1">
                  {currentTime ? format(currentTime, 'hh:mm:ss a') : '--'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-[#0a2a1a] border-2 border-[#c9a227]/30 flex items-center justify-center text-[#c9a227] font-black text-sm">
                {(adminProfile?.fullName || 'A').charAt(0)}
              </div>
            </div>
          </header>

          <main className="p-8 flex-1 bg-[#f0f4f1] overflow-y-auto">
            <div className="max-w-7xl mx-auto pb-12">
              {children}
            </div>
          </main>
        </SidebarInset>

        <Dialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
          <DialogContent className="rounded-2xl p-8 max-w-sm">
            <DialogHeader className="space-y-3 text-center">
              <div className="mx-auto bg-red-50 h-14 w-14 rounded-full flex items-center justify-center text-red-500">
                <LogOut className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold text-[#1a3a2a]">End Session?</DialogTitle>
              <DialogDescription className="text-[#4a6741] font-medium text-xs uppercase tracking-widest">
                Are you sure you want to sign out?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 gap-3 sm:flex-col">
              <Button onClick={handleLogout} className="w-full h-12 rounded-xl bg-red-600 text-white hover:bg-red-700 font-bold">Sign Out Now</Button>
              <Button variant="outline" onClick={() => setShowLogoutModal(false)} className="w-full h-12 rounded-xl border-[#d4e4d8] text-[#4a6741] font-bold">Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}
