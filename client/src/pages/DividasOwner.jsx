import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { getDebts, createDebt, updateDebt, deleteDebt, registerDebtPayment, getDebtPayments } from '../api';
import { formatCurrency } from '../utils/formatters';
import Modal from '../components/Modal';

const THEME = {
  luan:    { border: 'border-blue-500',  accent: '#3b82f6', text: 'text-blue-600',  bar: 'bg-blue-500',  line: '#3b82f6' },
  barbara: { border: 'border-pink-500',  accent: '#ec4899', text: 'text-pink-600',  bar: 'bg-pink-500',  line: '#ec4899' },
};
const LABEL = { luan: 'Luan', barbara: 'Bárbara' };

const emptyForm = { name: '', total_amount: '', monthly_payment: '', paid_amount: '0' };

function DebtForm({ initial, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial || emptyForm);
  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Nome da dívida *</label>
        <input type="text" value={form.name} onChange={set('name')} placeholder="Financiamento, Empréstimo…" autoFocus
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Valor total (R$) *</label>
          <input type="number" step="0.01" min="0" value={form.total_amount} onChange={set('total_amount')} placeholder="0,00"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Já pago (R$)</label>
          <input type="number" step="0.01" min="0" value={form.paid_amount} onChange={set('paid_amount')} placeholder="0,00"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Parcela mensal (R$) *</label>
        <input type="number" step="0.01" min="0" value={form.monthly_payment} onChange={set('monthly_payment')} placeholder="0,00"
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50">Cancelar</button>
        <button
          type="button"
          disabled={loading || !form.name || !form.total_amount || !form.monthly_payment}
          onClick={() => onSubmit(form)}
          className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold"
        >
          {loading ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

function PaymentModal({ debt, theme, onClose, onPaid }) {
  const [amount, setAmount] = useState(String(debt.monthly_payment));
  const [loading, setLoading] = useState(false);
  const remaining = debt.total_amount - debt.paid_amount;

  const handlePay = async () => {
    setLoading(true);
    try { await registerDebtPayment(debt.id, parseFloat(amount)); onPaid(); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Registrar Pagamento" onClose={onClose} size="sm">
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-900">{debt.name}</p>
          <p className="text-xs text-amber-700 mt-1">Restante: {formatCurrency(remaining)}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Valor pago (R$)</label>
          <input type="number" step="0.01" min="0.01" max={remaining} value={amount} onChange={e => setAmount(e.target.value)} autoFocus
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50">Cancelar</button>
          <button
            disabled={loading || !amount || parseFloat(amount) <= 0}
            onClick={handlePay}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold"
          >
            {loading ? 'Registrando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DebtChart({ debtId, color }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDebtPayments(debtId)
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [debtId]);

  if (loading) return (
    <div className="flex items-center justify-center h-20 text-zinc-400 text-xs">Carregando...</div>
  );

  if (!data || data.points.length < 2) return (
    <p className="text-xs text-zinc-400 text-center py-4">Nenhum pagamento registrado ainda.</p>
  );

  const points = data.points.map(p => ({
    ...p,
    label: new Date(p.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#a1a1aa' }} />
        <YAxis
          tick={{ fontSize: 10, fill: '#a1a1aa' }}
          tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
          width={48}
        />
        <Tooltip
          formatter={(v) => [formatCurrency(v), 'Saldo devedor']}
          labelStyle={{ fontSize: 11, color: '#3f3f46' }}
          contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', fontSize: 11 }}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={color}
          strokeWidth={2}
          dot={{ r: 3, fill: color }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default function DividasOwner({ owner }) {
  const theme  = THEME[owner];
  const label  = LABEL[owner];
  const [debts, setDebts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [payTarget, setPayTarget]   = useState(null);
  const [expandedChart, setExpandedChart] = useState({});

  const load = () => {
    setLoading(true);
    getDebts({ owner }).then(r => setDebts(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [owner]);

  const handleCreate = async (form) => {
    setSaving(true);
    try { await createDebt({ ...form, owner }); setShowAdd(false); load(); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (form) => {
    setSaving(true);
    try { await updateDebt(editTarget.id, { ...form, owner }); setEditTarget(null); load(); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta dívida?')) return;
    await deleteDebt(id);
    load();
  };

  const toggleChart = (id) => setExpandedChart(s => ({ ...s, [id]: !s[id] }));

  const active       = debts.filter(d => d.paid_amount < d.total_amount);
  const totalOpen    = active.reduce((s, d) => s + (d.total_amount - d.paid_amount), 0);
  const totalMonthly = active.reduce((s, d) => s + d.monthly_payment, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Dívidas — {label}</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Parcelamentos e dívidas</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          style={{ backgroundColor: theme.accent }}
        >
          <Plus size={16} /> Nova dívida
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-amber-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total em aberto</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(totalOpen)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-red-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Parcelas mensais</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(totalMonthly)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-zinc-400">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Dívidas ativas</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{active.length}</p>
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
        </div>
      ) : debts.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <p className="text-zinc-400 text-sm">Nenhuma dívida cadastrada para {label}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {debts.map(debt => {
            const pct       = debt.total_amount > 0 ? Math.round((debt.paid_amount / debt.total_amount) * 100) : 0;
            const remaining = debt.total_amount - debt.paid_amount;
            const isQuitada = remaining <= 0;
            const chartOpen = expandedChart[debt.id];

            return (
              <div key={debt.id} className={`bg-white rounded-2xl p-5 shadow-sm ${isQuitada ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-zinc-900">{debt.name}</h3>
                      {isQuitada && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Quitada</span>}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">Parcela: {formatCurrency(debt.monthly_payment)}/mês</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setEditTarget(debt)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"><Pencil size={14} /></button>
                    <button onClick={() => handleDelete(debt.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500"><Trash2 size={14} /></button>
                  </div>
                </div>

                <div className="flex justify-between text-sm mb-3">
                  <div><p className="text-xs text-zinc-400">Pago</p><p className="font-semibold text-emerald-600">{formatCurrency(debt.paid_amount)}</p></div>
                  <div className="text-right"><p className="text-xs text-zinc-400">Restante</p><p className="font-semibold text-amber-600">{formatCurrency(Math.max(0, remaining))}</p></div>
                  <div className="text-right"><p className="text-xs text-zinc-400">Total</p><p className="font-semibold text-zinc-700">{formatCurrency(debt.total_amount)}</p></div>
                </div>

                <div className="w-full bg-zinc-100 rounded-full h-1.5 mb-3">
                  <div className={`h-1.5 rounded-full transition-all duration-500 ${theme.bar}`} style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-center justify-between">
                  <button
                    onClick={() => toggleChart(debt.id)}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    {chartOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {chartOpen ? 'Ocultar gráfico' : 'Ver evolução'}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">{pct}% quitado</span>
                    {!isQuitada && (
                      <button onClick={() => setPayTarget(debt)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                        <DollarSign size={12} /> Registrar pagamento
                      </button>
                    )}
                  </div>
                </div>

                {/* Gráfico de evolução */}
                {chartOpen && (
                  <div className="mt-4 pt-4 border-t border-zinc-100">
                    <p className="text-xs font-medium text-zinc-500 mb-2">Evolução do saldo devedor</p>
                    <DebtChart debtId={debt.id} color={theme.line} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <Modal title={`Nova Dívida — ${label}`} onClose={() => setShowAdd(false)}>
          <DebtForm onSubmit={handleCreate} onCancel={() => setShowAdd(false)} loading={saving} />
        </Modal>
      )}
      {editTarget && (
        <Modal title="Editar Dívida" onClose={() => setEditTarget(null)}>
          <DebtForm
            initial={{ name: editTarget.name, total_amount: String(editTarget.total_amount), monthly_payment: String(editTarget.monthly_payment), paid_amount: String(editTarget.paid_amount) }}
            onSubmit={handleUpdate} onCancel={() => setEditTarget(null)} loading={saving}
          />
        </Modal>
      )}
      {payTarget && (
        <PaymentModal debt={payTarget} theme={theme} onClose={() => setPayTarget(null)} onPaid={() => { setPayTarget(null); load(); }} />
      )}
    </div>
  );
}
