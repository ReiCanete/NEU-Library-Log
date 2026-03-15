"use client";

import { useEffect, useState } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarFooter } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, UserX, LogOut, Loader2, FileText, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db as firestore } from '@/firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useUser } from '@/firebase';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

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
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        const userData = userDoc.data();
        const hasAdminAccess = userData?.role === 'admin' || userData?.studentId === '25-14294-549';

        if (userDoc.exists() && hasAdminAccess) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          await signOut(auth);
          router.push('/admin/login?error=Unauthorized access');
        }
      } catch (error) {
        setIsAdmin(false);
      } finally {
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
        <p className="text-[#c9a227] font-black uppercase tracking-widest text-xs">Authenticating Staff...</p>
      </div>
    );
  }

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
    { label: 'Visitor Logs', icon: Users, path: '/admin/logs' },
    { label: 'Blocklist', icon: UserX, path: '/admin/blocklist' },
    { label: 'Reports', icon: FileText, path: '/admin/reports' },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[#f8fafc] w-full font-body">
        <Sidebar className="border-r border-[#c9a227]/20 bg-[#0a2a1a] text-white">
          <SidebarHeader className="p-8 border-b border-[#c9a227]/10 flex flex-col items-center gap-4">
            <img 
              src="/neu-logo.png" 
              alt="NEU Logo" 
              width={80} 
              height={80} 
              className="rounded-full shadow-lg border-2 border-[#c9a227]/30" 
            />
            <div className="text-center">
              <h2 className="text-lg font-black text-[#c9a227] tracking-tight uppercase leading-none">NEU Library</h2>
              <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Staff Control Panel</p>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-4 mt-4">
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === item.path}
                    className={`h-12 rounded-xl px-4 transition-all duration-300 ${
                      pathname === item.path 
                        ? 'bg-[#c9a227] text-[#0a2a1a] font-black shadow-lg scale-[1.02]' 
                        : 'text-white/60 hover:bg-white/5 hover:text-white font-bold'
                    }`}
                  >
                    <Link href={item.path} className="flex items-center gap-3">
                      <item.icon className={`h-5 w-5 ${pathname === item.path ? 'text-[#0a2a1a]' : 'text-[#c9a227]'}`} />
                      <span>{item.label}</span>
                      {pathname === item.path && <ChevronRight className="ml-auto h-4 w-4" />}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-6 border-t border-[#c9a227]/10">
            <Button 
              variant="ghost" 
              onClick={() => setShowLogoutModal(true)}
              className="w-full justify-start gap-3 h-12 rounded-xl text-red-400 hover:bg-red-400/10 hover:text-red-400 font-bold transition-all"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </Button>
          </SidebarFooter>
        </Sidebar>
        
        <SidebarInset className="flex flex-col flex-1">
          <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-10 sticky top-0 z-50 shadow-sm">
            <div className="flex items-center gap-6">
              <SidebarTrigger className="text-[#0a2a1a]" />
              <div className="h-8 w-px bg-slate-200" />
              <div>
                <h1 className="text-xl font-black text-[#0a2a1a] tracking-tight">
                  {navItems.find(i => i.path === pathname)?.label || 'Administration'}
                </h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {format(currentTime, 'EEEE, MMMM do, yyyy')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="text-right hidden md:block">
                <p className="text-sm font-black text-[#0a2a1a]">{user?.displayName || 'Administrator'}</p>
                <p className="text-[10px] font-bold text-[#c9a227] uppercase tracking-widest tabular-nums">
                  {format(currentTime, 'hh:mm:ss a')}
                </p>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-[#0a2a1a] border-2 border-[#c9a227]/20 flex items-center justify-center text-[#c9a227] font-black shadow-md transition-transform hover:scale-105">
                {user?.displayName?.charAt(0) || 'A'}
              </div>
            </div>
          </header>

          <main className="p-10 flex-1 animate-in fade-in duration-700 bg-[#f8fafc]">
            {children}
          </main>
        </SidebarInset>

        <AlertDialog open={showLogoutModal} onOpenChange={setShowLogoutModal}>
          <AlertDialogContent className="rounded-[2.5rem] border-none shadow-2xl p-10 max-w-md">
            <AlertDialogHeader className="space-y-4">
              <AlertDialogTitle className="text-3xl font-black text-[#0a2a1a]">Confirm Sign Out</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 font-medium text-base">
                Are you sure you want to end your session? You will need to sign in again to access the Staff Portal.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-8 gap-4">
              <AlertDialogCancel className="rounded-2xl h-14 px-8 font-black border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleLogout}
                className="rounded-2xl h-14 px-10 font-black bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-200 transition-all"
              >
                Sign Out Now
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SidebarProvider>
  );
}
