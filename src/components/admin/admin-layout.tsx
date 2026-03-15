
"use client";

import { useEffect, useState, useMemo } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, UserX, LogOut, Loader2, FileText, ChevronRight, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db } from '@/firebase/config';
import { signOut } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useUser, useCollection } from '@/firebase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { format, startOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Real-time counts for badges
  const today = startOfDay(new Date());
  const visitsQuery = useMemo(() => query(collection(db, 'visits'), where('timestamp', '>=', today)), [today]);
  const blocklistQuery = useMemo(() => query(collection(db, 'blocklist')), []);
  
  const { data: todayVisits } = useCollection(visitsQuery);
  const { data: blocklist } = useCollection(blocklistQuery);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/admin/login');
      return;
    }

    const checkAdminRole = async () => {
      try {
        const q = query(collection(db, 'users'), where('email', '==', user.email));
        const unsubscribe = onSnapshot(q, (snap) => {
          let hasAdminAccess = false;
          const isWhitelisted = user.email?.startsWith('25-14294-549');

          if (!snap.empty) {
            const userData = snap.docs[0].data();
            hasAdminAccess = userData?.role === 'admin' || userData?.studentId === '25-14294-549';
          }

          if (hasAdminAccess || isWhitelisted) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            signOut(auth).then(() => router.push('/admin/login?error=Unauthorized'));
          }
          setCheckingRole(false);
        });
        return () => unsubscribe();
      } catch (error) {
        setIsAdmin(false);
        setCheckingRole(false);
      }
    };

    checkAdminRole();
  }, [user, authLoading, router]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/admin/login');
  };

  if (authLoading || checkingRole || isAdmin === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#0a2a1a]">
        <Loader2 className="h-12 w-12 animate-spin text-[#c9a227]" />
        <p className="text-[#c9a227] font-black uppercase tracking-widest text-[10px]">Staff Security Check...</p>
      </div>
    );
  }

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { label: 'Visitor Logs', icon: Users, path: '/admin/logs', badge: todayVisits?.length || 0, badgeColor: 'bg-emerald-500' },
    { label: 'Blocklist', icon: UserX, path: '/admin/blocklist', badge: blocklist?.length || 0, badgeColor: 'bg-red-500' },
    { label: 'Reports', icon: FileText, path: '/admin/reports' },
  ];

  return (
    <SidebarProvider style={{ "--sidebar-width": "280px" } as React.CSSProperties}>
      <div className="flex min-h-screen bg-[#f0f4f1] w-full font-body">
        <Sidebar className="border-r border-[#c9a227]/30 bg-[#0a2a1a] text-white">
          <SidebarHeader className="p-8 border-b border-[#c9a227]/10 flex flex-col items-center gap-4">
            <img 
              src="/neu-logo.png" 
              alt="NEU Logo" 
              width={80} 
              height={80} 
              className="rounded-full shadow-2xl border-2 border-[#c9a227]/40" 
            />
            <div className="text-center pb-2 border-b border-[#c9a227]/20 w-full">
              <h2 className="text-lg font-black text-[#c9a227] tracking-tight uppercase leading-none">NEU Library</h2>
              <p className="text-[9px] text-white/40 font-bold uppercase tracking-widest mt-1">Institutional Records</p>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-4 mt-4 space-y-2">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.path}
                    className={`h-12 rounded-xl px-4 transition-all duration-300 relative ${
                      pathname === item.path 
                        ? 'bg-[#c9a227] text-[#0a2a1a] font-black shadow-lg' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white font-bold'
                    }`}
                  >
                    <Link href={item.path} className="flex items-center gap-3">
                      <item.icon className={`h-5 w-5 ${pathname === item.path ? 'text-[#0a2a1a]' : 'text-[#c9a227]'}`} />
                      <span>{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <Badge className={`ml-auto ${item.badgeColor} text-white border-none text-[9px] font-black px-2 py-0.5 rounded-full`}>
                          {item.badge}
                        </Badge>
                      )}
                      {pathname === item.path && <ChevronRight className="ml-2 h-4 w-4" />}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          
          <SidebarFooter className="p-6 relative">
            <div className="absolute top-0 left-0 w-full h-20 bg-gradient-to-t from-[#0a2a1a] to-transparent pointer-events-none -translate-y-full opacity-60" />
            <Button 
              variant="ghost" 
              onClick={() => setShowLogoutModal(true)}
              className="w-full justify-start gap-3 h-12 rounded-xl text-red-400 hover:bg-red-400/10 hover:text-red-400 font-black transition-all"
            >
              <LogOut className="h-5 w-5" />
              <span>Logout</span>
            </Button>
          </SidebarFooter>
        </Sidebar>
        
        <SidebarInset className="flex flex-col flex-1">
          <header className="h-20 bg-white border-b border-[#d4e4d8] flex items-center justify-between px-10 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-6">
              <SidebarTrigger className="text-[#1a3a2a]" />
              <div className="h-8 w-px bg-[#d4e4d8]" />
              <div>
                <h1 className="text-xl font-black text-[#1a3a2a] tracking-tight">
                  {navItems.find(i => i.path === pathname)?.label || 'Administration'}
                </h1>
                <p className="text-[10px] font-black text-[#4a6741] uppercase tracking-widest">
                  {format(currentTime, 'EEEE, MMMM do, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right hidden md:block">
                <p className="text-sm font-black text-[#1a3a2a]">{user?.displayName || 'Administrator'}</p>
                <p className="text-[10px] font-black text-[#c9a227] uppercase tracking-widest tabular-nums">
                  {format(currentTime, 'hh:mm:ss a')}
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[#0a2a1a] border-2 border-[#c9a227]/30 flex items-center justify-center text-[#c9a227] font-black shadow-md transition-transform hover:scale-105">
                {user?.displayName?.charAt(0) || 'A'}
              </div>
            </div>
          </header>

          <main className="p-10 flex-1 animate-in fade-in duration-700 bg-[#f0f4f1]">
            {children}
          </main>
        </SidebarInset>

        <AlertDialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
          <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10 max-w-md">
            <AlertDialogHeader className="space-y-4">
              <AlertDialogTitle className="text-3xl font-black text-[#1a3a2a]">End Session?</AlertDialogTitle>
              <AlertDialogDescription className="text-[#4a6741] font-medium text-base">
                Are you sure you want to logout? You will need to re-authenticate to access the library archives.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 gap-4">
              <AlertDialogCancel className="rounded-2xl h-14 px-8 font-black border-[#d4e4d8] text-[#4a6741] hover:bg-[#f0f4f1] transition-all">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleLogout}
                className="rounded-2xl h-14 px-10 font-black bg-red-600 text-white hover:bg-red-700 shadow-xl shadow-red-100 transition-all"
              >
                Logout Now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarProvider>
  );
}
