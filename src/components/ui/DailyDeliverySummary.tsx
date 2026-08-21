import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Package, Truck, CheckCircle, Clock } from 'lucide-react';

interface DailyDeliverySummaryProps {
  data: any[];
}

export default function DailyDeliverySummary({ data }: DailyDeliverySummaryProps) {
  const summary = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Filter for today's deliveries based on createdAt or dataPedido
    const todaysDeliveries = data.filter(item => {
      if (item.createdAt) return item.createdAt.startsWith(todayStr);
      if (item.dataPedido) return item.dataPedido === todayStr;
      return false; // Fallback
    });

    let pending = 0;
    let inTransit = 0;
    let delivered = 0;

    todaysDeliveries.forEach(item => {
      if (item.status === 'Separando' || item.status === 'Pronta para Envio') {
        pending++;
      } else if (item.status === 'Em trânsito') {
        inTransit++;
      } else if (item.status === 'Entregue') {
        delivered++;
      }
    });

    return {
      total: pending + inTransit + delivered,
      pending,
      inTransit,
      delivered
    };
  }, [data]);

  const chartData = [
    { name: 'Pendentes', value: summary.pending, color: '#f59e0b' },
    { name: 'Em Trânsito', value: summary.inTransit, color: '#3b82f6' },
    { name: 'Entregues', value: summary.delivered, color: '#10b981' },
  ].filter(item => item.value > 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="flex-1">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Resumo do Dia</h2>
        <p className="text-sm text-slate-500 mb-6">Acompanhamento das entregas de hoje</p>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex flex-col items-center justify-center text-center">
            <div className="bg-slate-100 p-2 rounded-full mb-2">
              <Package className="text-slate-600" size={20} />
            </div>
            <span className="text-2xl font-bold text-slate-800">{summary.total}</span>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide mt-1">Total Hoje</span>
          </div>
          
          <div className="bg-amber-50 p-4 rounded-lg border border-amber-100 flex flex-col items-center justify-center text-center">
            <div className="bg-amber-100 p-2 rounded-full mb-2">
              <Clock className="text-amber-600" size={20} />
            </div>
            <span className="text-2xl font-bold text-amber-700">{summary.pending}</span>
            <span className="text-xs text-amber-600 font-medium uppercase tracking-wide mt-1">Pendentes</span>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex flex-col items-center justify-center text-center">
            <div className="bg-blue-100 p-2 rounded-full mb-2">
              <Truck className="text-blue-600" size={20} />
            </div>
            <span className="text-2xl font-bold text-blue-700">{summary.inTransit}</span>
            <span className="text-xs text-blue-600 font-medium uppercase tracking-wide mt-1">Em Trânsito</span>
          </div>
          
          <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100 flex flex-col items-center justify-center text-center">
            <div className="bg-emerald-100 p-2 rounded-full mb-2">
              <CheckCircle className="text-emerald-600" size={20} />
            </div>
            <span className="text-2xl font-bold text-emerald-700">{summary.delivered}</span>
            <span className="text-xs text-emerald-600 font-medium uppercase tracking-wide mt-1">Entregues</span>
          </div>
        </div>
      </div>
      
      <div className="w-full md:w-64 h-64 flex-shrink-0 relative">
        {summary.total > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [value, 'Entregas']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 rounded-full border-8 border-slate-100">
            <Package className="text-slate-300 mb-2" size={32} />
            <span className="text-sm text-slate-400 font-medium text-center px-4">Nenhuma entrega registrada hoje</span>
          </div>
        )}
        
        {summary.total > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-3xl font-bold text-slate-800">{Math.round((summary.delivered / summary.total) * 100)}%</span>
            <span className="text-xs text-slate-500 font-medium">Concluído</span>
          </div>
        )}
      </div>
    </div>
  );
}
