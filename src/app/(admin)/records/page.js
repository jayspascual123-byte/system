'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Database, Search, FileText, Save, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

export default function MedicalRecordsManagement() {
  const [patients, setPatients] = useState([]);
  const [editingHistory, setEditingHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  async function loadRecordsData() {
    try {
      // 1. Get all profiles with patient role
      const { data: patientProfiles, error: profsErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'patient')
        .order('full_name', { ascending: true });

      if (profsErr) throw profsErr;

      // 2. Get all patient medical records
      const { data: records, error: recsErr } = await supabase
        .from('patient_records')
        .select('*');

      if (recsErr) throw recsErr;

      // 3. Merge profiles and records
      const merged = (patientProfiles || []).map(p => {
        const record = (records || []).find(r => r.patient_id === p.id);
        return { 
          ...p, 
          medical_history: record ? record.medical_history : '',
          original_history: record ? record.medical_history : '' 
        };
      });

      setPatients(merged);
    } catch (err) {
      console.error("Error loading patient records:", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRecordsData();
  }, []);

  const handleTextareaChange = (patientId, val) => {
    setEditingHistory(prev => ({
      ...prev,
      [patientId]: val
    }));
  };

  const saveHistoryChange = async (patientId) => {
    const textValue = editingHistory[patientId];
    if (textValue === undefined) return;
    setSavingId(patientId);

    try {
      // Postgres upsert logic to create or update the record
      const { error } = await supabase.from('patient_records').upsert(
        { 
          patient_id: patientId, 
          medical_history: textValue,
          last_updated: new Date().toISOString()
        },
        { onConflict: 'patient_id' }
      );

      if (error) throw error;
      
      // Update original state so it matches edited value
      setPatients(prev => prev.map(p => {
        if (p.id === patientId) {
          return { ...p, original_history: textValue, medical_history: textValue };
        }
        return p;
      }));

      // Clear the temporary editing state for this patient
      const updatedEdits = { ...editingHistory };
      delete updatedEdits[patientId];
      setEditingHistory(updatedEdits);

      alert('Medical history updated successfully.');
    } catch (err) {
      alert('Error updating medical history: ' + err.message);
    } finally {
      setSavingId(null);
    }
  };

  // Filter patients based on search query
  const filteredPatients = patients.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      (p.full_name?.toLowerCase() || '').includes(q) ||
      (p.email?.toLowerCase() || '').includes(q) ||
      (p.contact?.toLowerCase() || '').includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Health Records (EHR)</h1>
          <p className="text-sm text-slate-400 mt-1">Manage and edit clinical logs and medical histories.</p>
        </div>
      </div>

      {/* Toolbar / Search */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients by name, email, or contact..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-teal-500 text-sm text-white placeholder-slate-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-10 w-10 text-teal-500 animate-spin" />
          <p className="text-sm text-slate-400">Loading electronic health records...</p>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-2xl">
          {filteredPatients.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No patient records found matching your search.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="table-th">Patient ID</th>
                    <th className="table-th">Demographics</th>
                    <th className="table-th">Contact info</th>
                    <th className="table-th w-2/5">Medical History Log</th>
                    <th className="table-th text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(p => {
                    const currentVal = editingHistory[p.id] !== undefined ? editingHistory[p.id] : p.medical_history;
                    const isModified = editingHistory[p.id] !== undefined && editingHistory[p.id] !== p.original_history;

                    return (
                      <tr key={p.id}>
                        <td className="table-td font-mono text-xs text-slate-500">
                          PID-{p.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="table-td">
                          <div>
                            <p className="font-bold text-white text-sm">{p.full_name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{p.email}</p>
                          </div>
                        </td>
                        <td className="table-td font-mono text-xs">
                          {p.contact || 'N/A'}
                        </td>
                        <td className="table-td">
                          <div className="relative">
                            <textarea
                              value={currentVal}
                              onChange={(e) => handleTextareaChange(p.id, e.target.value)}
                              placeholder="Enter details on medical diagnosis, active prescriptions, operations, allergies..."
                              disabled={savingId === p.id}
                              className={`w-full p-3 bg-slate-900 border text-xs rounded-xl focus:outline-none text-slate-200 transition ${isModified ? 'border-amber-500/50 focus:border-amber-500 bg-amber-500/[0.02]' : 'border-slate-800 focus:border-teal-500'}`}
                              rows={3}
                            />
                            {isModified && (
                              <span className="absolute right-2 bottom-2 bg-amber-500/10 text-amber-400 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                                <AlertTriangle className="h-2 w-2" />
                                <span>Unsaved Edits</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="table-td text-right">
                          <button
                            onClick={() => saveHistoryChange(p.id)}
                            disabled={!isModified || savingId === p.id}
                            className={`flex items-center gap-1.5 font-bold text-xs px-3.5 py-2.5 rounded-xl ml-auto transition shadow active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed ${isModified ? 'bg-teal-600 hover:bg-teal-500 text-white hover:shadow-teal-500/10' : 'bg-slate-800 text-slate-500 border border-slate-800/40'}`}
                          >
                            {savingId === p.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            <span>Save Log</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
