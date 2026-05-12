import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Landmark, Wallet,
  ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight,
  ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, Lightbulb, Target, CreditCard,
  Eye, EyeOff, X, Calendar, Banknote, Smartphone, Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getDashboard, getDues, checkDue, uncheckDue } from '../api';
import { formatCurrency, formatDate, getMonthOptions, originLabel, originColor } from '../utils/formatters';

const DEBT_HIDDEN_KEY = 'fin_debt_hidden';

const CARD_TYPE_LABEL = { credito: 'Crédito', debito: 'Débito', conta: 'Conta', poupanca: 'Poupança' };

// ─── StatCard ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, icon: Icon, gradient, sub, hideable }) => {
  const [hidden, setHidden] = useState(
    hideable ? localStorage.getItem(DEBT_HIDDEN_KEY) !== 'false' : false
  );
  const toggle = (e) => {
    e.stopPropagation();
    const next = !hidden;
    setHidden(next);
    localStorage.setItem(DEBT_HIDDEN_KEY, String(next));
  };
  return (
    <div className={`${gradient} rounded-2xl p-5 shadow-md hover:shadow-lg transition-shadow`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-extrabold text-white mt-1 tracking-tight">
            {hideable && hidden ? 'R$ ••••••' : formatCurrency(value)}
          </p>
          {sub && <p className="text-xs text-white/60 mt-1">{sub}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="p-2.5 rounded-xl bg-white/20">
            <Icon size={20} className="text-white" />
          </div>
          {hideable && (
            <button onClick={toggle} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title={hidden ? 'Mostrar valor' : 'Ocultar valor'}>
              {hidden ? <Eye size={13} className="text-white/80" /> : <EyeOff size={13} className="text-white/80" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── CategoryBar ──────────────────────────────────────────────────────────────
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

// ─── Section header ───────────────────────────────────────────────────────────
const SectionTitle = ({ children }) => (
  <h2 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
    <span className="w-1 h-5 rounded-full bg-emerald-500 inline-block" />
    {children}
  </h2>
);

// ─── daysUntilDue ─────────────────────────────────────────────────────────────
function daysUntilDue(due_day) {
  const today = new Date();
  const day = today.getDate();
  const year = today.getFullYear();
  const month = today.getMonth();
  const nextDue = due_day >= day
    ? new Date(year, month, due_day)
    : new Date(year, month + 1, due_day);
  return Math.ceil((nextDue - today) / 86400000);
}

// ─── buildInsights ────────────────────────────────────────────────────────────
function buildInsights(data) {
  const insights = [];
  const {
    income, expense, surplus,
    prevMonthIncome, prevMonthExpense,
    categoryBreakdown, prevCategoryBreakdown,
    debtTotal, monthlyDebt,
    upcomingGoals = [],
  } = data;

  if (income > 0 && expense === 0) {
    insights.push({ type: 'tip', icon: Lightbulb, title: 'Nenhum gasto registrado ainda',
      body: 'Registre suas despesas para ter uma visão completa do seu mês.',
      action: 'Comece adicionando um lançamento pelo botão "+ Lançamento" no topo.' });
    return insights;
  }

  if (prevMonthExpense > 0) {
    const pctDiff = (expense - prevMonthExpense) / prevMonthExpense;
    if (pctDiff > 0.20) {
      let biggestCat = null, biggestDiff = 0;
      if (prevCategoryBreakdown?.length > 0 && categoryBreakdown.length > 0) {
        const prevMap = Object.fromEntries(prevCategoryBreakdown.map(c => [c.id, c.total]));
        for (const cat of categoryBreakdown) {
          const diff = cat.total - (prevMap[cat.id] || 0);
          if (diff > biggestDiff) { biggestDiff = diff; biggestCat = cat; }
        }
      }
      const pct = Math.round(pctDiff * 100);
      insights.push({ type: 'warning', icon: TrendingUp,
        title: `Gastos ${pct}% acima do mês passado`,
        body: biggestCat
          ? `A categoria "${biggestCat.name}" foi a que mais cresceu (+${formatCurrency(biggestDiff)}).`
          : `Você gastou ${formatCurrency(expense - prevMonthExpense)} a mais que no mês anterior.`,
        action: `Revise os gastos em "${biggestCat?.name ?? 'suas principais categorias'}" para retomar o controle.` });
    } else if (pctDiff < -0.10) {
      const pct = Math.round(Math.abs(pctDiff) * 100);
      insights.push({ type: 'positive', icon: TrendingDown,
        title: `Gastos ${pct}% menores que o mês passado`,
        body: `Você economizou ${formatCurrency(Math.abs(expense - prevMonthExpense))} em relação ao mês anterior.`,
        action: 'Continue assim! Considere destinar a diferença para suas metas.' });
    }
  }

  if (income > 0 && categoryBreakdown.length > 0) {
    const foodKeywords = ['alimenta', 'ifood', 'comida', 'restaurante', 'mercado', 'supermercado', 'refei'];
    const foodCats = categoryBreakdown.filter(c => foodKeywords.some(kw => c.name.toLowerCase().includes(kw)));
    const foodTotal = foodCats.reduce((s, c) => s + c.total, 0);
    if (foodTotal > 0 && foodTotal / income > 0.15) {
      const pct = Math.round((foodTotal / income) * 100);
      insights.push({ type: 'warning', icon: AlertTriangle,
        title: `Alimentação representa ${pct}% da renda`,
        body: `Você gastou ${formatCurrency(foodTotal)} em alimentação — acima do recomendado (15%).`,
        action: 'Tente cozinhar mais em casa e reduzir pedidos por aplicativo 2–3 vezes por semana.' });
    }
  }

  if (income > 0) {
    const surplusPct = surplus / income;
    if (surplusPct < 0.20 && surplusPct >= 0) {
      const committedPct = Math.round(((income - surplus) / income) * 100);
      insights.push({ type: 'warning', icon: AlertTriangle,
        title: 'Sobra abaixo de 20% da renda',
        body: `${committedPct}% da sua renda está comprometida com gastos, dívidas e assinaturas.`,
        action: 'Identifique assinaturas ou gastos fixos que somam mais de 10% da renda e corte os desnecessários.' });
    } else if (surplusPct >= 0.30) {
      insights.push({ type: 'positive', icon: CheckCircle2,
        title: 'Sobra saudável este mês',
        body: `Você tem ${formatCurrency(surplus)} disponível (${Math.round(surplusPct * 100)}% da renda).`,
        action: 'Aproveite para acelerar o pagamento de dívidas ou depositar nas suas metas.' });
    }
  }

  if (debtTotal > 0 && income > 0) {
    const debtPct = Math.round((monthlyDebt / income) * 100);
    if (debtPct >= 20) {
      insights.push({ type: 'warning', icon: Landmark,
        title: `${debtPct}% da renda vai para dívidas`,
        body: `Você paga ${formatCurrency(monthlyDebt)}/mês em parcelas de dívidas (total: ${formatCurrency(debtTotal)}).`,
        action: 'Priorize quitar a dívida com maior taxa de juros para reduzir o custo total mais rápido.' });
    }
  }

  if (upcomingGoals.length > 0) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (const goal of upcomingGoals) {
      const dl = new Date(goal.deadline + 'T00:00:00');
      const daysLeft = Math.ceil((dl - today) / 86400000);
      const pct = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
      if (daysLeft > 0 && daysLeft <= 60 && pct < 0.5) {
        const monthsLeft = Math.max(1, Math.round(daysLeft / 30));
        const remaining = goal.target_amount - goal.current_amount;
        const monthlyNeeded = Math.ceil(remaining / monthsLeft);
        insights.push({ type: 'tip', icon: Target,
          title: `Meta "${goal.title}" precisa de atenção`,
          body: `Faltam ${daysLeft} dias e você está em ${Math.round(pct * 100)}% da meta.`,
          action: `Deposite ${formatCurrency(monthlyNeeded)}/mês para atingir o objetivo a tempo.` });
        break;
      }
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Overview() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const months  = getMonthOptions(12);
  const [monthIdx, setMonthIdx] = useState(0);
  const currentMonth = months[monthIdx].value;

  const [dues, setDues]     = useState([]);
  const [showPaid, setShowPaid] = useState(false);
  const [showAllInstallments, setShowAllInstallments] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getDashboard(currentMonth)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentMonth]);

  const loadDues = useCallback(() => {
    getDues(currentMonth).then(r => setDues(r.data)).catch(console.error);
  }, [currentMonth]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDues(); }, [loadDues]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener('transaction-saved', handler);
    return () => window.removeEventListener('transaction-saved', handler);
  }, [load]);

  const handleCheckDue = async (item) => {
    await checkDue(item.type, item.id, currentMonth);
    setDues(prev => prev.map(d => d.type === item.type && d.id === item.id ? { ...d, checked: true } : d));
  };
  const handleUncheckDue = async (item) => {
    await uncheckDue(item.type, item.id, currentMonth);
    setDues(prev => prev.map(d => d.type === item.type && d.id === item.id ? { ...d, checked: false } : d));
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
    </div>
  );
  if (!data) return <p className="text-zinc-500">Erro ao carregar dados.</p>;

  const maxCategory = data.categoryBreakdown.length > 0 ? Math.max(...data.categoryBreakdown.map(c => c.total)) : 1;
  const insights    = buildInsights(data);

  const unpaidDues = dues.filter(d => !d.checked);
  const paidDues   = dues.filter(d =>  d.checked);

  // Split unpaid by urgency
  const urgentDues  = unpaidDues.filter(d => daysUntilDue(d.due_day) <= 3);
  const warningDues = unpaidDues.filter(d => { const n = daysUntilDue(d.due_day); return n > 3 && n <= 7; });
  const laterDues   = unpaidDues.filter(d => daysUntilDue(d.due_day) > 7);

  const OWNER_COLOR = { luan: 'bg-blue-100 text-blue-700', barbara: 'bg-pink-100 text-pink-700', casal: 'bg-violet-100 text-violet-700' };

  const DueItem = ({ item, urgency }) => {
    const days = daysUntilDue(item.due_day);
    const ownerLabel = item.owner === 'barbara' ? 'Bárbara'
      : item.owner ? item.owner.charAt(0).toUpperCase() + item.owner.slice(1) : null;

    const wrap = urgency === 'urgent'  ? 'bg-red-50 border-red-200' :
                 urgency === 'warning' ? 'bg-orange-50 border-orange-200' :
                                        'bg-zinc-50 border-zinc-100 opacity-70';
    const badgeBg = urgency === 'urgent'  ? 'bg-red-500 text-white' :
                    urgency === 'warning' ? 'bg-orange-500 text-white' :
                                           'bg-zinc-200 text-zinc-600';
    const daysColor = urgency === 'urgent' ? 'text-red-600' : urgency === 'warning' ? 'text-orange-600' : 'text-zinc-400';

    return (
      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${wrap}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm ${badgeBg}`}>
          {item.due_day}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-zinc-800 truncate">{item.name}</p>
            {urgency === 'urgent' && <AlertTriangle size={12} className="text-red-500 flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {item.type === 'card' && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-md text-white flex-shrink-0"
                style={{ backgroundColor: item.color || '#6b7280' }}>cartão</span>
            )}
            {item.type === 'debt' && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 flex-shrink-0 flex items-center gap-0.5">
                <Banknote size={10} />dívida
              </span>
            )}
            {item.type === 'bill' && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 flex-shrink-0">conta fixa</span>
            )}
            {item.owner && (
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${OWNER_COLOR[item.owner] || OWNER_COLOR.casal}`}>
                {ownerLabel}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold text-zinc-800">{formatCurrency(item.amount)}</p>
          <p className={`text-xs font-medium mt-0.5 ${daysColor}`}>
            {days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `${days}d`}
          </p>
        </div>
        <button onClick={() => handleCheckDue(item)}
          className="p-1.5 rounded-xl hover:bg-emerald-100 transition-colors flex-shrink-0" title="Marcar como pago">
          <CheckCircle2 size={17} className="text-zinc-300 hover:text-emerald-500 transition-colors" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Visão Geral</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Resumo financeiro do mês</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={() => setMonthIdx(i => Math.min(i + 1, months.length - 1))}
            className="p-1 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-zinc-700 min-w-[140px] text-center capitalize">
            {months[monthIdx].label}
          </span>
          <button onClick={() => setMonthIdx(i => Math.max(i - 1, 0))} disabled={monthIdx === 0}
            className="p-1 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-500 disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SEÇÃO 1 — ESSENCIAL
      ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Entradas do mês" value={data.income} icon={Wallet}
          gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
          sub="Total de receitas registradas" />
        <StatCard label="Sobra estimada" value={data.surplus} icon={TrendingUp}
          gradient={data.surplus >= 0 ? "bg-gradient-to-br from-teal-500 to-cyan-600" : "bg-gradient-to-br from-red-400 to-red-600"}
          sub="Renda − Gastos − Dívidas − Assinaturas" />
        <StatCard label="Total gasto" value={data.expense} icon={TrendingDown}
          gradient="bg-gradient-to-br from-red-500 to-rose-600"
          sub={`${data.categoryBreakdown.length} categorias`} />
        <StatCard label="Total em dívidas" value={data.debtTotal} icon={Landmark}
          gradient="bg-gradient-to-br from-amber-500 to-orange-500"
          sub={`Parcelas: ${formatCurrency(data.monthlyDebt)}/mês`} hideable />
      </div>

      {/* Saúde Financeira */}
      <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-zinc-900">Saúde Financeira</h3>
            <p className="text-xs text-zinc-500 mt-0.5">{data.healthPercent}% da renda comprometida</p>
          </div>
          <span className={`text-sm font-bold px-3 py-1 rounded-full ${
            data.healthPercent < 60 ? 'bg-emerald-100 text-emerald-700' :
            data.healthPercent < 80 ? 'bg-amber-100 text-amber-700' :
                                      'bg-red-100 text-red-700'
          }`}>
            {data.healthPercent < 60 ? 'Saudável' : data.healthPercent < 80 ? 'Atenção' : 'Crítico'}
          </span>
        </div>
        <div className="w-full bg-zinc-100 rounded-full h-3">
          <div className={`h-3 rounded-full transition-all duration-700 ${
            data.healthPercent < 60 ? 'bg-emerald-500' : data.healthPercent < 80 ? 'bg-amber-500' : 'bg-red-500'
          }`} style={{ width: `${Math.min(100, data.healthPercent)}%` }} />
        </div>
        <div className="flex justify-between text-xs text-zinc-400 mt-1.5">
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
        <p className={`text-sm font-medium mt-3 ${
          data.healthPercent < 60 ? 'text-emerald-600' : data.healthPercent < 80 ? 'text-amber-600' : 'text-red-600'
        }`}>{healthPhrase(data.healthPercent)}</p>
      </div>

      {/* Insights do Mês */}
      {insights.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={18} className="text-amber-400" />
            <h3 className="font-semibold text-zinc-900">Insights do Mês</h3>
          </div>
          <div className="space-y-3">
            {insights.map((ins, i) => {
              const Icon = ins.icon;
              const styles = {
                warning:  { wrap: 'bg-red-50 border-red-200',         icon: 'text-red-500',     title: 'text-red-800',     action: 'text-red-600' },
                tip:      { wrap: 'bg-amber-50 border-amber-200',     icon: 'text-amber-500',   title: 'text-amber-800',   action: 'text-amber-700' },
                positive: { wrap: 'bg-emerald-50 border-emerald-200', icon: 'text-emerald-500', title: 'text-emerald-800', action: 'text-emerald-700' },
              };
              const s = styles[ins.type] || styles.tip;
              return (
                <div key={i} className={`border rounded-xl px-4 py-3.5 ${s.wrap}`}>
                  <div className="flex items-start gap-3">
                    <Icon size={16} className={`${s.icon} flex-shrink-0 mt-0.5`} />
                    <div className="space-y-1">
                      <p className={`text-sm font-semibold ${s.title}`}>{ins.title}</p>
                      <p className="text-sm text-zinc-600">{ins.body}</p>
                      <p className={`text-xs font-semibold ${s.action}`}>→ {ins.action}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          SEÇÃO 2 — O QUE IMPORTA AGORA
      ═══════════════════════════════════════════════════════ */}
      <div>
        <SectionTitle>O que importa agora</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── Próximos Vencimentos ── */}
          <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar size={18} className="text-blue-500" />
                <h3 className="font-semibold text-zinc-900">Próximos Vencimentos</h3>
              </div>
              <Link to="/configuracoes" className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
                Gerenciar →
              </Link>
            </div>

            {dues.length === 0 ? (
              <div className="text-center py-8">
                <Calendar size={28} className="text-zinc-300 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Nenhum vencimento cadastrado</p>
                <Link to="/configuracoes" className="mt-2 inline-block text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                  Configurar cartões e contas →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Urgente ≤ 3 dias */}
                {urgentDues.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle size={11} /> Vence em até 3 dias
                    </p>
                    {urgentDues.map(item => <DueItem key={`${item.type}-${item.id}`} item={item} urgency="urgent" />)}
                  </div>
                )}

                {/* Aviso 4–7 dias */}
                {warningDues.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1">
                      <Clock size={11} /> Esta semana (4–7 dias)
                    </p>
                    {warningDues.map(item => <DueItem key={`${item.type}-${item.id}`} item={item} urgency="warning" />)}
                  </div>
                )}

                {/* Restante do mês */}
                {laterDues.length > 0 && (
                  <div className="space-y-1.5">
                    {(urgentDues.length > 0 || warningDues.length > 0) && (
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Restante do mês</p>
                    )}
                    {laterDues.map(item => <DueItem key={`${item.type}-${item.id}`} item={item} urgency="later" />)}
                  </div>
                )}

                {/* Pagos */}
                {paidDues.length > 0 && (
                  <div className="mt-2 border-t border-zinc-100 pt-2">
                    <button onClick={() => setShowPaid(s => !s)}
                      className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors flex items-center gap-1">
                      <span>{showPaid ? '▲' : '▼'}</span>
                      <span>{paidDues.length} pago{paidDues.length !== 1 ? 's' : ''} este mês</span>
                    </button>
                    {showPaid && (
                      <div className="mt-2 space-y-1">
                        {paidDues.map(item => (
                          <div key={`${item.type}-${item.id}`}
                            className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-100 bg-zinc-50 opacity-50">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-zinc-200 text-zinc-400 text-xs font-bold flex-shrink-0">
                              {item.due_day}
                            </div>
                            <p className="text-sm text-zinc-400 flex-1 truncate line-through">{item.name}</p>
                            <p className="text-xs text-zinc-400 flex-shrink-0">{formatCurrency(item.amount)}</p>
                            <button onClick={() => handleUncheckDue(item)}
                              className="p-1.5 rounded-lg hover:bg-zinc-200 transition-colors flex-shrink-0">
                              <X size={12} className="text-zinc-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {unpaidDues.length > 0 && (
                  <div className="pt-3 border-t border-zinc-100 flex justify-between items-center">
                    <p className="text-xs text-zinc-500">{unpaidDues.length} a vencer</p>
                    <p className="text-sm font-bold text-blue-600">
                      {formatCurrency(unpaidDues.reduce((s, d) => s + d.amount, 0))}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Gastos por Cartão + Pix/Débito ── */}
          <div className="space-y-4">
            {/* Card spending */}
            {data.cardSpending && data.cardSpending.length > 0 ? (
              <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard size={18} className="text-blue-500" />
                  <h3 className="font-semibold text-zinc-900">Gastos por Cartão</h3>
                </div>
                <div className="space-y-3">
                  {data.cardSpending.map(card => {
                    const pct = data.expense > 0 ? Math.round((card.total / data.expense) * 100) : 0;
                    return (
                      <div key={card.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: card.color }} />
                          <span className="text-sm text-zinc-700 flex-1 truncate font-medium">{card.name}</span>
                          {card.type && (
                            <span className="text-xs text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded-md flex-shrink-0">
                              {CARD_TYPE_LABEL[card.type] || card.type}
                            </span>
                          )}
                          <span className="text-sm font-bold text-zinc-800 flex-shrink-0">{formatCurrency(card.total)}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <div className="flex-1 bg-zinc-100 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: card.color }} />
                          </div>
                          <span className="text-xs text-zinc-400 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-zinc-100 flex justify-between items-center">
                  <span className="text-xs text-zinc-400">
                    {data.cardSpending.length} cartão{data.cardSpending.length !== 1 ? 'ões' : ''} ativos
                  </span>
                  <span className="text-sm font-bold text-zinc-800">
                    {formatCurrency(data.cardSpending.reduce((s, c) => s + c.total, 0))}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 shadow-sm text-center py-8">
                <CreditCard size={28} className="text-zinc-300 mx-auto mb-2" />
                <p className="text-zinc-400 text-sm">Nenhum gasto com cartão este mês</p>
              </div>
            )}

            {/* Pix / Débito */}
            <div className="rounded-2xl p-5 shadow-sm"
              style={data.pixDebito?.total > 0
                ? { backgroundColor: '#1a2332', border: '1px solid #30363d' }
                : { backgroundColor: 'white',   border: '1px solid #f3f4f6' }
              }>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Smartphone size={16} className={data.pixDebito?.total > 0 ? 'text-white/80' : 'text-zinc-400'} />
                    <p className={`text-xs font-semibold uppercase tracking-wider ${
                      data.pixDebito?.total > 0 ? 'text-white/70' : 'text-zinc-500'
                    }`}>Pix / Débito</p>
                  </div>
                  <p className={`text-3xl font-extrabold tracking-tight ${
                    data.pixDebito?.total > 0 ? 'text-white' : 'text-zinc-300'
                  }`}>
                    {formatCurrency(data.pixDebito?.total || 0)}
                  </p>
                  <p className={`text-xs mt-1 ${
                    data.pixDebito?.total > 0 ? 'text-white/60' : 'text-zinc-400'
                  }`}>
                    {data.pixDebito?.count || 0} transações sem cartão de crédito
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${data.pixDebito?.total > 0 ? 'bg-white/20' : 'bg-zinc-100'}`}>
                  <Banknote size={22} className={data.pixDebito?.total > 0 ? 'text-white' : 'text-zinc-400'} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          SEÇÃO 3 — ANÁLISE
      ═══════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        <SectionTitle>Análise do mês</SectionTitle>

        {/* Categorias + Últimos lançamentos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
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

          <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="font-semibold text-zinc-900 mb-4">Últimos Lançamentos</h3>
            {data.recentTransactions.length === 0 ? (
              <p className="text-zinc-400 text-sm text-center py-8">Nenhum lançamento ainda</p>
            ) : (
              <div className="space-y-3">
                {data.recentTransactions.map(t => (
                  <div key={t.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-50 transition-colors">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                      style={{ backgroundColor: t.category_color || '#6b7280' }}>
                      {(t.category_name || 'O')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800 truncate">{t.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-zinc-400">{formatDate(t.date)}</span>
                        {t.card_name && <span className="text-xs text-zinc-400">· {t.card_name}</span>}
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
            <h3 className="text-base font-bold text-zinc-900 mb-3">Resumo Individual</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'luan',    label: 'Luan',    accent: '#3b82f6', border: 'border-blue-500', text: 'text-blue-600',  bg: 'bg-blue-50'  },
                { key: 'barbara', label: 'Bárbara', accent: '#ec4899', border: 'border-pink-500', text: 'text-pink-600',  bg: 'bg-pink-50'  },
              ].map(({ key, label, accent, border, text, bg }) => {
                const s = data.ownerSummary[key] || { income: 0, expense: 0, balance: 0, prevBalance: 0, debtTotal: 0 };
                const balanceDiff = s.balance - (s.prevBalance ?? s.balance);
                const incomeShare = data.income > 0 ? Math.round((s.income / data.income) * 100) : 0;
                const otherName = key === 'luan' ? 'Bárbara' : 'Luan';
                return (
                  <div key={key} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${border}`}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: accent }}>{label[0]}</div>
                        <h4 className="font-semibold text-zinc-900">{label}</h4>
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
                        <p className="text-lg font-bold mt-0.5 text-red-500">{formatCurrency(s.expense + (s.paidForOtherExpense || 0))}</p>
                        {s.paidForOtherExpense > 0 && (
                          <p className="text-xs text-violet-500 font-medium mt-0.5">
                            Do qual {formatCurrency(s.paidForOtherExpense)} por {otherName}
                          </p>
                        )}
                      </div>
                      {(s.monthlyDebt > 0 || s.subShare > 0) && (
                        <div className="bg-orange-50 rounded-xl p-3">
                          <p className="text-xs text-zinc-500 font-medium">Compromissos fixos</p>
                          <p className="text-lg font-bold mt-0.5 text-orange-500">{formatCurrency((s.monthlyDebt || 0) + (s.subShare || 0))}</p>
                          <div className="text-xs text-zinc-400 mt-0.5 space-y-0.5">
                            {s.monthlyDebt > 0 && <p>Dívidas: {formatCurrency(s.monthlyDebt)}</p>}
                            {s.subShare > 0 && <p>Assinaturas: {formatCurrency(s.subShare)}</p>}
                          </div>
                        </div>
                      )}
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
                            {balanceDiff >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                            <span className="text-xs">{formatCurrency(Math.abs(balanceDiff))} vs. mês anterior</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Compromissos Futuros */}
        {data.installmentSummary && data.installmentSummary.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-violet-500" />
                <h3 className="font-semibold text-zinc-900">Compromissos Futuros</h3>
              </div>
              <span className="text-xs text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
                {data.installmentSummary.length} compra{data.installmentSummary.length !== 1 ? 's' : ''} ativa{data.installmentSummary.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {(showAllInstallments ? data.installmentSummary : data.installmentSummary.slice(0, 4)).map((item, i) => {
                const pct = item.total > 0 ? Math.round((item.current / item.total) * 100) : 0;
                return (
                  <div key={i} className="border border-zinc-100 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 truncate">{item.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                            {item.current}/{item.total} parcelas
                          </span>
                          {item.card_name && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: item.card_color || '#6b7280' }}>
                              {item.card_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-zinc-800">{formatCurrency(item.monthlyAmount)}<span className="text-xs font-normal text-zinc-400">/mês</span></p>
                        <p className="text-xs text-zinc-400 mt-0.5">Resta {formatCurrency(item.totalRemaining)}</p>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full bg-violet-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">{item.remainingCount} parcela{item.remainingCount !== 1 ? 's' : ''} restante{item.remainingCount !== 1 ? 's' : ''}</p>
                  </div>
                );
              })}
            </div>
            {data.installmentSummary.length > 4 && (
              <button onClick={() => setShowAllInstallments(s => !s)}
                className="w-full text-xs text-violet-600 hover:text-violet-700 font-medium py-1.5 transition-colors">
                {showAllInstallments ? '▲ Mostrar menos' : `▼ Ver todos (${data.installmentSummary.length})`}
              </button>
            )}
            <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-between">
              <p className="text-sm text-zinc-500">Total mensal em parcelas</p>
              <p className="text-sm font-bold text-violet-600">{formatCurrency(data.totalMonthlyInstallments)}</p>
            </div>
          </div>
        )}

        {/* Metas */}
        {data.upcomingGoals && data.upcomingGoals.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-zinc-900">Metas</h3>
              <Link to="/metas" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium transition-colors">Ver todas →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.upcomingGoals.map(goal => {
                const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const dl  = new Date(goal.deadline + 'T00:00:00');
                const days = Math.ceil((dl - today) / 86400000);
                const daysLabel = days < 0 ? `${Math.abs(days)}d em atraso` : days === 0 ? 'Vence hoje' : `${days} dias`;
                const daysColor = days <= 0 ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-zinc-400';
                return (
                  <div key={goal.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                        style={{ backgroundColor: goal.color }}>
                        <Target size={14} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 truncate">{goal.title}</p>
                        <p className={`text-xs ${daysColor}`}>{daysLabel}</p>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-100 rounded-full h-2 mb-1.5">
                      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: goal.color }} />
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

      </div>
    </div>
  );
}
