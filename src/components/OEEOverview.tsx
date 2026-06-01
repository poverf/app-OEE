import React from 'react';
import { TrendingUp, TrendingDown, Target, CheckCircle2, AlertTriangle, Timer } from 'lucide-react';
import { motion } from 'motion/react';

interface StatsProps {
  data: any[];
}

export default function OEEOverview({ data }: StatsProps) {
  const avg = (key: string) => {
    const valid = data.filter(d => d[key] > 0);
    if (valid.length === 0) return 0;
    return valid.reduce((acc, curr) => acc + curr[key], 0) / valid.length;
  };

  const oee = avg('oee');
  const ar = avg('ar');
  const pr = avg('pr');
  const qr = avg('qr');

  const stats = [
    { label: 'Avg OEE', value: oee, icon: Target, color: 'text-blue-500', bg: 'bg-blue-50' },
    { label: 'Availability', value: ar, icon: Timer, color: 'text-orange-500', bg: 'bg-orange-50' },
    { label: 'Performance', value: pr, icon: TrendingUp, color: 'text-purple-500', bg: 'bg-purple-50' },
    { label: 'Quality', value: qr, icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className={`${stat.bg} p-2 rounded-lg`}>
              <stat.icon className={`w-6 h-6 ${stat.color}`} />
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stat.value >= 85 ? 'bg-green-100 text-green-700' : stat.value >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
              {stat.value >= 85 ? 'Optimal' : stat.value >= 70 ? 'OK' : 'Low'}
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">{stat.label}</h3>
          <p className="text-3xl font-bold text-gray-900">{stat.value.toFixed(1)}%</p>
        </motion.div>
      ))}
    </div>
  );
}
