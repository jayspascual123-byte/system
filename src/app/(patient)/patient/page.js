'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarRange, Clock, UserCheck, ShieldAlert, CheckCircle2, Search, Filter, Loader2, CalendarX2 } from 'lucide-react';

export default function PatientCoreModuleDashboard() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  
  const fetchDashboardData = useCallback(async (sessionUserId) => {
    try {
      // 1. Fetch available doctor slots
      const { data: availableSlots, error: slotsErr } = await supabase
        .from('doctor_schedule')
        .select(`
          id, 
          available_date, 
          available_time, 
          profiles:doctor_id (full_name, specialization)
        `)
        .eq('is_available', true)
        .order('available_date', { ascending: true })
        .order('available_time', { ascending: true });

      if (slotsErr) throw slotsErr;
      setSlots(availableSlots || []);

      // 2. Fetch current user's appointments
      const { data: myApps, error: appsErr } = await supabase
        .from('appointments')
        .select(`
          id, 
          status, 
          schedule_id,
          doctor_schedule:schedule_id (available_date, available_time), 
          doctor_profile:doctor_id (full_name, specialization)
        `)
        .eq('patient_id', sessionUserId)
        .order('created_at', { ascending: false });

      if (appsErr) throw appsErr;
      setAppointments(myApps || []);
    } catch (err) {
      console.error("Error fetching dashboard data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let sessionUser = null;
    let channel = null;

    async function initializeDashboard() {
      const { data: { user: curUser } } = await supabase.auth.getUser();
      if (!curUser) return;
      
      setUser(curUser);
      sessionUser = curUser;

      // Get profile role
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', curUser.id)
        .single();
      setProfile(userProfile);

      await fetchDashboardData(curUser.id);

      // Realtime listener setup
      channel = supabase
        .channel('patient-dashboard-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
          fetchDashboardData(sessionUser.id);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'doctor_schedule' }, () => {
          fetchDashboardData(sessionUser.id);
        })
        .subscribe();
    }

    initializeDashboard();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchDashboardData]);

  const dispatchAppointmentRequest = async (slotId, doctorId) => {
    if (!user) return;
    setBookingLoading(slotId);

    try {
      // 1. Double check slot availability
      const { data: slotCheck } = await supabase
        .from('doctor_schedule')
        .select('is_available')
        .eq('id', slotId)
        .single();

      if (!slotCheck?.is_available) {
        alert("This time slot is no longer available. It may have been booked just now.");
        return;
      }

      // 2. Insert appointment
      const { error: appErr } = await supabase.from('appointments').insert({
        patient_id: user.id,
        doctor_id: doctorId,
        schedule_id: slotId,
        status: 'Pending'
      });

      if (appErr) throw appErr;

      // 3. Mark schedule slot as unavailable
      const { error: schedErr } = await supabase
        .from('doctor_schedule')
        .update({ is_available: false })
        .eq('id', slotId);

      if (schedErr) throw schedErr;
      
      // Update UI state
      await fetchDashboardData(user.id);
    } catch (err) {
      alert("Error booking appointment: " + err.message);
    } finally {
      setBookingLoading(null);
    }
  };

  const cancelAppointmentAction = async (appId, schedId) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    setCancelLoading(appId);

    try {
      // Update appointment status to Cancelled
      const { error: appErr } = await supabase
        .from('appointments')
        .update({ status: 'Cancelled' })
        .eq('id', appId);

      if (appErr) throw appErr;

      // Release the doctor slot back to available
      const { error: schedErr } = await supabase
        .from('doctor_schedule')
        .update({ is_available: true })
        .eq('id', schedId);

      if (schedErr) throw schedErr;

      await fetchDashboardData(user.id);
    } catch (err) {
      alert("Error cancelling appointment: " + err.message);
    } finally {
      setCancelLoading(null);
    }
  };

  // Extract unique specializations for filter dropdown
  const specialties = ['All', ...new Set(slots.map(s => s.profiles?.specialization).filter(Boolean))];

  // Filter slots
  const filteredSlots = slots.filter(slot => {
    const docName = slot.profiles?.full_name?.toLowerCase() || '';
    const docSpec = slot.profiles?.specialization || '';
    const matchesSearch = docName.includes(searchQuery.toLowerCase());
    const matchesSpecialty = selectedSpecialty === 'All' || docSpec === selectedSpecialty;
    return matchesSearch && matchesSpecialty;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Patient Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">
            {profile ? `Logged in as ${profile.full_name}` : 'Checking profile session...'}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
          <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping"></span>
          <span>Live sync active</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 text-teal-500 animate-spin" />
          <p className="text-sm text-slate-400">Fetching live schedules...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Slots Booking Card Grid */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Available Time Slots</h2>
                <p className="text-xs text-slate-400 mt-0.5">Select a practitioner and request an appointment slot.</p>
              </div>

              {/* Filters Panel */}
              <div className="flex gap-2 items-center">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search doctor..."
                    className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-teal-500 text-white placeholder-slate-500 w-36 sm:w-44"
                  />
                </div>
                <div className="relative">
                  <select
                    value={selectedSpecialty}
                    onChange={(e) => setSelectedSpecialty(e.target.value)}
                    className="pl-3 pr-8 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs focus:outline-none focus:border-teal-500 text-slate-300 appearance-none"
                  >
                    {specialties.map(spec => (
                      <option key={spec} value={spec}>{spec}</option>
                    ))}
                  </select>
                  <Filter className="absolute right-2.5 top-2.5 h-3 w-3 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {filteredSlots.length === 0 ? (
              <div className="glass-panel p-10 rounded-2xl text-center space-y-3">
                <CalendarX2 className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm font-semibold">No available slots found</p>
                <p className="text-xs text-slate-500">There are no open slots matching your search parameters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-1">
                {filteredSlots.map(slot => (
                  <div key={slot.id} className="glass-card p-5 rounded-2xl flex flex-col justify-between gap-4 hover:border-teal-500/30 transition-all group">
                    <div className="space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-white text-sm group-hover:text-teal-400 transition">{slot.profiles?.full_name}</h4>
                          <span className="text-[10px] bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full font-bold uppercase mt-1 inline-block border border-teal-500/15">
                            {slot.profiles?.specialization || 'General Practitioner'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1 pt-2 border-t border-slate-800/40 text-xs text-slate-400">
                        <div className="flex items-center gap-2">
                          <CalendarRange className="h-3.5 w-3.5 text-slate-500" />
                          <span>{slot.available_date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          <span>{slot.available_time}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => dispatchAppointmentRequest(slot.id, slot.doctor_id)}
                      disabled={bookingLoading === slot.id}
                      className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 rounded-xl text-xs transition-all shadow hover:shadow-teal-500/10 active:scale-98 disabled:bg-slate-800 disabled:text-slate-600 disabled:shadow-none flex items-center justify-center gap-1.5"
                    >
                      {bookingLoading === slot.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        'Request Appointment'
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: My Appointments Card */}
          <div className="lg:col-span-5 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white">My Appointments</h2>
              <p className="text-xs text-slate-400 mt-0.5">Track, verify, and cancel your submitted scheduling requests.</p>
            </div>

            {appointments.length === 0 ? (
              <div className="glass-panel p-10 rounded-2xl text-center space-y-3">
                <CalendarRange className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm font-semibold">No appointments scheduled</p>
                <p className="text-xs text-slate-500">Your requested slots will show up here.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {appointments.map(app => {
                  const statusColors = {
                    Pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                    Confirmed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    Cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
                    Rescheduled: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                  };

                  return (
                    <div key={app.id} className="glass-card p-5 rounded-2xl space-y-4 border border-slate-800/50">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-white text-sm">{app.doctor_profile?.full_name}</h4>
                          <p className="text-[10px] text-slate-400 uppercase mt-0.5">{app.doctor_profile?.specialization || 'General Doctor'}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${statusColors[app.status] || 'bg-slate-500/10 text-slate-400 border-slate-800'}`}>
                          {app.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/40">
                        <div className="flex items-center gap-1.5">
                          <CalendarRange className="h-3.5 w-3.5 text-slate-500" />
                          <span>{app.doctor_schedule?.available_date || 'N/A'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          <span>{app.doctor_schedule?.available_time || 'N/A'}</span>
                        </div>
                      </div>

                      {(app.status === 'Pending' || app.status === 'Confirmed') && (
                        <button
                          onClick={() => cancelAppointmentAction(app.id, app.schedule_id)}
                          disabled={cancelLoading === app.id}
                          className="w-full bg-red-950/20 hover:bg-red-500/10 text-red-400 hover:text-red-300 border border-red-500/20 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                        >
                          {cancelLoading === app.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            'Cancel Appointment'
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  );
}
