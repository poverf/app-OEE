import React, { useState, useMemo, useEffect } from 'react';
import { RotateCcw, BrainCircuit, Target, Gauge, ArrowDownCircle, Settings2 } from 'lucide-react';
import { motion } from 'motion/react';

interface PlannerProps {
  data: any[];
}

export default function OEEPlanner({ data }: PlannerProps) {
  const uniqueMachines = useMemo(() => {
    const fromData = Array.from(new Set(data.map(d => d.machine))).filter(Boolean);
    return fromData.length > 0 ? fromData : [
      'MC-101 (Injection 250T)',
      'MC-102 (Injection 350T)',
      'MC-201 (Blow Molding)',
      'MC-301 (Packager)',
      'Hydraulic Press P01'
    ];
  }, [data]);

  const [inputs, setInputs] = useState({
    machine: '',
    customMachine: '',
    shift: 'A',
    targetCount: 2050,
    partWt: 250,
    goodCount: 1850,
    badCount: 60,
    availMin: 480,
    runMin: 420,
    plannedDT: 30,
    hourlyRate: 1500 // Industrial cost factor in $/hr
  });

  // Sync machine selection when data loads
  useEffect(() => {
    if (uniqueMachines.length > 0 && !inputs.machine) {
      setInputs(prev => ({ ...prev, machine: uniqueMachines[0] }));
    }
  }, [uniqueMachines]);

  const [loading, setLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);

  const stats = useMemo(() => {
    const { targetCount, goodCount, badCount, availMin, runMin, hourlyRate } = inputs;
    const totalCount = goodCount + badCount;
    
    // Availability
    const ar = availMin > 0 ? (runMin / availMin) * 100 : 0;
    
    // Performance
    const pr = targetCount > 0 ? (totalCount / targetCount) * 100 : 0;
    
    // Quality
    const qr = totalCount > 0 ? (goodCount / totalCount) * 100 : 0;
    
    // OEE
    const oee = (ar / 100) * (pr / 100) * (qr / 100) * 100;
    
    const defectRate = totalCount > 0 ? (badCount / totalCount) * 100 : 0;
    
    // Financial Impact
    const efficiencyLoss = 100 - oee;
    const downtimeLoss = (efficiencyLoss / 100) * (availMin / 60) * hourlyRate;

    return {
      ar: Math.min(100, ar),
      pr: Math.min(100, pr),
      qr: Math.min(100, qr),
      oee: Math.min(100, oee),
      defectRate: Math.min(100, defectRate),
      downtimeLoss
    };
  }, [inputs]);

  const fetchAIInsights = async () => {
    setLoading(true);
    const finalInputs = {
      ...inputs,
      machine: inputs.machine === 'custom' ? inputs.customMachine : inputs.machine
    };
    try {
      let insightsStr = "";
      try {
        const res = await fetch('/api/planner-predict', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalInputs)
        });
        
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const resJson = await res.json();
          insightsStr = resJson.insights || "";
        } else {
          throw new Error('Non-JSON or unavailable API response');
        }
      } catch (backendErr) {
        console.warn('AI insight query failed or offline (expected in pure SPA mode, e.g. on Vercel). Computing client-side OEE planner suggestions...', backendErr);
        
        const qualityScore = (finalInputs.goodCount / (finalInputs.goodCount + finalInputs.badCount || 1)) * 100;
        const uptimeScore = (finalInputs.runMin / (finalInputs.availMin || 1)) * 100;
        const speedScore = ((finalInputs.goodCount + finalInputs.badCount) / (finalInputs.targetCount || 1)) * 100;
        const computedOEE = (qualityScore / 100) * (uptimeScore / 100) * (speedScore / 100) * 100;
        
        if (qualityScore < 95) {
          insightsStr = `Quality losses are significant (${(100 - qualityScore).toFixed(1)}%). Consider inspecting mold clamping forces, checking raw polymer material moisture levels, and verifying ejector pin alignment.`;
        } else if (uptimeScore < 85) {
          insightsStr = `Availability rate is restricted (${uptimeScore.toFixed(1)}%). Focus on minimizing cleaning cycle times and standardizing tooling setups during shift handovers.`;
        } else if (speedScore < 90) {
          insightsStr = `Performance is lower than target rate (${speedScore.toFixed(1)}%). Ensure cycle parameters are speed-optimized and loader feeds are working at maximum cycle speed.`;
        } else if (computedOEE >= 85) {
          insightsStr = `Optimal configuration modeled! Projected OEE of ${computedOEE.toFixed(1)}% satisfies World Class manufacturing standards. Continue routine preventive maintenance.`;
        } else {
          insightsStr = `Calculated base OEE of ${computedOEE.toFixed(1)}% is stable. Balance shift schedules and minimize raw material delays to break past the 80% mark on Shift ${finalInputs.shift}.`;
        }
      }
      
      setAiInsights(insightsStr);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setAiInsights(null);
    setInputs({
      machine: uniqueMachines[0] || '',
      customMachine: '',
      shift: 'A',
      targetCount: 2050,
      partWt: 250,
      goodCount: 1850,
      badCount: 60,
      availMin: 480,
      runMin: 420,
      plannedDT: 30,
      hourlyRate: 1500
    });
  };

  const Slider = ({ label, value, min, max, keyName, step = 1 }: { label: string, value: number, min: number, max: number, keyName: string, step?: number }) => (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
        <span>{label}</span>
        <span className="text-slate-200 font-mono">{value.toLocaleString()}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setInputs({ ...inputs, [keyName]: Number(e.target.value) })}
        className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
      />
    </div>
  );

  return (
    <div className="bg-[#1a1d27] rounded-3xl border border-slate-800 shadow-2xl overflow-hidden mb-8 text-slate-200">
      <div className="bg-slate-900/50 p-6 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <Settings2 className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Interactive OEE Planner Pro</h2>
            <p className="text-slate-500 text-sm">Industrial Simulation & Efficiency Modeling</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={reset}
            className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
            title="Reset simulation"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Side: Parameters */}
        <div className="lg:col-span-7 space-y-8 bg-slate-800/30 p-6 rounded-2xl border border-slate-700/50">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Select Machine</label>
              <div className="flex flex-col gap-2">
                <select 
                  value={inputs.machine}
                  onChange={(e) => setInputs({...inputs, machine: e.target.value})}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  {uniqueMachines.map(m => <option key={m} value={m}>{m}</option>)}
                  <option value="custom">-- Enter Custom --</option>
                </select>
                {inputs.machine === 'custom' && (
                  <input 
                    type="text"
                    value={inputs.customMachine}
                    onChange={(e) => setInputs({...inputs, customMachine: e.target.value})}
                    placeholder="Enter machine ID/Type"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Shift Schedule</label>
              <select 
                value={inputs.shift}
                onChange={(e) => setInputs({...inputs, shift: e.target.value})}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {['A', 'A1', 'A2', 'B', 'B1', 'B2', 'C'].map(s => (
                  <option key={s} value={s}>Shift {s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] pt-2 border-t border-slate-800 font-mono">Production Constraints</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
              <Slider label="Target count (pcs)" value={inputs.targetCount} min={100} max={10000} step={50} keyName="targetCount" />
              <Slider label="Expected good count" value={inputs.goodCount} min={0} max={inputs.targetCount + 1000} step={50} keyName="goodCount" />
              <Slider label="Expected bad count" value={inputs.badCount} min={0} max={1000} step={5} keyName="badCount" />
              <Slider label="Shift Available (min)" value={inputs.availMin} min={30} max={1440} step={10} keyName="availMin" />
              <Slider label="Actual Run (min)" value={inputs.runMin} min={0} max={inputs.availMin} step={1} keyName="runMin" />
              <Slider label="Planned downtime (min)" value={inputs.plannedDT} min={0} max={inputs.availMin} step={5} keyName="plannedDT" />
              <Slider label="Machine Hourly Rate ($)" value={inputs.hourlyRate} min={0} max={10000} step={50} keyName="hourlyRate" />
              <Slider label="Part weight (g)" value={inputs.partWt} min={1} max={5000} step={1} keyName="partWt" />
            </div>
          </div>
        </div>

        {/* Right Side: Outcomes */}
        <div className="lg:col-span-5 space-y-6">
          <div className="grid grid-cols-1 gap-6">
            {/* OEE Gauge */}
            <div className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-3xl text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-6">Real-time OEE Projection</h4>
              
              <div className="relative inline-flex items-center justify-center mb-4">
                <svg className="w-40 h-40 -rotate-90">
                  <circle cx="80" cy="80" r="70" fill="transparent" stroke="currentColor" strokeWidth="10" className="text-slate-800" />
                  <motion.circle 
                    cx="80" cy="80" r="70" 
                    fill="transparent" 
                    stroke="currentColor" 
                    strokeWidth="10" 
                    strokeDasharray={440}
                    initial={{ strokeDashoffset: 440 }}
                    animate={{ strokeDashoffset: 440 - (440 * stats.oee) / 100 }}
                    transition={{ type: 'spring', damping: 20 }}
                    className={`${stats.oee >= 85 ? 'text-green-500' : stats.oee >= 70 ? 'text-yellow-500' : 'text-red-500'}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-black text-white">{stats.oee.toFixed(1)}%</span>
                </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700/50 flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Proj. Financial Impact (Loss)</p>
                  <p className="text-xl font-black text-red-400">-${stats.downtimeLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
                <ArrowDownCircle className="w-8 h-8 text-red-500/20" />
              </div>
            </div>

            {/* Component Progress */}
            <div className="bg-slate-800/40 border border-slate-700/50 p-6 rounded-3xl space-y-4">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">KPI Breakdown</h4>
              
              {[
                { label: 'Availability', val: stats.ar, color: 'bg-orange-500' },
                { label: 'Performance', val: stats.pr, color: 'bg-purple-500' },
                { label: 'Quality', val: stats.qr, color: 'bg-green-500' },
              ].map(comp => (
                <div key={comp.label} className="space-y-2">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="text-slate-400 uppercase tracking-wider">{comp.label}</span>
                    <span className="text-slate-200">{comp.val.toFixed(1)}%</span>
                  </div>
                  <div className="h-1 bg-slate-900 rounded-full overflow-hidden">
                    <motion.div 
                      key={comp.val}
                      initial={{ width: 0 }}
                      animate={{ width: `${comp.val}%` }}
                      className={`h-full ${comp.color}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* AI Insights Action */}
            <div className="space-y-4">
              <button 
                onClick={fetchAIInsights}
                disabled={loading}
                className="w-full py-4 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 disabled:bg-slate-700 disabled:text-slate-500"
              >
                {loading ? <RotateCcw className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                ANALYZE WITH INDUSTRIAL AI
              </button>
              
              {aiInsights && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-3xl flex gap-4"
                >
                  <Gauge className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Model Synthesis</p>
                    <p className="text-xs text-blue-100 leading-relaxed font-medium">"{aiInsights}"</p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
