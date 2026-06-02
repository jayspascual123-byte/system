'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Activity, LogOut, User, CalendarDays, Menu, X } from 'lucide-react';
import Link from 'next/link';

export default function DoctorLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    async function loadUserProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/');
        return;
      }
      
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      setProfile(userProfile);
    }
    loadUserProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const navLinks = [
    { name: 'Doctor Console', path: '/doctor', icon: CalendarDays },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Mobile Top Bar */}
      <div className="md:hidden w-full flex items-center justify-between p-4 bg-slate-900 border-b border-slate-800 fixed top-0 left-0 z-40 no-print">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-teal-400" />
          <span className="font-bold tracking-wider text-sm">MEDICLOUD</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 rounded-lg bg-slate-800 text-slate-300">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`fixed md:sticky top-0 left-0 z-30 h-screen w-64 bg-slate-900 border-r border-slate-800/80 p-6 flex flex-col justify-between transform transition-transform duration-300 md:translate-x-0 no-print ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:block'}`}>
        <div className="space-y-8 mt-12 md:mt-0">
          {/* Logo Branding */}
          <div className="flex items-center gap-3">
            <div className="bg-teal-500/10 p-2 rounded-xl border border-teal-500/20">
              <Activity className="h-6 w-6 text-teal-400" />
            </div>
            <div>
              <h2 className="font-extrabold tracking-tight text-white text-lg leading-none">MEDICLOUD</h2>
              <span className="text-[10px] font-bold text-teal-400 tracking-widest uppercase">Physician Hub</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.path;
              return (
                <Link
                  key={link.path}
                  href={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={`sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{link.name}</span>
                  </div>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Profile Card & Logout */}
        <div className="space-y-4 pt-6 border-t border-slate-800/60">
          {profile && (
            <div className="flex flex-col gap-1 p-3 bg-slate-950/40 rounded-xl border border-slate-800/30">
              <div className="flex items-center gap-2">
                <div className="bg-teal-500/10 p-1.5 rounded-lg text-teal-400 shrink-0">
                  <User className="h-3.5 w-3.5" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-white truncate">{profile.full_name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{profile.email}</p>
                </div>
              </div>
              {profile.specialization && (
                <p className="text-[9px] bg-teal-500/10 text-teal-300 font-bold px-2 py-0.5 rounded uppercase self-start border border-teal-500/10 mt-1">
                  {profile.specialization}
                </p>
              )}
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 md:pl-0 pt-16 md:pt-0">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
