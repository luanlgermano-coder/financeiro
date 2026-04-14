import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  TrendingUp, TrendingDown, Landmark, Wallet,
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, Info, Lightbulb, Target
} from 'lucide-react';
import { Link } from 'react-router-dom';
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
      <div className={`p-2.5 rounded-xl ${color.replace('border-', 'bg-').replace('-500', '-100').replace('-400', '-100')}`}>
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

function buildInsights(data) {
  const insights = [];
  const {
    income, expense, surplus,
    prevMonthIncome, prevMonthExpense,
    categoryBreakdown, prevCategoryBreakdown,
    debtTotal, monthlyDebt,
  } = data;

  const prevSurplus = prevMonthIncome - prevMonthExpense;

  // 1. Comparação de gastos com mês anterior
  if (prevMonthExpense > 0) {
    const diff = expense - prevMonthExpense;
    const pct  = Math.round(Math.abs(diff / prevMonthExpense) * 100);
    if (diff > 0) {
      insights.push({
        icon: TrendingUp,
        color: 'text-red-500',
        bg: 'bg-red-50 border-red-200',
        text: `Seus gastos aumentaram ${pct}% em relação ao mês anterior (+${formatCurrency(diff)}).`,
      });
    } else if (diff < 0) {
      insights.push({
        icon: TrendingDown,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50 border-emerald-200',
        text: `Seus gastos caíram ${pct}% em relação ao mês anterior (${formatCurrency(diff)}).`,
      });
    }
  }

  // 2. Categoria que mais cresceu
  if (prevCategoryBreakdown && prevCategoryBreakdown.length > 0 && categoryBreakdown.length > 0) {
    const prevMap = Object.fromEntries(prevCategoryBreakdown.map(c => [c.id, c.total]));
    let topCat = null, topGrowth = -Infinity;
    for (const cat of categoryBreakdown) {
      const prev = prevMap[cat.id] || 0;
      if (prev > 0) {
        const growth = (cat.total - prev) / prev;
        if (growth > topGrowth && growth > 0.1) {
          topGrowth = growth;
          topCat = { ...cat, prev };
        }
      }
    }
    if (topCat) {
      const pct = Math.round(topGrowth * 100);
      insights.push({
        icon: AlertTriangle,
        color: 'text-amber-500',
        bg: 'bg-amber-50 border-amber-200',
        text: `A categoria "${topCat.name}" cresceu ${pct}% vs. mês anterior (${formatCurrency(topCat.prev)} → ${formatCurrency(topCat.total)}).`,
      });
    }
  }

  // 3. Tendência da sobra
  if (prevMonthIncome > 0 || prevSurplus !== 0) {
    const diff = surplus - prevSurplus;
    if (Math.abs(diff) > 10) {
      insights.push({
        icon: diff >= 0 ? CheckCircle2 : Info,
        color: diff >= 0 ? 'text-emerald-500' : 'text-zinc-500',
        bg: diff >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200',
        text: diff >= 0
          ? `Sua sobra melhorou ${formatCurrency(diff)} em relação ao mês anterior.`
          : `Sua sobra piorou ${formatCurrency(Math.abs(diff))} em relação ao mês anterior.`,
      });
    }
  }

  // 4. Alerta de categoria > 30% da renda
  if (income > 0) {
    for (const cat of categoryBreakdown) {
      const pct = Math.round((cat.total / income) * 100);
      if (pct >= 30) {
        insights.push({
          icon: AlertTriangle,
          color: 'text-red-500',
          bg: 'bg-red-50 border-red-200',
          text: `Atenção: "${cat.name}" representa ${pct}% da sua renda (${formatCurrency(cat.total)}).`,
        });
      }
    }
  }

  // 5. Progresso de dívidas
  if (debtTotal > 0) {
    insights.push({
      icon: Landmark,
      color: 'text-amber-500',
      bg: 'bg-amber-50 border-amber-200',
      text: `Você tem ${formatCurrency(debtTotal)} em dívidas ativas. Parcelas mensais: ${formatCurrency(monthlyDebt)}.`,
    });
  }

  // 6. Meta mais próxima da conclusão (maior %)
  const upcomingGoals = data.upcomingGoals || [];
  if (upcomingGoals.length > 0) {
    const closest = [...upcomingGoals].sort((a, b) =>
      (b.current_amount / b.target_amount) - (a.current_amount / a.target_amount)
    )[0];
    const pct = closest.target_amount > 0
      ? Math.round((closest.current_amount / closest.target_amount) * 100)
      : 0;
    if (pct > 0) {
      insights.push({
        icon: Target,
        color: 'text-emerald-500',
        bg: 'bg-emerald-50 border-emerald-200',
        text: `Você está ${pct}% mais perto de atingir a meta "${closest.title}".`,
      });
    }

    // Meta com prazo mais próximo
    const soonest = upcomingGoals[0];
    const remaining = soonest.target_amount - soonest.current_amount;
    const deadlineStr = new Date(soonest.deadline + 'T00:00:00').toLocaleDateString('pt-BR');
    if (remaining > 0) {
      insights.push({
        icon: Target,
        color: 'text-blue-500',
        bg: 'bg-blue-50 border-blue-200',
        text: `Faltam ${formatCurrency(remaining)} para atingir a meta "${soonest.title}" até ${deadlineStr}.`,
      });
    }
  }

  return insights;
}

function healthPhrase(pct) {
  if (pct < 40) return 'Suas finanças estão excelentes! Continue mantendo esse controle.';
  if (pct < 60) return 'Boa situação financeira. Você tem uma margem confortável.';
  if (pct < 80) return 'Atenção: mais da metade da renda já está comprometida.';
  if (pct < 100) return 'Situação crítica. Revise seus gastos urgentemente.';
  return 'Alerta: você está gastando mais do que ganha!';
}

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
  const insights = buildInsights(data);

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
        <p className={`text-sm font-medium mt-3 ${
          data.healthPercent < 60 ? 'text-emerald-600' : data.healthPercent < 80 ? 'text-amber-600' : 'text-red-600'
        }`}>
          {healthPhrase(data.healthPercent)}
        </p>
      </div>

      {/* Insights do mês */}
      {insights.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={18} className="text-amber-400" />
            <h3 className="font-semibold text-zinc-900">Insights do Mês</h3>
          </div>
          <div className="space-y-2.5">
            {insights.map((ins, i) => {
              const Icon = ins.icon;
              return (
                <div key={i} className={`flex items-start gap-3 border rounded-xl px-4 py-3 ${ins.bg}`}>
                  <Icon size={16} className={`${ins.color} flex-shrink-0 mt-0.5`} />
                  <p className="text-sm text-zinc-700">{ins.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
              { key: 'barbara', label: 'Bárbara', accent: '#ec4899', border: 'border-pink-500',  text: 'text-pink-600',  bg: 'bg-pink-50'  },
            ].map(({ key, label, accent, border, text, bg }) => {
              const s = data.ownerSummary[key] || { income: 0, expense: 0, balance: 0, prevBalance: 0, debtTotal: 0 };
              const balanceDiff = s.balance - (s.prevBalance ?? s.balance);
              const incomeShare = data.income > 0 ? Math.round((s.income / data.income) * 100) : 0;
              return (
                <div key={key} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${border}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: accent }}>
                        {label[0]}
                      </div>
                      <h3 className="font-semibold text-zinc-900">{label}</h3>
                    </div>
                    {incomeShare > 0 && (
                      <span className="text-xs font-medium text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                        {incomeShare}% da renda total
                      </span>
                    )}
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
                        <p className={`text-lg font-bold ${s.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {formatCurrency(Math.abs(s.balance))}
                        </p>
                      </div>
                      {Math.abs(balanceDiff) > 1 && (
                        <div className={`flex items-center gap-0.5 mt-1 ${balanceDiff >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                          {balanceDiff >= 0
                            ? <ArrowUpRight size={11} />
                            : <ArrowDownRight size={11} />}
                          <span className="text-xs">{formatCurrency(Math.abs(balanceDiff))} vs. mês anterior</span>
                        </div>
                      )}
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

      {/* Metas */}
      {data.upcomingGoals && data.upcomingGoals.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-zinc-900">Metas</h2>
            <Link
              to="/metas"
              className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
            >
              Ver todas →
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.upcomingGoals.map(goal => {
              const pct  = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
              const today = new Date(); today.setHours(0,0,0,0);
              const dl  = new Date(goal.deadline + 'T00:00:00');
              const days = Math.ceil((dl - today) / 86400000);
              const daysLabel = days < 0 ? `${Math.abs(days)}d em atraso` : days === 0 ? 'Vence hoje' : `${days} dias`;
              const daysColor = days <= 0 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-zinc-400';
              return (
                <div key={goal.id} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white" style={{ backgroundColor: goal.color }}>
                      <Target size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-800 truncate">{goal.title}</p>
                      <p className={`text-xs ${daysColor}`}>{daysLabel}</p>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-2 mb-1.5">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: goal.color }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-500">
                    <span>{formatCurrency(goal.current_amount)}</span>
                    <span className="font-medium" style={{ color: goal.color }}>{pct}%</span>
                    <span>{formatCurrency(goal.target_amount)}</span>
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
