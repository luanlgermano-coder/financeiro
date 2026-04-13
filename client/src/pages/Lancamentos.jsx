import React, { useState, useEffect, useCallback } from 'react';
import {
  Pencil, Trash2, ChevronLeft, ChevronRight,
  AlertTriangle, CheckCircle2, XCircle, Plus, Save
} from 'lucide-react';
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  checkDuplicate, getCategories, getCards
} from '../api';
import {
  formatCurrency, formatDate, getMonthOptions, originLabel, originColor
} from '../utils/formatters';
import Modal from '../components/Modal';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  description: '', amount: '', type: 'expense',
  date: today(), category_id: '', card_id: '', notes: ''
};

// ---------------------------------------------------------------------------
// Alerta de duplicata inline
// ---------------------------------------------------------------------------
function DuplicateAlert({ existing, onForce, onCancel }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Possível duplicata detectada</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Já existe um lançamento parecido no banco:
          </p>
          <p className="text-xs font-medium text-amber-900 mt-1 bg-amber-100 rounded px-2 py-1">
            {existing.description} — {formatCurrency(existing.amount)} em {formatDate(existing.date)}
            {existing.category_name ? ` · ${existing.category_name}` : ''}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-white transition-colors"
        >
          <XCircle size={14} /> Cancelar
        </button>
        <button
          onClick={onForce}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <CheckCircle2 size={14} /> Adicionar mesmo assim
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulário de lançamento
// ---------------------------------------------------------------------------
function TransactionForm({ categories, cards, initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [loading, setLoading] = useState(false);
  const [duplicate, setDuplicate] = useState(null); // { existing }
  const [error, setError] = useState('');
  const isEdit = !!initial?.id;

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const submit = async (force = false) => {
    if (!form.description || !form.amount || !form.date) {
      setError('Preencha descrição, valor e data.');
      return;
    }
    setError('');

    // Verifica duplicata antes de salvar (só para novos, não edição)
    if (!force && !isEdit) {
      try {
        const res = await checkDuplicate({
          amount: form.amount,
          date: form.date,
          description: form.description,
          category_id: form.category_id || undefined,
        });
        if (res.data.isDuplicate) {
          setDuplicate(res.data.existing);
          return;
        }
      } catch (_) { /* ignora erros de rede na checagem */ }
    }

    setLoading(true);
    try {
      if (isEdit) {
        await updateTransaction(initial.id, form);
      } else {
        await createTransaction(form);
      }
      setForm(emptyForm);
      setDuplicate(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {duplicate && (
        <DuplicateAlert
          existing={duplicate}
          onForce={() => { setDuplicate(null); submit(true); }}
          onCancel={() => setDuplicate(null)}
        />
      )}

      {/* Tipo */}
      <div className="flex gap-2">
        {[['expense', '💸 Gasto'], ['income', '💰 Receita']].map(([val, label]) => (
          <button
            key={val}
            type="button"
            onClick={() => setForm(f => ({ ...f, type: val }))}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
              form.type === val
                ? val === 'expense'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Descrição */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Descrição *</label>
        <input
          type="text"
          value={form.description}
          onChange={set('description')}
          placeholder="Ex: Almoço no restaurante"
          autoFocus={!isEdit}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Valor + Data */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Valor (R$) *</label>
          <input
            type="number" step="0.01" min="0"
            value={form.amount} onChange={set('amount')}
            placeholder="0,00"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Data *</label>
          <input
            type="date"
            value={form.date} onChange={set('date')}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Categoria + Cartão */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Categoria</label>
          <select
            value={form.category_id} onChange={set('category_id')}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Sem categoria</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Cartão / Conta</label>
          <select
            value={form.card_id} onChange={set('card_id')}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">Não especificado</option>
            {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Observação */}
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Observação</label>
        <textarea
          rows={2}
          value={form.notes} onChange={set('notes')}
          placeholder="Detalhes opcionais..."
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {/* Botões */}
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button
            type="button" onClick={onCancel}
            className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50"
          >
            Cancelar
          </button>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => submit(false)}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {loading
            ? 'Salvando...'
            : isEdit
              ? <><Save size={15} /> Salvar</>
              : <><Plus size={15} /> Adicionar</>
          }
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Página principal
// ---------------------------------------------------------------------------
export default function Lancamentos() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories]     = useState([]);
  const [cards, setCards]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [editTarget, setEditTarget]     = useState(null);

  const months = getMonthOptions(12);
  const [monthIdx, setMonthIdx] = useState(0);
  const currentMonth = months[monthIdx].value;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getTransactions({ month: currentMonth }),
      getCategories(),
      getCards(),
    ]).then(([txRes, catRes, cardRes]) => {
      setTransactions(txRes.data);
      setCategories(catRes.data);
      setCards(cardRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [currentMonth]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const h = () => load();
    window.addEventListener('transaction-saved', h);
    return () => window.removeEventListener('transaction-saved', h);
  }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este lançamento?')) return;
    await deleteTransaction(id);
    load();
  };

  // Estatísticas do mês
  const income  = transactions.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0);
  const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Lançamentos</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Registro manual de entradas e saídas</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-sm">
          <button
            onClick={() => setMonthIdx(i => Math.min(i + 1, months.length - 1))}
            className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-zinc-700 min-w-[140px] text-center capitalize">
            {months[monthIdx].label}
          </span>
          <button
            onClick={() => setMonthIdx(i => Math.max(i - 1, 0))}
            disabled={monthIdx === 0}
            className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-emerald-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Entradas</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(income)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {transactions.filter(t => t.type === 'income').length} lançamentos
          </p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-red-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Saídas</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{formatCurrency(expense)}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {transactions.filter(t => t.type === 'expense').length} lançamentos
          </p>
        </div>
        <div className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${balance >= 0 ? 'border-emerald-400' : 'border-amber-500'}`}>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Saldo do mês</p>
          <p className={`text-2xl font-bold mt-1 ${balance >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
            {formatCurrency(balance)}
          </p>
          <p className="text-xs text-zinc-400 mt-0.5">{transactions.length} transações no total</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Formulário */}
        <div className="xl:col-span-1">
          <div className="bg-white rounded-2xl p-5 shadow-sm sticky top-[69px]">
            <h3 className="font-semibold text-zinc-900 mb-4">Novo Lançamento</h3>
            <TransactionForm
              categories={categories}
              cards={cards}
              onSaved={() => {
                load();
                window.dispatchEvent(new CustomEvent('transaction-saved'));
              }}
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900">
                Lançamentos de {months[monthIdx].label}
              </h3>
              <span className="text-xs text-zinc-400">{transactions.length} registros</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-zinc-400 text-sm text-center py-12">
                Nenhum lançamento neste período
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase whitespace-nowrap">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Categoria</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Origem</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                      <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {transactions.map(t => (
                      <tr key={t.id} className="hover:bg-zinc-50 transition-colors group">
                        <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-xs">
                          {formatDate(t.date)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-zinc-800 truncate max-w-[180px]">
                            {t.description}
                          </p>
                          {t.notes && (
                            <p className="text-xs text-zinc-400 mt-0.5 truncate max-w-[180px]">
                              {t.notes}
                            </p>
                          )}
                          {t.card_name && (
                            <p className="text-xs text-zinc-400 mt-0.5">{t.card_name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {t.category_name ? (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                              style={{ backgroundColor: t.category_color || '#6b7280' }}
                            >
                              {t.category_name}
                            </span>
                          ) : (
                            <span className="text-xs text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${originColor(t.origin)}`}>
                            {originLabel(t.origin)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                          <span className={t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditTarget(t)}
                              className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(t.id)}
                              className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de edição */}
      {editTarget && (
        <Modal title="Editar Lançamento" onClose={() => setEditTarget(null)}>
          <TransactionForm
            categories={categories}
            cards={cards}
            initial={{
              id: editTarget.id,
              description: editTarget.description,
              amount: String(editTarget.amount),
              type: editTarget.type,
              date: editTarget.date,
              category_id: editTarget.category_id || '',
              card_id: editTarget.card_id || '',
              notes: editTarget.notes || '',
            }}
            onSaved={() => { setEditTarget(null); load(); }}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}
