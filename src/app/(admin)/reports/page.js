'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart3, Printer, FileSpreadsheet, CalendarDays, Award, Loader2, Info } from 'lucide-react';

export default function ReportingMetricsEngine() {
  const [trends, setTrends] = useState([]);
  const [topDoctors, setTopDoctors] = useState([]);
  const [manifest, setManifest] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReportsData() {
      try {
        // 1. Fetch appointments with schedules and profiles
        const { data: apps, error: appsErr } = await supabase
          .from('appointments')
          .select(`
            id,
            status,
            doctor_schedule:schedule_id (available_date, available_time),
            patient:profiles!patient_id (full_name),
            doctor:profiles!doctor_id (full_name, specialization)
          `);

        if (appsErr) throw appsErr;
        const appList = apps || [];
        setManifest(appList);

        // 2. Count and group appointments by date
        const dateCounts = appList.reduce((acc, obj) => {
          const dateStr = obj.doctor_schedule?.available_date;
          if (dateStr) acc[dateStr] = (acc[dateStr] || 0) + 1;
          return acc;
        }, {});

        const processedTrends = Object.keys(dateCounts).map(date => ({
          date, 
          count: dateCounts[date]
        })).sort((a, b) => new Date(a.date) - new Date(b.date)); // Sort chronologically

        setTrends(processedTrends);

        // 3. Count and group by Doctor to find Top Physicians
        const docCounts = appList.reduce((acc, obj) => {
          const docName = obj.doctor?.full_name;
          const specialty = obj.doctor?.specialization;
          if (docName) {
            const key = `${docName}||${specialty || 'General'}`;
            acc[key] = (acc[key] || 0) + 1;
          }
          return acc;
        }, {});

        const processedDocs = Object.keys(docCounts).map(key => {
          const [name, specialty] = key.split('||');
          return {
            name,
            specialty,
            count: docCounts[key]
          };
        }).sort((a, b) => b.count - a.count); // Sort descending

        setTopDoctors(processedDocs);

      } catch (err) {
        console.error("Error loading reporting records:", err.message);
      } finally {
        setLoading(false);
      }
    }
    loadReportsData();
  }, []);

  // Calculate max volume for chart scaling
  const maxVolume = trends.length > 0 ? Math.max(...trends.map(t => t.count)) : 1;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 print:p-0">
      {/* Header - Hidden on Print */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-white">System Reporting Engine</h1>
          <p className="text-sm text-slate-400 mt-1">Export, review, and audit clinical operation trends.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs transition shadow hover:shadow-teal-500/10 active:scale-98"
          >
            <Printer className="h-4 w-4" />
            <span>Print Audit Sheet</span>
          </button>
        </div>
      </div>

      {/* Printed Header Sheet - Visible only on Print */}
      <div className="hidden print:block border-b-2 border-slate-900 pb-4 mb-6">
        <h1 className="text-3xl font-black text-slate-900">MEDICLOUD CARE PORTAL</h1>
        <p className="text-sm text-slate-500 uppercase tracking-widest font-bold">System Manifest Audit Ledger & Operational Reports</p>
        <p className="text-xs text-slate-400 mt-1">Generated: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 print:hidden">
          <Loader2 className="h-10 w-10 text-teal-500 animate-spin" />
          <p className="text-sm text-slate-400">Aggregating transactional records...</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Top Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Chart: Activity Trends */}
            <div className="lg:col-span-8 glass-panel p-6 rounded-2xl flex flex-col justify-between print:break-inside-avoid">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-white print:text-slate-900">Booking Volume Trends</h2>
                <p className="text-xs text-slate-400 print:text-slate-500 mt-0.5">Aggregate appointment counts mapped chronologically.</p>
              </div>

              {trends.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No scheduling data recorded.
                </div>
              ) : (
                <div className="space-y-6">
                  {/* CSS Bar Chart Layout */}
                  <div className="flex items-end gap-3 sm:gap-6 h-48 border-b border-slate-800 pb-2 pt-4 px-2">
                    {trends.map((t, idx) => {
                      const pctHeight = (t.count / maxVolume) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                          <div className="relative w-full flex justify-center">
                            <span className="absolute -top-6 bg-slate-900 border border-slate-800 text-[10px] text-teal-400 font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition duration-150 pointer-events-none">
                              {t.count}
                            </span>
                            <div 
                              className="w-full bg-gradient-to-t from-teal-600 to-teal-400 rounded-t-md hover:from-teal-500 hover:to-teal-300 transition-all duration-300 shadow-md group-hover:shadow-teal-500/20"
                              style={{ height: `${pctHeight}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-slate-500 font-semibold rotate-45 sm:rotate-0 mt-2 whitespace-nowrap">
                            {t.date.split('-').slice(1).join('/')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 border-t border-slate-900 pt-3 print:hidden">
                    <Info className="h-3.5 w-3.5 text-slate-500" />
                    <span>Hover over any bar to view the exact transaction volume for that date.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Leaderboard: Top Doctors */}
            <div className="lg:col-span-4 glass-panel p-6 rounded-2xl print:break-inside-avoid">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white print:text-slate-900">Top Physicians</h2>
                  <p className="text-xs text-slate-400 print:text-slate-500 mt-0.5">Practitioners with highest booking rates.</p>
                </div>
                <Award className="h-5 w-5 text-teal-400" />
              </div>

              {topDoctors.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No practitioner bookings recorded.
                </div>
              ) : (
                <div className="space-y-4">
                  {topDoctors.slice(0, 5).map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/40 print:bg-slate-50 print:border-slate-200">
                      <div>
                        <h4 className="text-xs font-bold text-white print:text-slate-900">{doc.name}</h4>
                        <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider">{doc.specialty}</p>
                      </div>
                      <span className="text-[11px] bg-teal-500/10 text-teal-400 font-extrabold px-2.5 py-1 rounded-lg border border-teal-500/20">
                        {doc.count} appointments
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Audit Ledger Manifest Table - Expanded layout for Print */}
          <div className="glass-panel p-6 rounded-2xl print:border-none print:shadow-none print:p-0">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-white print:text-slate-900">System Transaction Manifest</h2>
              <p className="text-xs text-slate-400 print:text-slate-500 mt-0.5">Audit log of all registered patient scheduling records.</p>
            </div>

            {manifest.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                No system transactions recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="table-th">Ref ID</th>
                      <th className="table-th">Patient</th>
                      <th className="table-th">Practitioner</th>
                      <th className="table-th">Scheduled Slot</th>
                      <th className="table-th">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifest.map(app => (
                      <tr key={app.id}>
                        <td className="table-td font-mono text-xs text-slate-500">
                          #M-{app.id.toString().padStart(4, '0')}
                        </td>
                        <td className="table-td font-bold text-white print:text-slate-900">
                          {app.patient?.full_name || 'Anonymous Patient'}
                        </td>
                        <td className="table-td font-medium">
                          {app.doctor?.full_name || 'N/A'}
                        </td>
                        <td className="table-td text-xs">
                          {app.doctor_schedule?.available_date} @ {app.doctor_schedule?.available_time}
                        </td>
                        <td className="table-td uppercase font-extrabold text-[10px]">
                          <span className={app.status === 'Confirmed' ? 'text-emerald-400' : app.status === 'Cancelled' ? 'text-red-400' : 'text-amber-400'}>
                            {app.status}
                          </span>
                        </td>
                      </tr>
                    ))}
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
