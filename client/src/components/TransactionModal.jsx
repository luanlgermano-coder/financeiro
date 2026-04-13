import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { createTransaction, updateTransaction, getCategories, getCards, checkDuplicate } from '../api';
import { formatCurrency, formatDate } from '../utils/formatters';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

const initialForm = {
  description: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  type: 'expense',
  category_id: '',
  card_id: '',
  notes: ''
};

export default function TransactionModal({ onClose, onSaved, transaction }) {
  const [form, setForm] = useState(transaction ? {
    description:  transaction.description,
    amount:       String(transaction.amount),
    date:         transaction.date,
    type:         transaction.type,
    category_id:  transaction.category_id  || '',
    card_id:      transaction.card_id      || '',
    notes:        transaction.notes        || ''
  } : initialForm);

  const [categories, setCategories] = useState([]);
  const [cards, setCards]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [duplicate, setDuplicate]   = useState(null); // existing transaction

  useEffect(() => {
    Promise.all([getCategories(), getCards()]).then(([cats, cds]) => {
      setCategories(cats.data);
      setCards(cds.data);
    });
  }, []);

  const handleSubmit = async (e, force = false) => {
    if (e) e.preventDefault();
    if (!form.description || !form.amount || !form.date) {
      setError('Preencha todos os campos obrigatórios');
      return;
    }
    setError('');

    // Verifica duplicata apenas para novos lançamentos (não edição)
    if (!force && !transaction) {
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
      } catch (_) { /* ignora erros de rede */ }
    }

    setLoading(true);
    try {
      if (transaction) {
        await updateTransaction(transaction.id, form);
      } else {
        await createTransaction(form);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={transaction ? 'Editar Lançamento' : 'Novo Lançamento'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
        )}

        {/* Alerta de duplicata */}
        {duplicate && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Possível duplicata</p>
                <p className="text-xs text-amber-700 mt-0.5 bg-amber-100 rounded px-2 py-1">
                  {duplicate.description} — {formatCurrency(duplicate.amount)} em {formatDate(duplicate.date)}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDuplicate(null)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-medium hover:bg-white"
              >
                <XCircle size={12} /> Cancelar
              </button>
              <button
                type="button"
                onClick={(e) => { setDuplicate(null); handleSubmit(null, true); }}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold"
              >
                <CheckCircle2 size={12} /> Adicionar mesmo assim
              </button>
            </div>
          </div>
        )}

        {/* Tipo */}
        <div className="flex gap-2">
          {['expense', 'income'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setForm(f => ({ ...f, type: t }))}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                form.type === t
                  ? t === 'expense'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
              }`}
            >
              {t === 'expense' ? '💸 Gasto' : '💰 Receita'}
            </button>
          ))}
        </div>

        {/* Descrição */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Descrição *</label>
          <input
            type="text"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Ex: Almoço no restaurante"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Valor e Data */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Valor (R$) *</label>
            <input
              type="number" step="0.01" min="0"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              placeholder="0,00"
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Data *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Categoria */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Categoria</label>
          <select
            value={form.category_id}
            onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
          >
            <option value="">Sem categoria</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Cartão */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Cartão / Conta</label>
          <select
            value={form.card_id}
            onChange={e => setForm(f => ({ ...f, card_id: e.target.value }))}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
          >
            <option value="">Não especificado</option>
            {cards.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Observação */}
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Observação</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Detalhes opcionais..."
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            {loading ? 'Salvando...' : transaction ? 'Salvar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
