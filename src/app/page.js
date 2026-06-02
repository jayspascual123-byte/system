'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Activity, Mail, Lock, User, Shield, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';

export default function EntryAuthenticationPortal() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('patient');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const router = useRouter();

  const handleAuthAction = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isSignUp) {
        // Sign Up Flow
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split('@')[0],
              full_name: fullName || 'Anonymous User',
              role: role
            }
          }
        });

        if (authErr) throw authErr;

        setSuccess("Account registered! If confirmation is required, please check your email. Otherwise, you can log in.");
        setIsSignUp(false);
      } else {
        // Sign In Flow
        const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
        
        if (authErr) throw authErr;

        // Fetch profile to check role
        const { data: profile, error: profErr } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', authData.user.id)
          .single();

        if (profErr || !profile) {
          throw new Error("Your user profile details could not be found in the database. Ensure database tables are initialised.");
        }

        // Redirect based on role
        if (profile.role === 'patient') {
          router.push('/patient');
        } else if (profile.role === 'doctor') {
          router.push('/doctor');
        } else if (profile.role === 'admin') {
          router.push('/admin');
        } else {
          throw new Error("Invalid or unassigned user role.");
        }
      }
    } catch (err) {
      setError(err.message || "An unexpected authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 items-center justify-center p-4 relative overflow-hidden">
      {/* Background gradients for premium feel */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-900/20 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-900/20 rounded-full blur-3xl -z-10 animate-pulse delay-700"></div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* Branding & info panel */}
        <div className="md:col-span-5 space-y-6 text-center md:text-left">
          <div className="flex items-center gap-3 justify-center md:justify-start">
            <div className="bg-teal-500/20 p-3 rounded-2xl border border-teal-500/30">
              <Activity className="h-8 w-8 text-teal-400" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white">MEDICLOUD</h1>
              <p className="text-xs font-bold text-teal-400 tracking-wider uppercase">Clinic Care Portal</p>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-xl md:text-2xl font-bold leading-snug text-slate-200">
              Seamless Healthcare Management & Real-time Scheduling.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Connect patient care, physician scheduling, and records audits in a single secure environment powered by Next.js and Supabase Realtime.
            </p>
          </div>

          <div className="hidden md:block pt-4 border-t border-slate-900 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Roles & Workspaces</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ChevronRight className="h-3 w-3 text-teal-400" />
              <span>Patients: Book & cancel doctor schedules</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ChevronRight className="h-3 w-3 text-teal-400" />
              <span>Doctors: Set availability, view patient flow</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ChevronRight className="h-3 w-3 text-teal-400" />
              <span>Admins: Live status overrides & medical logs</span>
            </div>
          </div>
        </div>

        {/* Auth form card */}
        <div className="md:col-span-7 glass-panel p-8 rounded-3xl shadow-2xl relative">
          <div className="flex justify-between items-center mb-8 border-b border-slate-900 pb-4">
            <div>
              <h3 className="text-2xl font-bold text-white">{isSignUp ? 'Create Account' : 'Sign In'}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {isSignUp ? 'Register to access patient booking' : 'Access your role-based dashboard'}
              </p>
            </div>
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccess(null);
              }}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition"
            >
              {isSignUp ? 'Back to Login' : 'Register Account'}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-950/40 border border-red-500/30 text-red-400 text-sm rounded-xl flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Authentication Error</p>
                <p className="text-xs mt-0.5 opacity-90">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-teal-950/40 border border-teal-500/30 text-teal-400 text-sm rounded-xl flex items-start gap-2">
              <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">{success}</p>
            </div>
          )}

          <form onSubmit={handleAuthAction} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-white"
                      placeholder="Dr. John Doe / Jane Smith"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Username</label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-white"
                      placeholder="johndoe123"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-white"
                  placeholder="name@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-white"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Choose Role</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-slate-300 appearance-none"
                  >
                    <option value="patient">Patient (Default Access)</option>
                    <option value="doctor">Doctor (Medical & Availability)</option>
                    <option value="admin">Admin (Full System Override)</option>
                  </select>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg hover:shadow-teal-500/20 active:scale-98 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none flex items-center justify-center gap-2 mt-6"
            >
              {loading ? 'Processing Transaction...' : isSignUp ? 'Create User Profile' : 'Authenticate Credentials'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
