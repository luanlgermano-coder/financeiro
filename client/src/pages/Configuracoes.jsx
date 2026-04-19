import React, { useState, useEffect } from 'react';
import { Save, Trash2, AlertTriangle, CheckCircle2, X, CalendarX } from 'lucide-react';
import { getSettings, updateSettings, resetData, resetMonth } from '../api';

function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="font-bold text-zinc-900">{title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-zinc-600">{message}</p>
        </div>
        <div className="flex gap-2 px-6 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Configuracoes() {
  const [form, setForm]     = useState({ user_name: '', spouse_name: '' });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');

  // modais
  const [showAllModal,   setShowAllModal]   = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [loadingAll,   setLoadingAll]   = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const currentMonthLabel = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  useEffect(() => {
    getSettings().then(r => {
      setForm({
        user_name:   r.data.user_name   || '',
        spouse_name: r.data.spouse_name || '',
      });
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      await updateSettings(form);
      setSuccess('Configurações salvas com sucesso.');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetAll = async () => {
    setLoadingAll(true);
    setSuccess('');
    setError('');
    try {
      await resetData();
      setShowAllModal(false);
      setSuccess('Todos os dados foram apagados.');
      window.dispatchEvent(new CustomEvent('transaction-saved'));
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao limpar dados.');
    } finally {
      setLoadingAll(false);
    }
  };

  const handleResetMonth = async () => {
    setLoadingMonth(true);
    setSuccess('');
    setError('');
    try {
      await resetMonth();
      setShowMonthModal(false);
      setSuccess(`Lançamentos de ${currentMonthLabel} apagados.`);
      window.dispatchEvent(new CustomEvent('transaction-saved'));
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao limpar dados do mês.');
    } finally {
      setLoadingMonth(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Configurações</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Preferências gerais do sistema</p>
      </div>

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700">{success}</p>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Preferências gerais */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-semibold text-zinc-900">Preferências</h2>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Nome do usuário</label>
          <input
            type="text"
            value={form.user_name}
            onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))}
            placeholder="Seu nome"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Nome do cônjuge</label>
          <input
            type="text"
            value={form.spouse_name}
            onChange={e => setForm(f => ({ ...f, spouse_name: e.target.value }))}
            placeholder="Nome do cônjuge"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
        >
          <Save size={15} />
          {saving ? 'Salvando…' : 'Salvar configurações'}
        </button>
      </div>

      {/* Zona de perigo */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-red-100 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="font-semibold text-zinc-900">Zona de perigo</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Ações irreversíveis — prossiga com cuidado.</p>
          </div>
        </div>

        {/* Limpar dados do mês */}
        <div className="border border-red-200 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-800">Limpar dados do mês atual</p>
            <p className="text-xs text-zinc-500 mt-0.5 capitalize">
              Remove todos os lançamentos de <strong>{currentMonthLabel}</strong>. Dívidas e assinaturas são mantidas.
            </p>
          </div>
          <button
            onClick={() => setShowMonthModal(true)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <CalendarX size={15} />
            Limpar dados do mês atual
          </button>
        </div>

        {/* Limpar todos os dados */}
        <div className="border border-red-200 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-800">Limpar todos os dados</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Remove <strong>todos</strong> os lançamentos, dívidas e assinaturas permanentemente.
              Categorias e cartões são mantidos.
            </p>
          </div>
          <button
            onClick={() => setShowAllModal(true)}
            className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Trash2 size={15} />
            Limpar todos os dados
          </button>
        </div>
      </div>

      {showMonthModal && (
        <ConfirmModal
          title="Limpar dados do mês"
          message={`Tem certeza? Isso vai apagar todos os lançamentos de ${currentMonthLabel}.`}
          confirmLabel="Sim, apagar mês"
          onConfirm={handleResetMonth}
          onClose={() => setShowMonthModal(false)}
          loading={loadingMonth}
        />
      )}

      {showAllModal && (
        <ConfirmModal
          title="Limpar todos os dados"
          message="Tem certeza? Essa ação vai apagar TODOS os lançamentos, gastos e histórico permanentemente."
          confirmLabel="Sim, apagar tudo"
          onConfirm={handleResetAll}
          onClose={() => setShowAllModal(false)}
          loading={loadingAll}
        />
      )}
    </div>
  );
}
