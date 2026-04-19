import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, ChevronLeft, ChevronRight, Plus, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { getTransactions, createTransaction, createInstallments, updateTransaction, deleteTransaction, checkDuplicate, getCategories, getCards } from '../api';
import { formatCurrency, formatDate, getMonthOptions, originLabel, originColor } from '../utils/formatters';
import Modal from '../components/Modal';

const THEME = {
  luan:    { border: 'border-blue-500',  accent: '#3b82f6', text: 'text-blue-600',  bg: 'bg-blue-50'  },
  barbara: { border: 'border-pink-500',  accent: '#ec4899', text: 'text-pink-600',  bg: 'bg-pink-50'  },
};
const LABEL = { luan: 'Luan', barbara: 'Bárbara' };

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = { description: '', amount: '', date: today(), category_id: '', card_id: '', notes: '' };

const CategoryBar = ({ name, color, total, max }) => {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-sm text-zinc-600 truncate flex-shrink-0">{name}</div>
      <div className="flex-1 bg-zinc-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-24 text-sm text-zinc-700 font-medium text-right flex-shrink-0">{formatCurrency(total)}</div>
    </div>
  );
};

function DuplicateAlert({ existing, onForce, onCancel }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Possível duplicata</p>
          <p className="text-xs text-amber-700 mt-0.5 bg-amber-100 rounded px-2 py-1">
            {existing.description} — {formatCurrency(existing.amount)} em {formatDate(existing.date)}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 flex items-center justify-center gap-1 py-1.5 border border-zinc-300 text-zinc-700 rounded-lg text-xs font-medium hover:bg-white">
          <XCircle size={12} /> Cancelar
        </button>
        <button onClick={onForce} className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold">
          <CheckCircle2 size={12} /> Adicionar mesmo assim
        </button>
      </div>
    </div>
  );
}

function GastoForm({ categories, cards, owner, initial, onSaved, onCancel, theme }) {
  const [form, setForm]           = useState(initial || emptyForm);
  const [loading, setLoading]     = useState(false);
  const [duplicate, setDuplicate] = useState(null);
  const [error, setError]         = useState('');
  const [parcelado, setParcelado] = useState(false);
  const [parcelas, setParcelas]   = useState(2);
  const isEdit = !!initial?.id;
  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const valorParcela = parcelado && form.amount && parseFloat(form.amount) > 0
    ? (parseFloat(form.amount) / parcelas).toFixed(2)
    : null;

  const submit = async (force = false) => {
    if (!form.description || !form.amount || !form.date) { setError('Preencha descrição, valor e data.'); return; }
    setError('');

    // Parcelada: cria N transações via endpoint dedicado
    if (parcelado && !isEdit) {
      setLoading(true);
      try {
        await createInstallments({
          description:  form.description,
          total_amount: parseFloat(form.amount),
          installments: parcelas,
          date:         form.date,
          category_id:  form.category_id || undefined,
          card_id:      form.card_id      || undefined,
          owner,
          notes:        form.notes        || undefined,
        });
        setForm(emptyForm);
        setParcelado(false);
        setParcelas(2);
        setDuplicate(null);
        onSaved();
      } catch (err) {
        setError(err.response?.data?.error || 'Erro ao salvar parcelamento');
      } finally { setLoading(false); }
      return;
    }

    if (!force && !isEdit) {
      try {
        const res = await checkDuplicate({ amount: form.amount, date: form.date, description: form.description, category_id: form.category_id || undefined });
        if (res.data.isDuplicate) { setDuplicate(res.data.existing); return; }
      } catch (_) {}
    }
    setLoading(true);
    try {
      const payload = { ...form, type: 'expense', owner };
      if (isEdit) await updateTransaction(initial.id, payload);
      else        await createTransaction(payload);
      setForm(emptyForm);
      setDuplicate(null);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-3">
      {error     && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
      {duplicate && <DuplicateAlert existing={duplicate} onForce={() => { setDuplicate(null); submit(true); }} onCancel={() => setDuplicate(null)} />}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Descrição *</label>
        <input type="text" value={form.description} onChange={set('description')} placeholder="Ex: Almoço, Mercado…" autoFocus={!isEdit}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            {parcelado ? 'Valor total (R$) *' : 'Valor (R$) *'}
          </label>
          <input type="number" step="0.01" min="0" value={form.amount} onChange={set('amount')} placeholder="0,00"
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Data *</label>
          <input type="date" value={form.date} onChange={set('date')}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
      </div>

      {/* Parcelamento — só em criação */}
      {!isEdit && (
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={parcelado} onChange={e => setParcelado(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500" />
            <span className="text-sm font-medium text-zinc-700">Compra parcelada?</span>
          </label>

          {parcelado && (
            <div className="grid grid-cols-2 gap-3 pl-1">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Nº de parcelas</label>
                <select value={parcelas} onChange={e => setParcelas(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {[2,3,4,5,6,7,8,9,10,11,12,15,18,21,24].map(n => (
                    <option key={n} value={n}>{n}x</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Valor por parcela</label>
                <div className="px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-sm font-semibold text-violet-700">
                  {valorParcela ? `R$ ${valorParcela}` : '—'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Categoria</label>
        <select value={form.category_id} onChange={set('category_id')}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">Sem categoria</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Cartão / Conta</label>
        <select value={form.card_id} onChange={set('card_id')}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">Não especificado</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Observação</label>
        <textarea rows={2} value={form.notes} onChange={set('notes')} placeholder="Detalhes opcionais…"
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <div className="flex gap-3 pt-1">
        {onCancel && <button onClick={onCancel} className="flex-1 py-2 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50">Cancelar</button>}
        <button disabled={loading} onClick={() => submit(false)}
          className="flex-1 flex items-center justify-center gap-2 py-2 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors"
          style={{ backgroundColor: theme.accent }}>
          {loading ? 'Salvando…' : isEdit ? 'Salvar' : parcelado ? `Parcelar em ${parcelas}x` : <><Plus size={14} /> Adicionar</>}
        </button>
      </div>
    </div>
  );
}

export default function GastosOwner({ owner: ownerProp = 'luan' }) {
  const [activeOwner, setActiveOwner] = useState(ownerProp);
  const owner = activeOwner;
  const theme  = THEME[owner];
  const label  = LABEL[owner];
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories]     = useState([]);
  const [cards, setCards]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [editTarget, setEditTarget]     = useState(null);
  const months   = getMonthOptions(12);
  const [monthIdx, setMonthIdx] = useState(0);
  const currentMonth = months[monthIdx].value;

  // Sincroniza aba quando a prop mudar (troca de rota /gastos/luan ↔ /gastos/barbara)
  useEffect(() => { setActiveOwner(ownerProp); }, [ownerProp]);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getTransactions({ month: currentMonth, type: 'expense', owner }),
      getCategories(),
      getCards(),
    ]).then(([txRes, catRes, cardRes]) => {
      setTransactions(txRes.data);
      setCategories(catRes.data);
      setCards(cardRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [currentMonth, owner]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id) => {
    if (!window.confirm('Remover este gasto?')) return;
    await deleteTransaction(id);
    load();
  };

  const total   = transactions.reduce((s, t) => s + t.amount, 0);
  const catMap  = transactions.reduce((acc, t) => {
    const key = t.category_id || 'outros';
    if (!acc[key]) acc[key] = { name: t.category_name || 'Outros', color: t.category_color || '#6b7280', total: 0 };
    acc[key].total += t.amount;
    return acc;
  }, {});
  const catList = Object.values(catMap).sort((a, b) => b.total - a.total);
  const maxCat  = catList.length > 0 ? catList[0].total : 1;
  const topCat  = catList[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Gastos</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Despesas e saídas</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={() => setMonthIdx(i => Math.min(i + 1, months.length - 1))} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500"><ChevronLeft size={16} /></button>
          <span className="text-sm font-semibold text-zinc-700 min-w-[140px] text-center capitalize">{months[monthIdx].label}</span>
          <button onClick={() => setMonthIdx(i => Math.max(i - 1, 0))} disabled={monthIdx === 0} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Abas Luan / Bárbara */}
      <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl w-fit">
        {[
          { key: 'luan',    label: 'Luan',    accent: '#3b82f6' },
          { key: 'barbara', label: 'Bárbara', accent: '#ec4899' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveOwner(tab.key)}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeOwner === tab.key
                ? 'bg-white shadow-sm text-zinc-900'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
            style={activeOwner === tab.key ? { color: tab.accent } : {}}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`bg-white rounded-2xl p-5 shadow-sm border-l-4 ${theme.border}`}>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total gasto</p>
          <p className={`text-2xl font-bold mt-1 ${theme.text}`}>{formatCurrency(total)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-zinc-400">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Maior categoria</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1 truncate">{topCat ? topCat.name : '—'}</p>
          {topCat && <p className="text-xs text-zinc-400">{formatCurrency(topCat.total)}</p>}
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-zinc-300">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Transações</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{transactions.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Coluna esquerda: form + category bars */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm sticky top-[69px]">
            <h3 className="font-semibold text-zinc-900 mb-4">Novo Gasto</h3>
            <GastoForm categories={categories} cards={cards} owner={owner} theme={theme}
              onSaved={() => { load(); window.dispatchEvent(new CustomEvent('transaction-saved')); }} />
          </div>
          {catList.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-semibold text-zinc-900 mb-4">Por Categoria</h3>
              <div className="space-y-3">
                {catList.map(c => <CategoryBar key={c.name} {...c} max={maxCat} />)}
              </div>
            </div>
          )}
        </div>

        {/* Coluna direita: tabela */}
        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900">Gastos de {months[monthIdx].label}</h3>
              <span className="text-xs text-zinc-400">{transactions.length} registros</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" /></div>
            ) : transactions.length === 0 ? (
              <p className="text-zinc-400 text-sm text-center py-12">Nenhum gasto neste período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 border-b border-zinc-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Data</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Descrição</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Categoria</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Origem</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                      <th className="px-4 py-3 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {transactions.map((t, i) => (
                      <tr key={t.id} className={`transition-colors group ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/70'} hover:bg-blue-50/40`}>
                        <td className="px-4 py-3 text-zinc-500 whitespace-nowrap text-xs">{formatDate(t.date)}</td>
                        <td className="px-4 py-3">
                          {(() => {
                            const m = t.description.match(/\((\d+)\/(\d+)\)$/);
                            const display = m ? t.description.slice(0, -m[0].length).trim() : t.description;
                            return (
                              <div className="flex items-center gap-1.5 max-w-[180px]">
                                <p className="text-sm font-medium text-zinc-800 truncate">{display}</p>
                                {m && (
                                  <span className="flex-shrink-0 text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-semibold">
                                    {m[1]}/{m[2]}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                          {t.notes    && <p className="text-xs text-zinc-400 truncate max-w-[180px]">{t.notes}</p>}
                          {t.card_name && <p className="text-xs text-zinc-400">{t.card_name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {t.category_name
                            ? <span className="text-xs px-2 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: t.category_color || '#6b7280' }}>{t.category_name}</span>
                            : <span className="text-xs text-zinc-400">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${originColor(t.origin)}`}>{originLabel(t.origin)}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                          <span className={theme.text}>-{formatCurrency(t.amount)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditTarget(t)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600"><Pencil size={13} /></button>
                            <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500"><Trash2 size={13} /></button>
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

      {editTarget && (
        <Modal title="Editar Gasto" onClose={() => setEditTarget(null)}>
          <GastoForm
            categories={categories} cards={cards} owner={owner} theme={theme}
            initial={{ id: editTarget.id, description: editTarget.description, amount: String(editTarget.amount), date: editTarget.date, category_id: editTarget.category_id || '', card_id: editTarget.card_id || '', notes: editTarget.notes || '' }}
            onSaved={() => { setEditTarget(null); load(); }}
            onCancel={() => setEditTarget(null)}
          />
        </Modal>
      )}
    </div>
  );
}
