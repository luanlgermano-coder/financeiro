import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import { getSubscriptions, createSubscription, updateSubscription, deleteSubscription, getCards } from '../api';
import { formatCurrency } from '../utils/formatters';
import Modal from '../components/Modal';

const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#14b8a6','#6b7280'];

const initialForm = { name: '', amount: '', billing_day: '1', card_id: '' };

function SubscriptionForm({ initial, cards, onSubmit, onCancel, loading }) {
  const [form, setForm] = useState(initial || initialForm);
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Nome *</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Netflix, Spotify..."
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Valor mensal (R$) *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="0,00"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Dia de cobrança</label>
          <input
            type="number"
            min="1"
            max="31"
            value={form.billing_day}
            onChange={e => setForm(f => ({ ...f, billing_day: e.target.value }))}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Cartão / Conta</label>
        <select
          value={form.card_id}
          onChange={e => setForm(f => ({ ...f, card_id: e.target.value }))}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Não especificado</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50">
          Cancelar
        </button>
        <button
          type="button"
          disabled={loading || !form.name || !form.amount}
          onClick={() => onSubmit(form)}
          className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold"
        >
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

export default function Assinaturas() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([getSubscriptions(), getCards()]).then(([subs, cds]) => {
      setSubscriptions(subs.data);
      setCards(cds.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (form) => {
    setSaving(true);
    try {
      await createSubscription(form);
      setShowModal(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (form) => {
    setSaving(true);
    try {
      await updateSubscription(editTarget.id, { ...form, active: editTarget.active });
      setEditTarget(null);
      load();
    } finally {
      setSaving(false);
    }
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

  const active = subscriptions.filter(s => s.active);
  const totalMonthly = active.reduce((s, sub) => s + sub.amount, 0);
  const annualProjection = totalMonthly * 12;

  const getSubColor = (id) => COLORS[id % COLORS.length];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Assinaturas</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Serviços recorrentes</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nova assinatura
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-purple-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total mensal</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(totalMonthly)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-zinc-400">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Ativas</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{active.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-amber-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Projeção anual</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(annualProjection)}</p>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h3 className="font-semibold text-zinc-900">Todas as Assinaturas</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
          </div>
        ) : subscriptions.length === 0 ? (
          <p className="text-zinc-400 text-sm text-center py-12">Nenhuma assinatura cadastrada</p>
        ) : (
          <div className="divide-y divide-zinc-50">
            {subscriptions.map(sub => (
              <div key={sub.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-zinc-50 transition-colors group ${!sub.active ? 'opacity-50' : ''}`}>
                <div className="flex-shrink-0">
                  <span className="w-3 h-3 rounded-full block" style={{ backgroundColor: getSubColor(sub.id) }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-800">{sub.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-zinc-400">Dia {sub.billing_day} de cada mês</span>
                    {sub.card_name && <span className="text-xs text-zinc-400">· {sub.card_name}</span>}
                  </div>
                </div>
                <div className="text-sm font-bold text-zinc-900">{formatCurrency(sub.amount)}<span className="text-xs font-normal text-zinc-400">/mês</span></div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleToggle(sub)}
                    className={`p-1.5 rounded-lg transition-colors ${sub.active ? 'text-emerald-500 hover:bg-emerald-50' : 'text-zinc-400 hover:bg-zinc-100'}`}
                    title={sub.active ? 'Desativar' : 'Ativar'}
                  >
                    {sub.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                  </button>
                  <button onClick={() => setEditTarget(sub)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(sub.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <Modal title="Nova Assinatura" onClose={() => setShowModal(false)}>
          <SubscriptionForm cards={cards} onSubmit={handleCreate} onCancel={() => setShowModal(false)} loading={saving} />
        </Modal>
      )}

      {editTarget && (
        <Modal title="Editar Assinatura" onClose={() => setEditTarget(null)}>
          <SubscriptionForm
            initial={{ name: editTarget.name, amount: String(editTarget.amount), billing_day: String(editTarget.billing_day), card_id: editTarget.card_id || '' }}
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
