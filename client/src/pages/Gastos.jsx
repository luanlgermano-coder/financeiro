import React, { useState, useEffect, useCallback } from 'react';
import { Pencil, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTransactions, deleteTransaction, getCategories } from '../api';
import { formatCurrency, formatDate, getMonthOptions, originLabel, originColor } from '../utils/formatters';
import TransactionModal from '../components/TransactionModal';

const CategoryBar = ({ name, color, total, max }) => {
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-sm text-zinc-600 truncate flex-shrink-0">{name}</div>
      <div className="flex-1 bg-zinc-100 rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-24 text-sm text-zinc-700 font-medium text-right">{formatCurrency(total)}</div>
    </div>
  );
};

export default function Gastos() {
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState(null);
  const [filterCategory, setFilterCategory] = useState('');
  const months = getMonthOptions(12);
  const [monthIdx, setMonthIdx] = useState(0);
  const currentMonth = months[monthIdx].value;

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getTransactions({ month: currentMonth, type: 'expense', category_id: filterCategory || undefined }),
      getCategories()
    ]).then(([txRes, catRes]) => {
      setTransactions(txRes.data);
      setCategories(catRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [currentMonth, filterCategory]);

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

  // Stats
  const total = transactions.reduce((s, t) => s + t.amount, 0);
  const biggestCat = transactions.reduce((acc, t) => {
    if (!t.category_name) return acc;
    acc[t.category_name] = (acc[t.category_name] || 0) + t.amount;
    return acc;
  }, {});
  const topCat = Object.entries(biggestCat).sort((a, b) => b[1] - a[1])[0];

  // Category breakdown
  const catMap = transactions.reduce((acc, t) => {
    const key = t.category_id || 'outros';
    if (!acc[key]) acc[key] = { name: t.category_name || 'Outros', color: t.category_color || '#6b7280', total: 0 };
    acc[key].total += t.amount;
    return acc;
  }, {});
  const catList = Object.values(catMap).sort((a, b) => b.total - a.total);
  const maxCat = catList.length > 0 ? catList[0].total : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Gastos</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Controle de despesas por categoria</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={() => setMonthIdx(i => Math.min(i + 1, months.length - 1))} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold text-zinc-700 min-w-[140px] text-center capitalize">
            {months[monthIdx].label}
          </span>
          <button onClick={() => setMonthIdx(i => Math.max(i - 1, 0))} disabled={monthIdx === 0} className="p-1 rounded-lg hover:bg-zinc-100 text-zinc-500 disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-red-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total gasto</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{formatCurrency(total)}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-zinc-400">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Transações</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{transactions.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-blue-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Maior categoria</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1 truncate">{topCat ? topCat[0] : '—'}</p>
          {topCat && <p className="text-xs text-zinc-400">{formatCurrency(topCat[1])}</p>}
        </div>
      </div>

      {/* Barras por categoria */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-zinc-900 mb-4">Por Categoria</h3>
        {catList.length === 0
          ? <p className="text-zinc-400 text-sm text-center py-8">Nenhum dado</p>
          : <div className="space-y-3">{catList.map(c => <CategoryBar key={c.name} {...c} max={maxCat} />)}</div>
        }
      </div>

      {/* Lista de transações */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Barra de filtro por categoria */}
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2 flex-wrap">
          <Filter size={14} className="text-zinc-400 flex-shrink-0" />
          <button
            onClick={() => setFilterCategory('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              filterCategory === '' ? 'bg-zinc-900 text-white border-zinc-900' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
            }`}
          >
            Todos
          </button>
          {categories.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(filterCategory === String(c.id) ? '' : String(c.id))}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border flex items-center gap-1.5 ${
                filterCategory === String(c.id) ? 'text-white border-transparent' : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400'
              }`}
              style={filterCategory === String(c.id) ? { backgroundColor: c.color, borderColor: c.color } : {}}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-semibold text-zinc-900">Lançamentos</h3>
          {filterCategory && (
            <button onClick={() => setFilterCategory('')} className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors">
              Limpar filtro ×
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-zinc-400 text-sm text-center py-12">Nenhum gasto registrado neste período</p>
        ) : (
          <div className="divide-y divide-zinc-50">
            {transactions.map(t => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-zinc-50 transition-colors group">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                  style={{ backgroundColor: t.category_color || '#6b7280' }}
                >
                  {(t.category_name || 'O')[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">{t.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-zinc-400">{formatDate(t.date)}</span>
                    {t.category_name && <span className="text-xs text-zinc-400">· {t.category_name}</span>}
                    {t.card_name && <span className="text-xs text-zinc-400">· {t.card_name}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${originColor(t.origin)}`}>{originLabel(t.origin)}</span>
                  </div>
                </div>
                <div className="text-sm font-semibold text-red-500 flex-shrink-0">
                  -{formatCurrency(t.amount)}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditTarget(t)} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editTarget && (
        <TransactionModal
          transaction={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}
    </div>
  );
}
