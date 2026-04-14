import React, { useState, useEffect } from 'react';
import { Save, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { getSettings, updateSettings, resetData } from '../api';

export default function Configuracoes() {
  const [form, setForm]       = useState({ user_name: '', spouse_name: '' });
  const [saving, setSaving]   = useState(false);
  const [resetting, setResetting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');

  useEffect(() => {
    getSettings().then(r => {
      setForm({
        user_name:    r.data.user_name    || '',
        spouse_name:  r.data.spouse_name  || '',
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

  const handleReset = async () => {
    const confirmed = window.confirm(
      'Tem certeza? Isso vai apagar TODAS as transações, dívidas e assinaturas.\n' +
      'Categorias e cartões serão mantidos.\n\n' +
      'Esta ação não pode ser desfeita.'
    );
    if (!confirmed) return;
    setResetting(true);
    setSuccess('');
    setError('');
    try {
      await resetData();
      setSuccess('Dados removidos com sucesso. Transações, dívidas e assinaturas foram apagados.');
      // Avisa todas as páginas abertas para recarregar
      window.dispatchEvent(new CustomEvent('transaction-saved'));
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao limpar dados.');
    } finally {
      setResetting(false);
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

        <div className="border border-red-200 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-800">Limpar dados de teste</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Remove todas as <strong>transações</strong>, <strong>dívidas</strong> e <strong>assinaturas</strong>.
              Categorias e cartões são mantidos.
            </p>
          </div>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Trash2 size={15} />
            {resetting ? 'Limpando…' : 'Limpar dados de teste'}
          </button>
        </div>
      </div>
    </div>
  );
}
