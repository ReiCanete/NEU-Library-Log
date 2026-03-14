"use client";

import { useEffect, useState } from 'react';
import { SidebarProvider, Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { LayoutDashboard, Users, UserX, LogOut, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { auth, db as firestore } from '@/firebase/config';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { useUser } from '@/firebase';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/admin/login');
      return;
    }

    const checkAdminRole = async () => {
      try {
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
          await signOut(auth);
          router.push('/admin/login?error=Unauthorized access');
        }
      } catch (error) {
        console.error("Error checking admin role:", error);
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Verifying Administrator Access...</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-slate-50 w-full">
        <Sidebar className="border-r border-slate-200">
          <SidebarHeader className="p-6 border-b border-slate-200">
            <h2 className="text-xl font-bold text-primary">NEU Library Log</h2>
            <p className="text-xs text-muted-foreground">Admin Control Panel</p>
          </SidebarHeader>
          <SidebarContent className="p-4">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin'}>
                  <Link href="/admin" className="flex items-center gap-3">
                    <LayoutDashboard className="h-5 w-5" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin/logs'}>
                  <Link href="/admin/logs" className="flex items-center gap-3">
                    <Users className="h-5 w-5" />
                    <span>Visitor Logs</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/admin/blocklist'}>
                  <Link href="/admin/blocklist" className="flex items-center gap-3">
                    <UserX className="h-5 w-5" />
                    <span>Blocklist</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <div className="mt-auto pt-8 border-t border-slate-200">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={handleLogout} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <LogOut className="h-5 w-5" />
                    <span>Sign Out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </div>
          </SidebarContent>
        </Sidebar>
        
        <SidebarInset className="flex flex-col flex-1">
          <header className="h-16 border-b bg-white flex items-center justify-between px-8 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <h1 className="text-lg font-semibold capitalize">
                {pathname === '/admin' ? 'Overview' : pathname.split('/').pop()?.replace('-', ' ')}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium">{user?.displayName || 'Administrator'}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                {user?.displayName?.charAt(0) || 'A'}
              </div>
            </div>
          </header>
          <main className="p-8 flex-1 animate-in fade-in duration-500">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
