'use client';

import { useEffect, useState, useMemo } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, UserX, LogOut, Loader2, FileText, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUser, useCollection, useFirestore, useAuth } from '@/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const visitsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'visits'), where('timestamp', '>=', todayDate));
  }, [db, todayDate]);

  const blocklistQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'blocklist'));
  }, [db]);
  
  const { data: todayVisits } = useCollection(visitsQuery);
  const { data: blocklist } = useCollection(blocklistQuery);

  useEffect(() => {
    if (authLoading || !db || !auth) return;
    if (!user) {
      setIsAdmin(false);
      setCheckingRole(false);
      router.push('/admin/login');
      return;
    }

    const email = user.email?.toLowerCase();
    const isWhitelisted = email === 'reiangelo.canete@neu.edu.ph' || email?.includes('25-14294-549');

    const unsubscribe = onSnapshot(query(collection(db, 'users'), where('email', '==', user.email)), (snap) => {
      let hasAdminAccess = false;
      if (!snap.empty) {
        const userData = snap.docs[0].data();
        hasAdminAccess = userData?.role === 'admin' || userData?.studentId === '25-14294-549';
      }
      
      if (hasAdminAccess || isWhitelisted) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
        signOut(auth).then(() => router.push('/admin/login'));
      }
      setCheckingRole(false);
    }, (error) => {
      console.error("Admin check failed:", error);
      setIsAdmin(false);
      setCheckingRole(false);
    });
    return () => unsubscribe();
  }, [user, authLoading, router, db, auth]);

  const handleLogout = async () => {
    if (!auth) return;
    try {
      await signOut(auth);
      router.push('/admin/login');
    } catch (err) {
      console.error("Sign out failed:", err);
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
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { label: 'Visitor Logs', icon: Users, path: '/admin/logs', badge: todayVisits?.length || 0, badgeColor: 'bg-emerald-500' },
    { label: 'Blocklist', icon: UserX, path: '/admin/blocklist', badge: blocklist?.length || 0, badgeColor: 'bg-red-500' },
    { label: 'Announcements', icon: Megaphone, path: '/admin/announcements' },
    { label: 'Reports', icon: FileText, path: '/admin/reports' },
  ];

  return (
    <SidebarProvider style={{ "--sidebar-width": "260px" } as React.CSSProperties}>
      <div className="flex h-screen bg-[#f0f4f1] w-full font-body overflow-hidden">
        <Sidebar className="border-r border-[#c9a227]/20 bg-[#0a2a1a] text-white">
          <SidebarHeader className="p-6 border-b border-[#c9a227]/10 flex flex-col items-center gap-4">
            <img 
              src="/neu-logo.png" 
              alt="NEU Logo" 
              width={56} 
              height={56} 
              className="rounded-full shadow-lg border-2 border-[#c9a227]/40" 
            />
            <div className="text-center w-full">
              <h2 className="text-base font-black text-[#c9a227] tracking-tight uppercase leading-none">NEU Library</h2>
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest mt-2">Staff Portal</p>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-4 space-y-1">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.path}
                    className={`h-12 rounded-xl px-4 transition-all ${
                      pathname === item.path 
                        ? 'bg-[#c9a227] text-[#0a2a1a] font-black shadow-md' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white font-bold'
                    }`}
                  >
                    <Link href={item.path} className="flex items-center gap-3">
                      <item.icon className={`h-4 w-4 ${pathname === item.path ? 'text-[#0a2a1a]' : 'text-[#c9a227]'}`} />
                      <span className="text-sm font-bold">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <Badge className={`ml-auto ${item.badgeColor} text-white border-none text-[10px] font-black px-2 py-0.5 rounded-full min-w-[22px] h-[22px] flex items-center justify-center`}>
                          {item.badge}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 border-t border-[#c9a227]/10">
            <Button 
              variant="ghost" 
              onClick={() => setShowLogoutModal(true)}
              className="w-full justify-start gap-3 h-12 rounded-xl text-red-400 hover:bg-red-400/10 hover:text-red-400 font-black transition-all"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Sign Out</span>
            </Button>
          </SidebarFooter>
        </Sidebar>
        
        <SidebarInset className="flex flex-col flex-1 bg-[#f0f4f1] overflow-hidden">
          <header className="h-20 bg-white border-b border-[#d4e4d8] flex items-center justify-between px-8 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-6">
              <SidebarTrigger className="text-[#1a3a2a] scale-125" />
              <div className="h-8 w-px bg-[#d4e4d8]" />
              <div>
                <h1 className="text-lg font-black text-[#1a3a2a] tracking-tight uppercase">
                  {navItems.find(i => i.path === pathname)?.label || 'Administration'}
                </h1>
                <p className="text-xs font-bold text-[#4a6741] uppercase tracking-widest leading-none mt-1">
                  {format(currentTime, 'EEEE, MMMM do, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-black text-[#1a3a2a] leading-none">{user?.displayName || 'Admin'}</p>
                <p className="text-[10px] font-black text-[#c9a227] uppercase tracking-widest tabular-nums mt-1">
                  {format(currentTime, 'hh:mm:ss a')}
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[#0a2a1a] border-2 border-[#c9a227]/30 flex items-center justify-center text-[#c9a227] font-black shadow-sm text-base">
                {user?.displayName?.charAt(0) || 'A'}
              </div>
            </div>
          </header>

          <main className="p-8 flex-1 bg-[#f0f4f1] overflow-y-auto">
            <div className="max-w-7xl mx-auto pb-12">
              {children}
            </div>
          </main>
        </SidebarInset>

        <AlertDialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
          <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl p-10 max-w-sm">
            <AlertDialogHeader className="space-y-3 text-center">
              <div className="mx-auto bg-red-50 h-16 w-16 rounded-full flex items-center justify-center text-red-500">
                <LogOut className="h-8 w-8" />
              </div>
              <AlertDialogTitle className="text-2xl font-black text-[#1a3a2a]">End Session?</AlertDialogTitle>
              <AlertDialogDescription className="text-[#4a6741] font-bold text-sm uppercase tracking-widest">
                You will need to sign in again to access the portal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 gap-4 sm:flex-col">
              <AlertDialogAction 
                onClick={handleLogout}
                className="w-full rounded-2xl h-14 font-black bg-red-600 text-white hover:bg-red-700 text-base"
              >
                Sign Out Now
              </AlertDialogAction>
              <AlertDialogCancel className="w-full rounded-2xl h-14 font-black border-[#d4e4d8] text-[#4a6741] text-base">
                Cancel
              </AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarProvider>
  );
}
