import React, { useState, useEffect, useCallback } from 'react';
import {
  Target, Plus, Pencil, Trash2, PiggyBank, X, Save,
  CalendarClock, TrendingUp, CheckCircle2, AlertTriangle
} from 'lucide-react';
import { getGoals, createGoal, updateGoal, deleteGoal, depositGoal } from '../api';
import { formatCurrency } from '../utils/formatters';

const COLORS = [
  '#10b981', '#3b82f6', '#ec4899', '#f59e0b',
  '#8b5cf6', '#ef4444', '#f97316', '#14b8a6',
];

const OWNER_LABELS = { luan: 'Luan', barbara: 'Bárbara', casal: 'Casal' };
const OWNER_COLORS = {
  luan:    'bg-blue-100 text-blue-700',
  barbara: 'bg-pink-100 text-pink-700',
  casal:   'bg-emerald-100 text-emerald-700',
};

function daysUntil(deadline) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(deadline + 'T00:00:00');
  return Math.ceil((d - today) / 86400000);
}

function formatDeadline(deadline) {
  return new Date(deadline + 'T00:00:00').toLocaleDateString('pt-BR');
}

const emptyForm = { title: '', target_amount: '', current_amount: '', deadline: '', owner: 'casal', color: '#10b981' };

function GoalModal({ goal, onClose, onSaved }) {
  const [form, setForm] = useState(goal ? {
    title: goal.title,
    target_amount: String(goal.target_amount),
    current_amount: String(goal.current_amount),
    deadline: goal.deadline,
    owner: goal.owner,
    color: goal.color,
  } : { ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim() || !form.target_amount || !form.deadline) {
      setError('Nome, valor alvo e prazo são obrigatórios.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
        deadline: form.deadline,
        owner: form.owner,
        color: form.color,
      };
      if (goal) await updateGoal(goal.id, payload);
      else      await createGoal(payload);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar meta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-bold text-zinc-900">{goal ? 'Editar Meta' : 'Nova Meta'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Nome da meta</label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="Ex: Viagem para a praia"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Valor alvo (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.target_amount}
                onChange={e => set('target_amount', e.target.value)}
                placeholder="5000"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Já guardado (R$)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.current_amount}
                onChange={e => set('current_amount', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Prazo</label>
            <input
              type="date"
              value={form.deadline}
              onChange={e => set('deadline', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Dono</label>
            <select
              value={form.owner}
              onChange={e => set('owner', e.target.value)}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="casal">Casal</option>
              <option value="luan">Luan</option>
              <option value="barbara">Bárbara</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Cor</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set('color', c)}
                  className={`w-8 h-8 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-offset-2 ring-zinc-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <Save size={15} />
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DepositModal({ goal, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const remaining = goal.target_amount - goal.current_amount;
  const preview = Math.min(goal.current_amount + (parseFloat(amount) || 0), goal.target_amount);
  const previewPct = goal.target_amount > 0 ? Math.round((preview / goal.target_amount) * 100) : 0;

  const handleSave = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) { setError('Informe um valor positivo.'); return; }
    setSaving(true);
    setError('');
    try {
      await depositGoal(goal.id, val);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao registrar valor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-bold text-zinc-900">Adicionar valor</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-sm font-semibold text-zinc-800">{goal.title}</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {formatCurrency(goal.current_amount)} de {formatCurrency(goal.target_amount)} · falta {formatCurrency(remaining)}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Quanto você guardou? (R$)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0,00"
              autoFocus
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {amount && parseFloat(amount) > 0 && (
            <div>
              <div className="flex justify-between text-xs text-zinc-500 mb-1">
                <span>Progresso após depósito</span>
                <span>{previewPct}%</span>
              </div>
              <div className="w-full bg-zinc-100 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-500"
                  style={{ width: `${previewPct}%`, backgroundColor: goal.color }}
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1">{formatCurrency(preview)} de {formatCurrency(goal.target_amount)}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            <PiggyBank size={15} />
            {saving ? 'Salvando…' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Metas() {
  const [goals, setGoals]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editGoal, setEditGoal]   = useState(null);
  const [depositGoalItem, setDepositGoalItem] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    getGoals()
      .then(r => setGoals(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja apagar esta meta?')) return;
    try {
      await deleteGoal(id);
      setGoals(gs => gs.filter(g => g.id !== id));
    } catch (err) {
      alert(err.response?.data?.error || 'Erro ao apagar meta.');
    }
  };

  const activeGoals    = goals.filter(g => g.current_amount < g.target_amount);
  const completedGoals = goals.filter(g => g.current_amount >= g.target_amount);
  const totalTarget    = activeGoals.reduce((s, g) => s + g.target_amount, 0);
  const totalSaved     = activeGoals.reduce((s, g) => s + g.current_amount, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Metas Financeiras</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Acompanhe seus objetivos de poupança</p>
        </div>
        <button
          onClick={() => { setEditGoal(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Plus size={16} />
          Nova Meta
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-emerald-400">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Metas ativas</p>
          <p className="text-3xl font-bold text-zinc-900 mt-1">{activeGoals.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-blue-400">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total a alcançar</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(totalTarget)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-amber-400">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total já guardado</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(totalSaved)}</p>
          {totalTarget > 0 && (
            <p className="text-xs text-zinc-400 mt-1">{Math.round((totalSaved / totalTarget) * 100)}% do total</p>
          )}
        </div>
      </div>

      {/* Lista de metas ativas */}
      {activeGoals.length === 0 && completedGoals.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 shadow-sm text-center">
          <Target size={40} className="text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500 font-medium">Nenhuma meta cadastrada</p>
          <p className="text-zinc-400 text-sm mt-1">Crie sua primeira meta para começar a poupar!</p>
        </div>
      ) : (
        <>
          {activeGoals.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-zinc-800 mb-3">Em andamento</h2>
              <div className="space-y-4">
                {activeGoals.map(goal => <GoalCard key={goal.id} goal={goal} onEdit={() => { setEditGoal(goal); setShowModal(true); }} onDelete={() => handleDelete(goal.id)} onDeposit={() => setDepositGoalItem(goal)} />)}
              </div>
            </div>
          )}

          {completedGoals.length > 0 && (
            <div>
              <h2 className="text-base font-bold text-zinc-800 mb-3">Concluídas</h2>
              <div className="space-y-4">
                {completedGoals.map(goal => <GoalCard key={goal.id} goal={goal} onEdit={() => { setEditGoal(goal); setShowModal(true); }} onDelete={() => handleDelete(goal.id)} onDeposit={() => setDepositGoalItem(goal)} completed />)}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showModal && (
        <GoalModal
          goal={editGoal}
          onClose={() => { setShowModal(false); setEditGoal(null); }}
          onSaved={() => { setShowModal(false); setEditGoal(null); load(); }}
        />
      )}
      {depositGoalItem && (
        <DepositModal
          goal={depositGoalItem}
          onClose={() => setDepositGoalItem(null)}
          onSaved={() => { setDepositGoalItem(null); load(); }}
        />
      )}
    </div>
  );
}

function GoalCard({ goal, onEdit, onDelete, onDeposit, completed }) {
  const pct  = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
  const days = daysUntil(goal.deadline);
  const remaining = goal.target_amount - goal.current_amount;

  let daysLabel, daysColor;
  if (completed) {
    daysLabel = 'Concluída';
    daysColor = 'text-emerald-600';
  } else if (days < 0) {
    daysLabel = `${Math.abs(days)} dias em atraso`;
    daysColor = 'text-red-500';
  } else if (days === 0) {
    daysLabel = 'Vence hoje!';
    daysColor = 'text-red-500';
  } else if (days <= 30) {
    daysLabel = `${days} dias restantes`;
    daysColor = 'text-amber-500';
  } else {
    daysLabel = `${days} dias restantes`;
    daysColor = 'text-zinc-500';
  }

  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm ${completed ? 'opacity-75' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm"
            style={{ backgroundColor: goal.color }}
          >
            {completed ? <CheckCircle2 size={18} /> : <Target size={18} />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900 truncate">{goal.title}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${OWNER_COLORS[goal.owner] || 'bg-zinc-100 text-zinc-600'}`}>
                {OWNER_LABELS[goal.owner] || goal.owner}
              </span>
              <span className={`text-xs flex items-center gap-1 ${daysColor}`}>
                <CalendarClock size={11} />
                {formatDeadline(goal.deadline)} · {daysLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {!completed && (
            <button
              onClick={onDeposit}
              className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
            >
              <PiggyBank size={13} />
              Depositar
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
            <Pencil size={15} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Progresso */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
          <span>{formatCurrency(goal.current_amount)} de {formatCurrency(goal.target_amount)}</span>
          <span className="font-semibold" style={{ color: goal.color }}>{pct}%</span>
        </div>
        <div className="w-full bg-zinc-100 rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: goal.color }}
          />
        </div>
        {!completed && remaining > 0 && (
          <p className="text-xs text-zinc-400 mt-1.5">Falta {formatCurrency(remaining)} para atingir a meta</p>
        )}
      </div>
    </div>
  );
}
