import React, { useState, useEffect } from 'react';
import {
  Save, Trash2, AlertTriangle, CheckCircle2, X, CalendarX,
  Plus, CreditCard, Receipt
} from 'lucide-react';
import {
  getSettings, updateSettings, resetData, resetMonth,
  getCards, updateCard,
  getBills, createBill, deleteBill,
} from '../api';
import { formatCurrency } from '../utils/formatters';

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

const OWNER_OPTS = [
  { value: 'casal',    label: 'Casal' },
  { value: 'luan',     label: 'Luan' },
  { value: 'barbara',  label: 'Bárbara' },
];

const OWNER_STYLE = {
  luan:    'bg-blue-100 text-blue-700',
  barbara: 'bg-pink-100 text-pink-700',
  casal:   'bg-violet-100 text-violet-700',
};

export default function Configuracoes() {
  // — preferences —
  const [form, setForm]       = useState({ user_name: '', spouse_name: '' });
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');

  // — danger zone modals —
  const [showAllModal,   setShowAllModal]   = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [loadingAll,   setLoadingAll]   = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);

  // — cards —
  const [cards, setCards]             = useState([]);
  const [cardDueDays, setCardDueDays] = useState({});   // { id: '' | number }
  const [savingCard, setSavingCard]   = useState(null); // card id being saved

  // — bills —
  const [bills, setBills]         = useState([]);
  const [billForm, setBillForm]   = useState({ name: '', amount: '', due_day: '', owner: 'casal' });
  const [savingBill, setSavingBill] = useState(false);

  const currentMonthLabel = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const flash = (msg, isErr = false) => {
    if (isErr) { setError(msg); setSuccess(''); }
    else        { setSuccess(msg); setError(''); }
  };

  useEffect(() => {
    getSettings().then(r => setForm({ user_name: r.data.user_name || '', spouse_name: r.data.spouse_name || '' })).catch(() => {});
    getCards().then(r => {
      setCards(r.data);
      setCardDueDays(Object.fromEntries(r.data.map(c => [c.id, c.due_day ?? ''])));
    }).catch(() => {});
    getBills().then(r => setBills(r.data)).catch(() => {});
  }, []);

  // ── Preferences ──
  const handleSave = async () => {
    setSaving(true); flash('');
    try { await updateSettings(form); flash('Configurações salvas.'); }
    catch (err) { flash(err.response?.data?.error || 'Erro ao salvar.', true); }
    finally { setSaving(false); }
  };

  // ── Danger zone ──
  const handleResetAll = async () => {
    setLoadingAll(true); flash('');
    try {
      await resetData();
      setShowAllModal(false);
      flash('Todos os dados foram apagados.');
      window.dispatchEvent(new CustomEvent('transaction-saved'));
    } catch (err) { flash(err.response?.data?.error || 'Erro ao limpar dados.', true); }
    finally { setLoadingAll(false); }
  };

  const handleResetMonth = async () => {
    setLoadingMonth(true); flash('');
    try {
      await resetMonth();
      setShowMonthModal(false);
      flash(`Lançamentos de ${currentMonthLabel} apagados.`);
      window.dispatchEvent(new CustomEvent('transaction-saved'));
    } catch (err) { flash(err.response?.data?.error || 'Erro ao limpar dados do mês.', true); }
    finally { setLoadingMonth(false); }
  };

  // ── Cards ──
  const handleSaveCardDueDay = async (card) => {
    setSavingCard(card.id);
    try {
      const due_day = cardDueDays[card.id] !== '' ? parseInt(cardDueDays[card.id]) : null;
      await updateCard(card.id, { name: card.name, color: card.color, due_day });
      flash('Dia de vencimento salvo.');
    } catch (err) { flash('Erro ao salvar cartão.', true); }
    finally { setSavingCard(null); }
  };

  // ── Bills ──
  const setBillField = (k, v) => setBillForm(f => ({ ...f, [k]: v }));

  const handleAddBill = async (e) => {
    e.preventDefault();
    if (!billForm.name || !billForm.amount || !billForm.due_day) return;
    setSavingBill(true);
    try {
      const res = await createBill({
        name:    billForm.name,
        amount:  parseFloat(billForm.amount),
        due_day: parseInt(billForm.due_day),
        owner:   billForm.owner,
      });
      setBills(prev => [...prev, res.data].sort((a, b) => a.due_day - b.due_day));
      setBillForm({ name: '', amount: '', due_day: '', owner: 'casal' });
      flash('Conta adicionada.');
    } catch (err) { flash('Erro ao adicionar conta.', true); }
    finally { setSavingBill(false); }
  };

  const handleDeleteBill = async (id) => {
    if (!confirm('Remover esta conta fixa?')) return;
    await deleteBill(id);
    setBills(prev => prev.filter(b => b.id !== id));
    flash('Conta removida.');
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

      {/* ── Preferências ── */}
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

      {/* ── Cartões ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-blue-500" />
          <h2 className="font-semibold text-zinc-900">Cartões</h2>
        </div>
        <p className="text-xs text-zinc-500 -mt-2">
          Configure o dia de vencimento de cada cartão para aparecer em "Próximos Vencimentos".
        </p>

        {cards.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Nenhum cartão cadastrado</p>
        ) : (
          <div className="space-y-3">
            {cards.map(card => {
              const original = card.due_day ?? '';
              const current  = cardDueDays[card.id] ?? '';
              const changed  = String(current) !== String(original);
              return (
                <div key={card.id} className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: card.color }}
                  />
                  <span className="text-sm text-zinc-700 flex-1 truncate">{card.name}</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Dia"
                    value={current}
                    onChange={e => setCardDueDays(prev => ({ ...prev, [card.id]: e.target.value }))}
                    className="w-20 px-2 py-1.5 border border-zinc-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    onClick={() => handleSaveCardDueDay(card)}
                    disabled={!changed || savingCard === card.id}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 bg-blue-500 hover:bg-blue-600 text-white disabled:bg-zinc-200 disabled:text-zinc-400"
                  >
                    {savingCard === card.id ? '…' : 'Salvar'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Contas Fixas ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Receipt size={18} className="text-emerald-500" />
          <h2 className="font-semibold text-zinc-900">Contas Fixas</h2>
        </div>
        <p className="text-xs text-zinc-500 -mt-2">
          Luz, celular, financiamento, etc. Aparecem em "Próximos Vencimentos".
        </p>

        {/* Add form */}
        <form onSubmit={handleAddBill} className="bg-zinc-50 rounded-xl p-4 space-y-3 border border-zinc-100">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Nova conta</p>
          <div>
            <input
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              placeholder="Nome da conta (ex: Luz, Celular…)"
              value={billForm.name}
              onChange={e => setBillField('name', e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="0,00"
                value={billForm.amount}
                onChange={e => setBillField('amount', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Dia vencimento</label>
              <input
                type="number"
                min="1"
                max="31"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                placeholder="1 – 31"
                value={billForm.due_day}
                onChange={e => setBillField('due_day', e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Responsável</label>
            <select
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
              value={billForm.owner}
              onChange={e => setBillField('owner', e.target.value)}
            >
              {OWNER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button
            type="submit"
            disabled={savingBill}
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={14} />
            {savingBill ? 'Salvando…' : 'Adicionar conta'}
          </button>
        </form>

        {/* Bill list */}
        {bills.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Nenhuma conta cadastrada</p>
        ) : (
          <div className="space-y-2">
            {bills.map(bill => {
              const ownerLabel = bill.owner === 'barbara' ? 'Bárbara' : bill.owner.charAt(0).toUpperCase() + bill.owner.slice(1);
              return (
                <div key={bill.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50 hover:bg-zinc-100 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-zinc-200 text-xs font-bold text-zinc-600 flex-shrink-0">
                    {bill.due_day}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{bill.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${OWNER_STYLE[bill.owner] || OWNER_STYLE.casal}`}>
                        {ownerLabel}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-zinc-800 flex-shrink-0">{formatCurrency(bill.amount)}</p>
                  <button
                    onClick={() => handleDeleteBill(bill.id)}
                    className="p-1.5 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0"
                  >
                    <Trash2 size={14} className="text-zinc-400 hover:text-red-500" />
                  </button>
                </div>
              );
            })}
            <div className="pt-2 flex justify-between text-xs text-zinc-500 px-1">
              <span>{bills.length} conta{bills.length !== 1 ? 's' : ''}</span>
              <span className="font-semibold">{formatCurrency(bills.reduce((s, b) => s + b.amount, 0))}/mês</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Zona de perigo ── */}
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
