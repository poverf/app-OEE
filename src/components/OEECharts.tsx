import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ComposedChart, Area, PieChart, Pie, Cell
} from 'recharts';

interface ChartProps {
  data: any[];
}

const COLORS = ['#3b82f6', '#f97316', '#a855f7', '#22c55e', '#ec4899', '#eab308'];

export default function OEECharts({ data }: ChartProps) {
  // Aggregate data by machine
  const machineAgg = data.reduce((acc: any, curr) => {
    if (!acc[curr.machine]) {
      acc[curr.machine] = { name: curr.machine, count: 0, oee: 0, ar: 0, pr: 0, qr: 0 };
    }
    acc[curr.machine].count++;
    acc[curr.machine].oee += curr.oee;
    acc[curr.machine].ar += curr.ar;
    acc[curr.machine].pr += curr.pr;
    acc[curr.machine].qr += curr.qr;
    return acc;
  }, {});

  const chartData = Object.values(machineAgg).map((m: any) => ({
    name: m.name,
    OEE: Math.round(m.oee / m.count),
    AR: Math.round(m.ar / m.count),
    PR: Math.round(m.pr / m.count),
    QR: Math.round(m.qr / m.count),
  })).sort((a, b) => b.OEE - a.OEE).slice(0, 8);

  // Aggregate data by shift
  const shiftAgg = data.reduce((acc: any, curr) => {
    if (!acc[curr.shift]) {
      acc[curr.shift] = { name: curr.shift, count: 0, oee: 0 };
    }
    acc[curr.shift].count++;
    acc[curr.shift].oee += curr.oee;
    return acc;
  }, {});

  const shiftData = Object.values(shiftAgg).map((s: any) => ({
    name: `Shift ${s.name}`,
    OEE: Math.round(s.oee / s.count)
  }));

  const distribution = [
    { name: 'Optimal (85%+)', value: data.filter(d => d.oee >= 85).length },
    { name: 'Stable (70-85%)', value: data.filter(d => d.oee >= 70 && d.oee < 85).length },
    { name: 'Risk (<70%)', value: data.filter(d => d.oee < 70).length },
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
      {/* Machine Performance Ranking */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[450px]">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Top Machine Performance (%)</h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '12px' }} />
            <Tooltip 
              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Bar dataKey="OEE" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* KPI Comparison */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[450px]">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Shift Performance Analysis</h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={shiftData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '12px' }} />
            <YAxis axisLine={false} tickLine={false} domain={[0, 100]} />
            <Tooltip contentStyle={{ borderRadius: '12px' }} />
            <Bar dataKey="OEE" fill="#a855f7" radius={[4, 4, 0, 0]} barSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* KPI Distribution by Machine */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[450px]">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Component Breakdown (Top 8)</h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
            <YAxis axisLine={false} tickLine={false} style={{ fontSize: '12px' }} />
            <Tooltip contentStyle={{ borderRadius: '12px' }} />
            <Legend verticalAlign="top" height={36}/>
            <Bar dataKey="AR" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="PR" fill="#a855f7" radius={[4, 4, 0, 0]} />
            <Bar dataKey="QR" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* OEE Distribution */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[400px]">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Fleet Health Distribution</h3>
        <ResponsiveContainer width="100%" height="85%">
          <PieChart>
            <Pie
              data={distribution}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={5}
              dataKey="value"
            >
              {distribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={index === 0 ? '#22c55e' : index === 1 ? '#eab308' : '#ef4444'} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Trend Placeholder or Data Matrix */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-[400px]">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Performance Trend (Simulated)</h3>
        <ResponsiveContainer width="100%" height="85%">
          <ComposedChart data={chartData.slice(0, 10)}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} style={{ fontSize: '10px' }} />
            <YAxis axisLine={false} tickLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="OEE" fill="#dbeafe" stroke="#3b82f6" />
            <Line type="monotone" dataKey="QR" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
