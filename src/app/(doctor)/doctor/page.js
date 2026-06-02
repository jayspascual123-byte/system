'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarCheck, Clock, ListPlus, Bell, BadgeAlert, Sparkles, User, Settings, CheckCircle2, XCircle, Trash2, Loader2 } from 'lucide-react';

export default function DoctorCoreModuleDashboard() {
  const [docId, setDocId] = useState(null);
  const [profile, setProfile] = useState(null);
  
  // Form states
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [contact, setContact] = useState('');
  
  // Data states
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  
  // Status states
  const [loading, setLoading] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(null);
  
  // Real-time notification toast
  const [newBookingAlert, setNewBookingAlert] = useState(null);

  const fetchDoctorData = useCallback(async (doctorId) => {
    try {
      // 1. Fetch published schedule slots
      const { data: mySlots, error: slotsErr } = await supabase
        .from('doctor_schedule')
        .select('*')
        .eq('doctor_id', doctorId)
        .order('available_date', { ascending: true })
        .order('available_time', { ascending: true });

      if (slotsErr) throw slotsErr;
      setSlots(mySlots || []);

      // 2. Fetch patient appointments linked to this doctor
      const { data: myApps, error: appsErr } = await supabase
        .from('appointments')
        .select(`
          id, 
          status, 
          doctor_schedule:schedule_id (available_date, available_time), 
          patient_profile:patient_id (full_name, contact, email)
        `)
        .eq('doctor_id', doctorId)
        .order('id', { ascending: false });

      if (appsErr) throw appsErr;
      setAppointments(myApps || []);

      // 3. Fetch doctor's profile details
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', doctorId)
        .single();
      
      if (profErr) throw profErr;
      setProfile(prof);
      setSpecialization(prof.specialization || '');
      setContact(prof.contact || '');
    } catch (err) {
      console.error("Error loading doctor data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let activeDocId = null;
    let channel = null;

    async function initializeDoctorDashboard() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setDocId(user.id);
      activeDocId = user.id;

      await fetchDoctorData(user.id);

      // Realtime notification channel subscription
      // Listens for INSERT in appointments table where doctor_id matches
      channel = supabase
        .channel('doctor-live-stream')
        .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'appointments',
          filter: `doctor_id=eq.${user.id}`
        }, (payload) => {
          // Play notification alert or toast
          setNewBookingAlert("Notification: A patient has requested a new appointment slot!");
          
          // Audio cue fallback or standard alert if backgrounded
          try {
            if (typeof window !== 'undefined' && 'Notification' in window) {
              if (Notification.permission === 'granted') {
                new Notification("New Appointment Requested", {
                  body: "A patient has scheduled a slot in your clinic."
                });
              }
            }
          } catch (e) {
            console.error("Notification API error", e);
          }

          // Auto-fetch new records to update list immediately
          fetchDoctorData(activeDocId);
        })
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'appointments',
          filter: `doctor_id=eq.${user.id}`
        }, () => {
          fetchDoctorData(activeDocId);
        })
        .subscribe();
    }

    initializeDoctorDashboard();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [fetchDoctorData]);

  const handleScheduleAddition = async (e) => {
    e.preventDefault();
    if (!date || !time || !docId) return;
    setFormSubmitting(true);

    try {
      const { error } = await supabase.from('doctor_schedule').insert({
        doctor_id: docId,
        available_date: date,
        available_time: time,
        is_available: true
      });

      if (error) throw error;

      // Reset form fields
      setDate('');
      setTime('');
      await fetchDoctorData(docId);
    } catch (err) {
      alert("Error adding availability: " + err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleProfileSettingsUpdate = async (e) => {
    e.preventDefault();
    if (!docId) return;
    setProfileSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          specialization,
          contact
        })
        .eq('id', docId);

      if (error) throw error;
      
      alert("Professional profile details updated successfully!");
      await fetchDoctorData(docId);
    } catch (err) {
      alert("Error updating professional details: " + err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!confirm("Are you sure you want to remove this published slot?")) return;
    setDeleteLoading(slotId);

    try {
      const { error } = await supabase
        .from('doctor_schedule')
        .delete()
        .eq('id', slotId);

      if (error) throw error;

      await fetchDoctorData(docId);
    } catch (err) {
      alert("Error deleting slot: " + err.message);
    } finally {
      setDeleteLoading(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Realtime Alert Banner */}
      {newBookingAlert && (
        <div className="bg-teal-950/80 border-2 border-teal-500 text-teal-300 p-4 rounded-2xl flex items-center justify-between shadow-lg animate-bounce">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-teal-400 animate-swing" />
            <div>
              <p className="font-bold text-sm">Real-time Booking Alert</p>
              <p className="text-xs opacity-90">{newBookingAlert}</p>
            </div>
          </div>
          <button 
            onClick={() => setNewBookingAlert(null)}
            className="text-xs font-bold bg-teal-500/20 hover:bg-teal-500/40 text-teal-400 px-3 py-1 rounded-xl transition"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Doctor Console</h1>
          <p className="text-sm text-slate-400 mt-1">
            {profile ? `Dr. ${profile.full_name} | ${profile.specialization || 'General Practice'}` : 'Loading session...'}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300">
          <span className="h-2 w-2 rounded-full bg-teal-400 animate-ping"></span>
          <span>Live notification stream active</span>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 text-teal-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading physician records...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Availability Scheduler & Profile Info */}
          <div className="lg:col-span-5 space-y-8">
            
            {/* Availability Setup Form */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-white">
                <ListPlus className="h-5 w-5 text-teal-400" />
                <h2 className="text-lg font-bold">Publish Availability Slot</h2>
              </div>
              <form onSubmit={handleScheduleAddition} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Target Date</label>
                    <input 
                      type="date" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-white" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Time Slot</label>
                    <input 
                      type="time" 
                      value={time} 
                      onChange={(e) => setTime(e.target.value)} 
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-white" 
                      required 
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={formSubmitting}
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow flex items-center justify-center gap-1.5"
                >
                  {formSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Publish Availability Slot'}
                </button>
              </form>
            </div>

            {/* Profile Settings Editor */}
            <div className="glass-panel p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-2.5 text-white">
                <Settings className="h-5 w-5 text-teal-400" />
                <h2 className="text-lg font-bold">Practice Specialization</h2>
              </div>
              <form onSubmit={handleProfileSettingsUpdate} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Medical Specialization</label>
                  <input 
                    type="text" 
                    value={specialization} 
                    onChange={(e) => setSpecialization(e.target.value)} 
                    placeholder="e.g. Cardiology, Pediatrics, Dermatology"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-white" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Contact Number</label>
                  <input 
                    type="text" 
                    value={contact} 
                    onChange={(e) => setContact(e.target.value)} 
                    placeholder="+63 900 000 0000"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-white" 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={profileSaving}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow flex items-center justify-center gap-1.5"
                >
                  {profileSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Update Practice Settings'}
                </button>
              </form>
            </div>

          </div>

          {/* RIGHT COLUMN: Published Slots Grid & Patient Stream */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* Published Slots Grid */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">My Published Schedule</h2>
              {slots.length === 0 ? (
                <div className="glass-panel p-8 rounded-2xl text-center text-slate-400 text-sm">
                  No availability slots published yet. Use the scheduler form to register hours.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-56 overflow-y-auto pr-1">
                  {slots.map(slot => (
                    <div key={slot.id} className="glass-card p-4 rounded-xl flex items-center justify-between gap-3 border border-slate-800/40">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <CalendarCheck className="h-3.5 w-3.5 text-teal-400" />
                          <span className="font-semibold">{slot.available_date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-400">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          <span>{slot.available_time}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${slot.is_available ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                          {slot.is_available ? 'Available' : 'Booked'}
                        </span>
                        {slot.is_available && (
                          <button
                            onClick={() => handleDeleteSlot(slot.id)}
                            disabled={deleteLoading === slot.id}
                            className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800/50 transition"
                          >
                            {deleteLoading === slot.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Patient Appointments Stream */}
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">Linked Patient Stream</h2>
              {appointments.length === 0 ? (
                <div className="glass-panel p-8 rounded-2xl text-center text-slate-400 text-sm">
                  No appointments registered with your practice yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="table-th">Patient Info</th>
                        <th className="table-th">Schedule Time</th>
                        <th className="table-th">Contact</th>
                        <th className="table-th">State</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.map(app => {
                        const statusColors = {
                          Pending: 'text-amber-400 bg-amber-500/10 border-amber-500/15',
                          Confirmed: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15',
                          Cancelled: 'text-red-400 bg-red-500/10 border-red-500/15',
                          Rescheduled: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/15'
                        };

                        return (
                          <tr key={app.id}>
                            <td className="table-td">
                              <div>
                                <p className="font-bold text-white">{app.patient_profile?.full_name}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{app.patient_profile?.email}</p>
                              </div>
                            </td>
                            <td className="table-td">
                              <div className="text-xs">
                                <p className="font-semibold text-slate-300">{app.doctor_schedule?.available_date}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">at {app.doctor_schedule?.available_time}</p>
                              </div>
                            </td>
                            <td className="table-td font-mono text-xs">
                              {app.patient_profile?.contact || 'N/A'}
                            </td>
                            <td className="table-td">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${statusColors[app.status] || 'bg-slate-800 text-slate-400'}`}>
                                {app.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
