import React, { useState, useCallback, useMemo } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, RefreshCw, Factory, LayoutDashboard, Brain, PlayCircle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Analytics } from '@vercel/analytics/react';
import OEEOverview from './components/OEEOverview';
import OEECharts from './components/OEECharts';
import OEEPlanner from './components/OEEPlanner';
import FailurePrediction from './components/FailurePrediction';
import { parseOeeExcelFile } from './utils/oeeParser';

export default function App() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'predictive' | 'planner'>('dashboard');
  const [selectedShift, setSelectedShift] = useState<string>('All');
  const [error, setError] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    if (selectedShift === 'All') return data;
    return data.filter(d => d.shift === selectedShift);
  }, [data, selectedShift]);

  const uniqueShifts = useMemo(() => {
    return ['All', ...Array.from(new Set(data.map(d => d.shift))).sort()];
  }, [data]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      let parsedData: any[] = [];
      try {
        const res = await fetch('/api/upload-oee', {
          method: 'POST',
          body: formData,
        });
        
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const result = await res.json();
          if (result.error) throw new Error(result.error);
          parsedData = result.data || [];
        } else {
          throw new Error('API route is not available or returned non-JSON webpage');
        }
      } catch (backendErr) {
        console.warn('Backend parser failed or is offline (expected on pure frontend hosting like Vercel). Using client-side browser Excel parser as fallback...', backendErr);
        parsedData = await parseOeeExcelFile(file);
      }

      if (parsedData.length === 0) {
        throw new Error('File read but no valid machine data was processed. Check your spreadsheet columns (e.g., Machine, OEE/OME, Good Count).');
      }
      setData(parsedData);
    } catch (err: any) {
      setError(err.message || 'Failed to upload/parse OEE file');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', label: 'Monitor', icon: LayoutDashboard },
    { id: 'planner', label: 'OEE Planner', icon: PlayCircle },
    { id: 'predictive', label: 'Failure Prediction', icon: Brain },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      {/* Sidebar - Desktop Only */}
      <aside className="fixed left-0 top-0 h-screen w-20 md:w-24 bg-slate-900 flex flex-col items-center py-8 z-50">
        <div className="bg-blue-600 p-3 rounded-2xl mb-12 shadow-lg shadow-blue-900/20">
          <Factory className="w-6 h-6 text-white" />
        </div>
        
        <nav className="flex flex-col gap-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`p-3 rounded-xl transition-all relative ${activeTab === tab.id ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <tab.icon className="w-6 h-6" />
              {activeTab === tab.id && (
                <motion.div layoutId="active-dot" className="absolute -right-1 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-full" />
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto">
          <button className="p-3 text-slate-500 hover:text-slate-300">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="pl-20 md:pl-24">
        {/* Header */}
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between z-40">
          <div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 border border-[#2e0707]">
              OEE Analysis
            </h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Manufacturing Intelligence System</p>
          </div>

          <div className="flex items-center gap-4">
            {data.length > 0 && activeTab === 'dashboard' && (
              <select 
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
              >
                {uniqueShifts.map(s => <option key={s} value={s}>Shift: {s}</option>)}
              </select>
            )}
            <label className={`cursor-pointer flex items-center gap-2 text-sm font-semibold px-4 py-2 bg-slate-900 text-white rounded-xl transition-all hover:bg-slate-800 shadow-md ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4" />
              {loading ? 'Processing...' : 'Upload Data'}
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
            </label>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-sm text-slate-600 border border-slate-200">
              DZ
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8 max-w-[1600px] mx-auto">
          <AnimatePresence mode="wait">
            {!data.length ? (
              <motion.div 
                key="empty-state"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center min-h-[70vh] text-center"
              >
                <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center mb-8 rotate-3 shadow-xl shadow-blue-100">
                  <FileSpreadsheet className="w-12 h-12 text-blue-500" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 mb-4">No Factory Data Loaded</h2>
                <p className="text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                  Connect your molding machine metrics by uploading the latest OEE report. 
                  Our AI models will analyze your production efficiency in real-time.
                </p>
                {error && (
                  <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-2 border border-red-100 text-sm font-medium">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
                <label className="cursor-pointer px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center gap-3 transition-all shadow-xl shadow-blue-200 group">
                  <Upload className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                  Select Excel Report
                  <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
                </label>
              </motion.div>
            ) : (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {activeTab === 'dashboard' && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
                      {[
                        { label: "Plant OEE", value: (filteredData.length > 0 ? (filteredData.reduce((a, b) => a + b.oee, 0) / filteredData.length) : 0).toFixed(1) + "%", color: "text-blue-600" },
                        { label: "Active Units", value: new Set(filteredData.map(d => d.machine)).size, color: "text-slate-900" },
                        { label: "Total Good Count", value: filteredData.reduce((a, b) => a + b.goodCount, 0).toLocaleString(), color: "text-green-600" },
                        { label: "Quality Rate", value: (filteredData.length > 0 ? (filteredData.reduce((a, b) => a + b.qr, 0) / filteredData.length) : 0).toFixed(1) + "%", color: "text-purple-600" }
                      ].map((stat, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm shadow-slate-200/50">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{stat.label}</p>
                          <p className={`text-xl font-black ${stat.color}`}>{stat.value}</p>
                        </div>
                      ))}
                    </div>
                    <OEEOverview data={filteredData} />
                    <OEECharts data={filteredData} />
                  </>
                )}
                
                {activeTab === 'planner' && (
                  <OEEPlanner data={data} />
                )}

                {activeTab === 'predictive' && (
                  <FailurePrediction data={filteredData} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Analytics />
    </div>
  );
}
