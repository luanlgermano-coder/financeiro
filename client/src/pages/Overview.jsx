import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, Landmark, Wallet,
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { getDashboard } from '../api';
import { formatCurrency, formatDate, getCurrentMonth, getMonthOptions, originLabel, originColor } from '../utils/formatters';

const StatCard = ({ label, value, icon: Icon, color, sub }) => (
  <div className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${color}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(value)}</p>
        {sub && <p className="text-xs text-zinc-400 mt-1">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl ${color.replace('border-', 'bg-').replace('-500', '-100')}`}>
        <Icon size={20} className={color.replace('border-', 'text-')} />
      </div>
    </div>
  </div>
);

const CategoryBar = ({ name, color, total, max }) => {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-sm text-zinc-600 truncate flex-shrink-0">{name}</div>
      <div className="flex-1 bg-zinc-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-24 text-sm text-zinc-700 font-medium text-right flex-shrink-0">{formatCurrency(total)}</div>
    </div>
  );
};

const OriginBadge = ({ origin }) => (
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${originColor(origin)}`}>
    {originLabel(origin)}
  </span>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-lg text-sm">
        <p className="font-semibold text-zinc-700 mb-1">{label}</p>
        {payload.map(p => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const months = getMonthOptions(12);
  const [monthIdx, setMonthIdx] = useState(0);
  const currentMonth = months[monthIdx].value;

  const load = useCallback(() => {
    setLoading(true);
    getDashboard(currentMonth)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentMonth]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('transaction-saved', handler);
    return () => window.removeEventListener('transaction-saved', handler);
  }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
    </div>
  );

  if (!data) return <p className="text-zinc-500">Erro ao carregar dados.</p>;

  const maxCategory = data.categoryBreakdown.length > 0 ? Math.max(...data.categoryBreakdown.map(c => c.total)) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Visão Geral</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Resumo financeiro do mês</p>
        </div>
        {/* Seletor de mês */}
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-sm">
          <button
            onClick={() => setMonthIdx(i => Math.min(i + 1, months.length - 1))}
            className="p-1 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-zinc-700 min-w-[140px] text-center capitalize">
            {months[monthIdx].label}
          </span>
          <button
            onClick={() => setMonthIdx(i => Math.max(i - 1, 0))}
            disabled={monthIdx === 0}
            className="p-1 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Entradas do mês"
          value={data.income}
          icon={Wallet}
          color="border-emerald-400"
          sub="Total de receitas registradas"
        />
        <StatCard
          label="Sobra estimada"
          value={data.surplus}
          icon={TrendingUp}
          color="border-emerald-500"
          sub="Renda − (Gastos + Dívidas + Assinaturas)"
        />
        <StatCard
          label="Total gasto"
          value={data.expense}
          icon={TrendingDown}
          color="border-red-500"
          sub={`${data.categoryBreakdown.length} categorias`}
        />
        <StatCard
          label="Total em dívidas"
          value={data.debtTotal}
          icon={Landmark}
          color="border-amber-500"
          sub={`Parcelas mensais: ${formatCurrency(data.monthlyDebt)}`}
        />
      </div>

      {/* Saúde financeira */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-zinc-900">Saúde Financeira</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{data.healthPercent}% da renda comprometida</p>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            data.healthPercent < 60
              ? 'bg-emerald-100 text-emerald-700'
              : data.healthPercent < 80
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700'
          }`}>
            {data.healthPercent < 60 ? 'Saudável' : data.healthPercent < 80 ? 'Atenção' : 'Crítico'}
          </span>
        </div>
        <div className="w-full bg-zinc-100 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-700 ${
              data.healthPercent < 60 ? 'bg-emerald-500' : data.healthPercent < 80 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, data.healthPercent)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-zinc-400 mt-1.5">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categorias */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-zinc-900 mb-4">Gastos por Categoria</h3>
          {data.categoryBreakdown.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center py-8">Nenhum gasto registrado</p>
          ) : (
            <div className="space-y-3">
              {data.categoryBreakdown.map(cat => (
                <CategoryBar key={cat.id} name={cat.name} color={cat.color} total={cat.total} max={maxCategory} />
              ))}
            </div>
          )}
        </div>

        {/* Últimos lançamentos */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-zinc-900 mb-4">Últimos Lançamentos</h3>
          {data.recentTransactions.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center py-8">Nenhum lançamento ainda</p>
          ) : (
            <div className="space-y-3">
              {data.recentTransactions.map(t => (
                <div key={t.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition-colors">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                    style={{ backgroundColor: t.category_color || '#6b7280' }}
                  >
                    {(t.category_name || 'O')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{t.description}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-zinc-400">{formatDate(t.date)}</span>
                      {t.card_name && (
                        <span className="text-xs text-zinc-400">· {t.card_name}</span>
                      )}
                      <OriginBadge origin={t.origin} />
                    </div>
                  </div>
                  <div className={`text-sm font-semibold flex-shrink-0 ${t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Resumo Individual */}
      {data.ownerSummary && (
        <div>
          <h2 className="text-lg font-bold text-zinc-900 mb-3">Resumo Individual</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { key: 'luan',    label: 'Luan',    accent: '#3b82f6', border: 'border-blue-500',  text: 'text-blue-600',  bg: 'bg-blue-50'  },
              { key: 'barbara', label: 'Bárbara', accent: '#ec4899', border: 'border-pink-500', text: 'text-pink-600', bg: 'bg-pink-50' },
            ].map(({ key, label, accent, border, text, bg }) => {
              const s = data.ownerSummary[key] || { income: 0, expense: 0, balance: 0, debtTotal: 0 };
              return (
                <div key={key} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${border}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: accent }}>
                      {label[0]}
                    </div>
                    <h3 className="font-semibold text-zinc-900">{label}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`${bg} rounded-xl p-3`}>
                      <p className="text-xs text-zinc-500 font-medium">Entradas do mês</p>
                      <p className={`text-lg font-bold mt-0.5 ${text}`}>{formatCurrency(s.income)}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3">
                      <p className="text-xs text-zinc-500 font-medium">Total gasto</p>
                      <p className="text-lg font-bold mt-0.5 text-red-500">{formatCurrency(s.expense)}</p>
                    </div>
                    <div className={`rounded-xl p-3 ${s.balance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                      <p className="text-xs text-zinc-500 font-medium">Saldo</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {s.balance >= 0
                          ? <ArrowUp size={14} className="text-emerald-600" />
                          : <ArrowDown size={14} className="text-red-500" />}
                        <p className={`text-lg font-bold ${s.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{formatCurrency(Math.abs(s.balance))}</p>
                      </div>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-3">
                      <p className="text-xs text-zinc-500 font-medium">Total em dívidas</p>
                      <p className="text-lg font-bold mt-0.5 text-amber-600">{formatCurrency(s.debtTotal)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Evolução mensal */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-zinc-900 mb-6">Evolução dos Últimos 6 Meses</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.monthlyEvolution} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#71717a' }} />
            <YAxis tick={{ fontSize: 11, fill: '#71717a' }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => value === 'income' ? 'Receitas' : 'Gastos'}
              wrapperStyle={{ fontSize: 12 }}
            />
            <Bar dataKey="income" name="income" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="expense" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
