import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, ToggleLeft, ToggleRight, CheckCircle2, Circle, Calendar } from 'lucide-react';
import { getSubscriptions, createSubscription, updateSubscription, deleteSubscription, getCards, checkSubscription, uncheckSubscription } from '../api';
import { formatCurrency } from '../utils/formatters';
import Modal from '../components/Modal';

const currentMonth = () => new Date().toISOString().slice(0, 10).slice(0, 7);
const todayStr = () => new Date().toISOString().slice(0, 10);

const OWNERS = [
  { value: 'luan',    label: 'Luan',    color: '#3b82f6', border: 'border-blue-500',   text: 'text-blue-600',   bg: 'bg-blue-50',   badge: 'bg-blue-100 text-blue-700',   section: 'border-l-blue-500'   },
  { value: 'barbara', label: 'Bárbara', color: '#ec4899', border: 'border-pink-500',   text: 'text-pink-600',   bg: 'bg-pink-50',   badge: 'bg-pink-100 text-pink-700',   section: 'border-l-pink-500'   },
  { value: 'casal',   label: 'Casal',   color: '#8b5cf6', border: 'border-violet-500', text: 'text-violet-600', bg: 'bg-violet-50', badge: 'bg-violet-100 text-violet-700', section: 'border-l-violet-500' },
];
const OWNER_MAP = Object.fromEntries(OWNERS.map(o => [o.value, o]));

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#6b7280'];

function remainingMonths(sub) {
  if (!sub.duration_months || !sub.start_date) return null;
  const [y, m] = sub.start_date.split('-').map(Number);
  const totalStartMonths = y * 12 + (m - 1);
  const endTotalMonths   = totalStartMonths + parseInt(sub.duration_months);
  const now = new Date();
  const todayMonths = now.getFullYear() * 12 + now.getMonth();
  return Math.max(0, endTotalMonths - todayMonths);
}

const initialForm = {
  name: '', amount: '', billing_day: '1', card_id: '',
  owner: 'casal', has_duration: false, duration_months: '', start_date: todayStr(),
};

function SubscriptionForm({ initial, cards, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial || initialForm);
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const setB = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.checked }));

  const handleSubmit = () => {
    onSubmit({
      name:            form.name,
      amount:          parseFloat(form.amount),
      billing_day:     parseInt(form.billing_day) || 1,
      card_id:         form.card_id || null,
      owner:           form.owner || 'casal',
      duration_months: form.has_duration && form.duration_months ? parseInt(form.duration_months) : null,
      start_date:      form.has_duration && form.start_date ? form.start_date : null,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Nome *</label>
        <input type="text" value={form.name} onChange={set('name')} placeholder="Netflix, Spotify..."
          autoFocus className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">De quem é?</label>
        <div className="flex gap-2">
          {OWNERS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, owner: o.value }))}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                form.owner === o.value
                  ? 'text-white border-transparent'
                  : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 bg-white'
              }`}
              style={form.owner === o.value ? { backgroundColor: o.color, borderColor: o.color } : {}}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Valor mensal (R$) *</label>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} placeholder="0,00"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Dia de cobrança</label>
          <input type="number" min="1" max="31" value={form.billing_day} onChange={set('billing_day')}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Cartão / Conta</label>
        <select value={form.card_id} onChange={set('card_id')}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">Não especificado</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Prazo */}
      <div className="border border-zinc-200 rounded-xl p-3 space-y-3">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.has_duration} onChange={setB('has_duration')}
            className="w-4 h-4 rounded accent-emerald-500" />
          <span className="text-sm font-medium text-zinc-700">Tem prazo definido? (ex: curso)</span>
        </label>
        {form.has_duration && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Duração (meses)</label>
              <input type="number" min="1" value={form.duration_months} onChange={set('duration_months')} placeholder="Ex: 6"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Início</label>
              <input type="date" value={form.start_date} onChange={set('start_date')}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50">
          Cancelar
        </button>
        <button type="button" disabled={loading || !form.name || !form.amount} onClick={handleSubmit}
          className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold">
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

function SubRow({ sub, onCheckToggle, onToggle, onEdit, onDelete }) {
  const owner = OWNER_MAP[sub.owner] || OWNER_MAP.casal;
  const color = COLORS[sub.id % COLORS.length];
  const rem   = remainingMonths(sub);
  const annual = sub.amount * 12;

  return (
    <div className={`flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors ${!sub.active ? 'opacity-50' : ''}`}>
      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-semibold text-zinc-800 ${sub.checked ? 'line-through text-zinc-400' : ''}`}>
            {sub.name}
          </p>
          {sub.checked && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">Pago</span>
          )}
          {rem !== null && sub.active && (
            <span className={`flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-md ${
              rem <= 1 ? 'bg-red-100 text-red-600' : rem <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'
            }`}>
              <Calendar size={10} />
              {rem === 0 ? 'Expira este mês' : `${rem} ${rem === 1 ? 'mês restante' : 'meses restantes'}`}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          <span className="text-xs text-zinc-400">Dia {sub.billing_day}</span>
          {sub.card_name && <span className="text-xs text-zinc-400">· {sub.card_name}</span>}
        </div>
      </div>

      {/* Valores */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-zinc-900">
          {formatCurrency(sub.amount)}<span className="text-xs font-normal text-zinc-400">/mês</span>
        </p>
        <p className="text-xs text-zinc-400 mt-0.5">{formatCurrency(annual)}/ano</p>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {sub.active && (
          <button onClick={() => onCheckToggle(sub)}
            className={`p-1.5 rounded-lg transition-colors ${sub.checked ? 'text-emerald-500 hover:bg-emerald-50' : 'text-zinc-300 hover:text-emerald-500 hover:bg-emerald-50'}`}
            title={sub.checked ? 'Desmarcar' : 'Marcar como pago'}>
            {sub.checked ? <CheckCircle2 size={17} /> : <Circle size={17} />}
          </button>
        )}
        <button onClick={() => onToggle(sub)}
          className={`p-1.5 rounded-lg transition-colors ${sub.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-zinc-400 hover:bg-zinc-100'}`}
          title={sub.active ? 'Desativar' : 'Ativar'}>
          {sub.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>
        <button onClick={() => onEdit(sub)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(sub.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default function Assinaturas() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [cards, setCards]                 = useState([]);
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);
  const [showModal, setShowModal]         = useState(false);
  const [editTarget, setEditTarget]       = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([getSubscriptions(currentMonth()), getCards()])
      .then(([subs, cds]) => { setSubscriptions(subs.data); setCards(cds.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    setSaving(true);
    try { await createSubscription(data); setShowModal(false); load(); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (data) => {
    setSaving(true);
    try { await updateSubscription(editTarget.id, { ...data, active: editTarget.active }); setEditTarget(null); load(); }
    finally { setSaving(false); }
  };

  const handleToggle = async (sub) => {
    await updateSubscription(sub.id, { ...sub, active: !sub.active });
    load();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta assinatura?')) return;
    await deleteSubscription(id);
    load();
  };

  const handleCheckToggle = async (sub) => {
    const month = currentMonth();
    if (sub.checked) { await uncheckSubscription(sub.id, month); }
    else             { await checkSubscription(sub.id, month); }
    setSubscriptions(prev => prev.map(s => s.id === sub.id ? { ...s, checked: !sub.checked } : s));
  };

  // Totais
  const active = subscriptions.filter(s => s.active);
  const totalLuan    = active.filter(s => s.owner === 'luan').reduce((acc, s) => acc + s.amount, 0);
  const totalBarbara = active.filter(s => s.owner === 'barbara').reduce((acc, s) => acc + s.amount, 0);
  const totalCasal   = active.filter(s => s.owner === 'casal').reduce((acc, s) => acc + s.amount, 0);
  const totalGeral   = totalLuan + totalBarbara + totalCasal;
  const totalAnual   = totalGeral * 12;

  const editInitial = editTarget ? {
    name:           editTarget.name,
    amount:         String(editTarget.amount),
    billing_day:    String(editTarget.billing_day),
    card_id:        editTarget.card_id ? String(editTarget.card_id) : '',
    owner:          editTarget.owner || 'casal',
    has_duration:   !!editTarget.duration_months,
    duration_months: editTarget.duration_months ? String(editTarget.duration_months) : '',
    start_date:     editTarget.start_date || todayStr(),
  } : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Assinaturas</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Serviços recorrentes</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} />
          Nova assinatura
        </button>
      </div>

      {/* Card total consolidado */}
      <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-6 shadow-lg text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Total consolidado mensal</p>
          <p className="text-4xl font-extrabold mt-1 tracking-tight">{formatCurrency(totalGeral)}</p>
          <p className="text-sm text-white/70 mt-1">{active.length} assinatura{active.length !== 1 ? 's' : ''} ativa{active.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="text-right sm:text-right">
          <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">Projeção anual</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(totalAnual)}</p>
        </div>
      </div>

      {/* Cards por pessoa */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Luan',    total: totalLuan,    count: active.filter(s => s.owner === 'luan').length,    ...OWNER_MAP.luan    },
          { label: 'Bárbara', total: totalBarbara, count: active.filter(s => s.owner === 'barbara').length, ...OWNER_MAP.barbara },
          { label: 'Casal',   total: totalCasal,   count: active.filter(s => s.owner === 'casal').length,   ...OWNER_MAP.casal   },
        ].map(({ label, total, count, border, text, bg }) => (
          <div key={label} className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${border}`}>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${text}`}>{formatCurrency(total)}</p>
            <p className="text-xs text-zinc-400 mt-1">{count} ativa{count !== 1 ? 's' : ''} · {formatCurrency(total * 12)}/ano</p>
          </div>
        ))}
      </div>

      {/* Seções por dono */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
        </div>
      ) : (
        OWNERS.map(({ value, label, color, border, text }) => {
          const subs = subscriptions.filter(s => s.owner === value);
          if (subs.length === 0) return null;
          return (
            <div key={value} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className={`px-5 py-4 border-b border-zinc-100 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <h3 className="font-semibold text-zinc-900">Assinaturas — {label}</h3>
                </div>
                <span className={`text-xs font-semibold ${text}`}>
                  {formatCurrency(subs.filter(s => s.active).reduce((a, s) => a + s.amount, 0))}/mês
                </span>
              </div>
              <div className="divide-y divide-zinc-50">
                {subs.map(sub => (
                  <SubRow
                    key={sub.id}
                    sub={sub}
                    onCheckToggle={handleCheckToggle}
                    onToggle={handleToggle}
                    onEdit={setEditTarget}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {subscriptions.length === 0 && !loading && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-zinc-400 text-sm">Nenhuma assinatura cadastrada</p>
        </div>
      )}

      {showModal && (
        <Modal title="Nova Assinatura" onClose={() => setShowModal(false)}>
          <SubscriptionForm cards={cards} onSubmit={handleCreate} onCancel={() => setShowModal(false)} loading={saving} />
        </Modal>
      )}

      {editTarget && (
        <Modal title="Editar Assinatura" onClose={() => setEditTarget(null)}>
          <SubscriptionForm
            initial={editInitial}
            cards={cards}
            onSubmit={handleUpdate}
            onCancel={() => setEditTarget(null)}
            loading={saving}
          />
        </Modal>
      )}
    </div>
  );
}
