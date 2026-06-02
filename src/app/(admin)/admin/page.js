'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, CalendarDays, CheckSquare, Award, Loader2, RefreshCw, XCircle, CheckCircle2 } from 'lucide-react';

export default function AdministrativeActionDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [metrics, setMetrics] = useState({ patients: 0, doctors: 0, appointments: 0, confirmed: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  const loadAdminData = useCallback(async () => {
    try {
      // 1. Fetch all system appointments with patient and doctor details
      const { data: allApps, error: appsErr } = await supabase
        .from('appointments')
        .select(`
          id, 
          status, 
          schedule_id, 
          doctor_schedule:schedule_id (available_date, available_time), 
          patient:profiles!patient_id (full_name, email), 
          doctor:profiles!doctor_id (full_name, specialization)
        `)
        .order('id', { ascending: false });
      
      if (appsErr) throw appsErr;
      const appList = allApps || [];
      setAppointments(appList);

      // 2. Fetch metrics counts
      const { count: patientCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'patient');

      const { count: doctorCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'doctor');

      const confirmedCount = appList.filter(a => a.status === 'Confirmed').length;

      setMetrics({
        patients: patientCount || 0,
        doctors: doctorCount || 0,
        appointments: appList.length,
        confirmed: confirmedCount
      });
    } catch (err) {
      console.error("Error loading administrative data:", err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let channel = null;
    loadAdminData();

    // Subscribe to all changes in the appointments table
    channel = supabase
      .channel('admin-dashboard-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        loadAdminData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadAdminData();
      })
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadAdminData]);

  const adjustStatusAction = async (appId, targetStatus, scheduleId) => {
    setActionLoading(appId);
    try {
      // 1. Update appointment status
      const { error: appErr } = await supabase
        .from('appointments')
        .update({ status: targetStatus })
        .eq('id', appId);

      if (appErr) throw appErr;
      
      // 2. If cancelled, mark the doctor schedule slot as available again
      if (targetStatus === 'Cancelled') {
        const { error: schedErr } = await supabase
          .from('doctor_schedule')
          .update({ is_available: true })
          .eq('id', scheduleId);

        if (schedErr) throw schedErr;
      }
      
      await loadAdminData();
    } catch (err) {
      alert("Error performing administrative action: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const metricCards = [
    { name: 'Total Patients', value: metrics.patients, icon: Users, color: 'text-teal-400 bg-teal-500/10' },
    { name: 'Active Physicians', value: metrics.doctors, icon: Award, color: 'text-sky-400 bg-sky-500/10' },
    { name: 'Total Bookings', value: metrics.appointments, icon: CalendarDays, color: 'text-indigo-400 bg-indigo-500/10' },
    { name: 'Confirmed Slots', value: metrics.confirmed, icon: CheckSquare, color: 'text-emerald-400 bg-emerald-500/10' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Administrative Portal</h1>
          <p className="text-sm text-slate-400 mt-1">Live clinical traffic and system overrides panel.</p>
        </div>
        <button 
          onClick={() => { setLoading(true); loadAdminData(); }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 text-teal-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading ledger data...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {metricCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <div key={i} className="glass-panel p-6 rounded-2xl flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{card.name}</p>
                    <p className="text-2xl font-black text-white">{card.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl border border-slate-800 ${card.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Appointment Override Table */}
          <div className="glass-panel p-6 rounded-2xl space-y-4">
            <div>
              <h2 className="text-lg font-bold text-white">Appointment Approval Engine</h2>
              <p className="text-xs text-slate-400 mt-0.5">Approve, decline, or cancel scheduling requests across the facility.</p>
            </div>
            
            {appointments.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">
                No active appointments in the system.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="table-th">Booking ID</th>
                      <th className="table-th">Patient Info</th>
                      <th className="table-th">Physician</th>
                      <th className="table-th">Date & Time</th>
                      <th className="table-th">Status</th>
                      <th className="table-th text-right">Administrative Actions</th>
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
                          <td className="table-td font-mono text-xs text-slate-500">
                            #000{app.id}
                          </td>
                          <td className="table-td">
                            <div>
                              <p className="font-bold text-white text-sm">{app.patient?.full_name || 'Deleted Patient'}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{app.patient?.email || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="table-td">
                            <div>
                              <p className="font-bold text-white text-sm">{app.doctor?.full_name || 'Deleted Doctor'}</p>
                              <p className="text-[10px] text-teal-400 mt-0.5 font-semibold uppercase text-[9px]">{app.doctor?.specialization || 'General Practitioner'}</p>
                            </div>
                          </td>
                          <td className="table-td">
                            <div className="text-xs">
                              <p className="font-semibold text-slate-300">{app.doctor_schedule?.available_date || 'N/A'}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">at {app.doctor_schedule?.available_time || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="table-td">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase tracking-wider ${statusColors[app.status] || 'bg-slate-800 text-slate-400'}`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="table-td text-right">
                            {actionLoading === app.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-teal-500 ml-auto" />
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                {app.status === 'Pending' && (
                                  <>
                                    <button 
                                      onClick={() => adjustStatusAction(app.id, 'Confirmed', app.schedule_id)}
                                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition"
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                      <span>Confirm</span>
                                    </button>
                                    <button 
                                      onClick={() => adjustStatusAction(app.id, 'Cancelled', app.schedule_id)}
                                      className="flex items-center gap-1 bg-red-950/20 hover:bg-red-500/10 text-red-400 hover:text-red-300 border border-red-500/20 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition"
                                    >
                                      <XCircle className="h-3 w-3" />
                                      <span>Cancel</span>
                                    </button>
                                  </>
                                )}
                                {app.status === 'Confirmed' && (
                                  <button 
                                    onClick={() => adjustStatusAction(app.id, 'Cancelled', app.schedule_id)}
                                    className="flex items-center gap-1 bg-red-950/20 hover:bg-red-500/10 text-red-400 hover:text-red-300 border border-red-500/20 font-bold text-[10px] px-2.5 py-1.5 rounded-lg transition"
                                  >
                                    <XCircle className="h-3 w-3" />
                                    <span>Cancel Booking</span>
                                  </button>
                                )}
                              </div>
                            )}
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
      )}
    </div>
  );
}
