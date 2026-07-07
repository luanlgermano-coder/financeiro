import React, { useState, useEffect } from 'react';
import {
  Save, Trash2, AlertTriangle, CheckCircle2, X, CalendarX,
  Plus, CreditCard, Receipt, Pencil, Tag,
  Utensils, Car, Home, HeartPulse, Gamepad2, BookOpen,
  Shirt, ShoppingCart, Fuel, Coffee, Gift, Music, Plane,
  Smartphone, Dumbbell, Dog, Baby, Hammer, Briefcase,
  Tv, Wifi, Zap, Droplets, ShoppingBag, GraduationCap,
  PiggyBank, Bike, Bus, Package,
} from 'lucide-react';
import {
  getSettings, updateSettings, resetData, resetMonth,
  getCards, createCard, updateCard, deleteCard,
  getBills, createBill, updateBill, deleteBill,
  getCategories, createCategory, updateCategory, deleteCategory,
} from '../api';
import Modal from '../components/Modal';
import { formatCurrency } from '../utils/formatters';

// ─── Icon registry ─────────────────────────────────────────────────────────────
const ICON_OPTIONS = [
  { name: 'tag',            label: 'Tag',         Component: Tag },
  { name: 'utensils',       label: 'Garfo',       Component: Utensils },
  { name: 'car',            label: 'Carro',       Component: Car },
  { name: 'home',           label: 'Casa',        Component: Home },
  { name: 'heart-pulse',    label: 'Saúde',       Component: HeartPulse },
  { name: 'gamepad-2',      label: 'Games',       Component: Gamepad2 },
  { name: 'book-open',      label: 'Livro',       Component: BookOpen },
  { name: 'shirt',          label: 'Roupa',       Component: Shirt },
  { name: 'shopping-cart',  label: 'Carrinho',    Component: ShoppingCart },
  { name: 'fuel',           label: 'Combustível', Component: Fuel },
  { name: 'coffee',         label: 'Café',        Component: Coffee },
  { name: 'gift',           label: 'Presente',    Component: Gift },
  { name: 'music',          label: 'Música',      Component: Music },
  { name: 'plane',          label: 'Viagem',      Component: Plane },
  { name: 'smartphone',     label: 'Celular',     Component: Smartphone },
  { name: 'dumbbell',       label: 'Academia',    Component: Dumbbell },
  { name: 'dog',            label: 'Pet',         Component: Dog },
  { name: 'baby',           label: 'Bebê',        Component: Baby },
  { name: 'hammer',         label: 'Ferramenta',  Component: Hammer },
  { name: 'briefcase',      label: 'Trabalho',    Component: Briefcase },
  { name: 'tv',             label: 'TV',          Component: Tv },
  { name: 'wifi',           label: 'Internet',    Component: Wifi },
  { name: 'zap',            label: 'Elétrica',    Component: Zap },
  { name: 'droplets',       label: 'Água',        Component: Droplets },
  { name: 'shopping-bag',   label: 'Compras',     Component: ShoppingBag },
  { name: 'graduation-cap', label: 'Educação',    Component: GraduationCap },
  { name: 'piggy-bank',     label: 'Poupança',    Component: PiggyBank },
  { name: 'bike',           label: 'Bicicleta',   Component: Bike },
  { name: 'bus',            label: 'Ônibus',      Component: Bus },
  { name: 'package',        label: 'Pacote',      Component: Package },
];
const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map(o => [o.name, o.Component]));
function renderIcon(name, size = 16) {
  const Icon = ICON_MAP[name] || Tag;
  return <Icon size={size} />;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const OWNER_OPTS = [
  { value: 'casal',   label: 'Casal' },
  { value: 'luan',    label: 'Luan' },
  { value: 'barbara', label: 'Bárbara' },
];
const OWNER_STYLE = {
  luan:    'bg-blue-100 text-blue-700',
  barbara: 'bg-pink-100 text-pink-700',
  casal:   'bg-violet-100 text-violet-700',
};
const CARD_TYPE_OPTS = [
  { value: 'credito',  label: 'Crédito' },
  { value: 'debito',   label: 'Débito' },
  { value: 'conta',    label: 'Conta Corrente' },
  { value: 'poupanca', label: 'Poupança' },
];
const CARD_TYPE_LABEL = { credito: 'Crédito', debito: 'Débito', conta: 'Conta', poupanca: 'Poupança' };

// ─── ConfirmModal ─────────────────────────────────────────────────────────────
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
          <button onClick={onClose} className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors">
            {loading ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CategoryForm ─────────────────────────────────────────────────────────────
function CategoryForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name:   initial?.name   || '',
    color:  initial?.color  || '#6b7280',
    icon:   initial?.icon   || 'tag',
    budget: initial?.budget != null ? String(initial.budget) : '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Nome</label>
        <input
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          autoFocus
          required
        />
      </div>

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Cor</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={e => set('color', e.target.value)}
              className="w-10 h-9 p-0.5 border border-zinc-300 rounded-lg cursor-pointer"
            />
            <span className="text-xs text-zinc-500 font-mono">{form.color}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Preview</label>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: form.color }}
          >
            {renderIcon(form.icon, 18)}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-2">Ícone</label>
        <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-1 border border-zinc-200 rounded-xl bg-zinc-50">
          {ICON_OPTIONS.map(opt => (
            <button
              type="button"
              key={opt.name}
              onClick={() => set('icon', opt.name)}
              title={opt.label}
              className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
                form.icon === opt.name
                  ? 'bg-white ring-2 ring-violet-500 shadow-sm text-violet-600'
                  : 'text-zinc-500 hover:bg-white hover:text-zinc-700'
              }`}
            >
              <opt.Component size={17} />
              <span className="text-[8px] mt-0.5 leading-tight text-center truncate w-full">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Meta mensal (R$) — opcional</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={form.budget}
          onChange={e => set('budget', e.target.value)}
          placeholder="Ex: 500,00"
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
        />
        <p className="text-xs text-zinc-400 mt-1">Se definida, exibe barra de progresso nos gastos desta categoria.</p>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-violet-500 hover:bg-violet-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

// ─── CardForm ─────────────────────────────────────────────────────────────────
function CardForm({ initial, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    name:              initial?.name              || '',
    color:             initial?.color             || '#6b7280',
    owner:             initial?.owner             || '',
    type:              initial?.type              || '',
    due_day:           initial?.due_day           != null ? String(initial.due_day) : '',
    best_purchase_day: initial?.best_purchase_day != null ? String(initial.best_purchase_day) : '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-zinc-700 mb-1">Nome do cartão / conta</label>
        <input
          type="text"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          required
        />
      </div>

      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Cor</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={e => set('color', e.target.value)}
              className="w-10 h-9 p-0.5 border border-zinc-300 rounded-lg cursor-pointer"
            />
            <span className="text-xs text-zinc-500 font-mono">{form.color}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Preview</label>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-sm"
            style={{ backgroundColor: form.color }}
          >
            <CreditCard size={15} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Responsável</label>
          <select
            value={form.owner}
            onChange={e => set('owner', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— sem dono —</option>
            {OWNER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Tipo</label>
          <select
            value={form.type}
            onChange={e => set('type', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">— tipo —</option>
            {CARD_TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Dia de vencimento</label>
          <input
            type="number"
            min="1"
            max="31"
            placeholder="1 – 31"
            value={form.due_day}
            onChange={e => set('due_day', e.target.value)}
            className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Melhor dia de compra</label>
          <input
            type="number"
            min="1"
            max="31"
            placeholder="1 – 31"
            value={form.best_purchase_day}
            onChange={e => set('best_purchase_day', e.target.value)}
            className="w-full px-3 py-2 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <p className="text-xs text-zinc-400 mt-1">Compras após este dia → próxima fatura</p>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50 transition-colors">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors">
          {saving ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Configuracoes() {
  const [form, setForm]       = useState({ user_name: '', spouse_name: '' });
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');

  const [showAllModal,   setShowAllModal]   = useState(false);
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [loadingAll,   setLoadingAll]   = useState(false);
  const [loadingMonth, setLoadingMonth] = useState(false);

  const [categories,  setCategories]  = useState([]);
  const [catModal,    setCatModal]    = useState(null);
  const [savingCat,   setSavingCat]   = useState(false);
  const [deletingCat, setDeletingCat] = useState(null);

  const [cards,        setCards]        = useState([]);
  const [cardModal,    setCardModal]    = useState(null);
  const [savingCard,   setSavingCard]   = useState(false);
  const [deletingCard, setDeletingCard] = useState(null);

  const [bills,         setBills]         = useState([]);
  const [billForm,      setBillForm]      = useState({ name: '', amount: '', due_day: '', owner: 'casal' });
  const [savingBill,    setSavingBill]    = useState(false);
  const [editBill,      setEditBill]      = useState(null);
  const [savingEditBill, setSavingEditBill] = useState(false);

  const currentMonthLabel = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

  const flash = (msg, isErr = false) => {
    if (isErr) { setError(msg); setSuccess(''); }
    else        { setSuccess(msg); setError(''); }
  };

  useEffect(() => {
    getSettings().then(r => setForm({ user_name: r.data.user_name || '', spouse_name: r.data.spouse_name || '' })).catch(() => {});
    getCards().then(r => setCards(r.data)).catch(() => {});
    getCategories().then(r => setCategories(r.data)).catch(() => {});
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

  // ── Categories ──
  const handleSaveCategory = async (data) => {
    setSavingCat(true);
    try {
      if (catModal.mode === 'new') {
        const res = await createCategory(data);
        setCategories(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name, 'pt')));
        flash('Categoria criada.');
      } else {
        const res = await updateCategory(catModal.cat.id, data);
        setCategories(prev => prev.map(c => c.id === catModal.cat.id ? res.data : c).sort((a, b) => a.name.localeCompare(b.name, 'pt')));
        flash('Categoria atualizada.');
      }
      setCatModal(null);
    } catch (err) { flash(err.response?.data?.error || 'Erro ao salvar categoria.', true); }
    finally { setSavingCat(false); }
  };

  const handleDeleteCategory = async (id) => {
    setDeletingCat(id);
    try {
      await deleteCategory(id);
      setCategories(prev => prev.filter(c => c.id !== id));
      flash('Categoria removida.');
    } catch (err) {
      flash(err.response?.data?.error || 'Erro ao remover categoria.', true);
    } finally { setDeletingCat(null); }
  };

  // ── Cards ──
  const handleSaveCard = async (data) => {
    setSavingCard(true);
    try {
      const payload = {
        name:              data.name,
        color:             data.color,
        owner:             data.owner             || null,
        type:              data.type              || null,
        due_day:           data.due_day           !== '' ? parseInt(data.due_day)           : null,
        best_purchase_day: data.best_purchase_day !== '' ? parseInt(data.best_purchase_day) : null,
      };
      if (cardModal.mode === 'new') {
        const res = await createCard(payload);
        setCards(prev => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name, 'pt')));
        flash('Cartão criado.');
      } else {
        const res = await updateCard(cardModal.card.id, payload);
        setCards(prev => prev.map(c => c.id === cardModal.card.id ? res.data : c).sort((a, b) => a.name.localeCompare(b.name, 'pt')));
        flash('Cartão atualizado.');
      }
      setCardModal(null);
    } catch (err) { flash(err.response?.data?.error || 'Erro ao salvar cartão.', true); }
    finally { setSavingCard(false); }
  };

  const handleDeleteCard = async (id) => {
    setDeletingCard(id);
    try {
      await deleteCard(id);
      setCards(prev => prev.filter(c => c.id !== id));
      flash('Cartão removido.');
    } catch (err) {
      flash(err.response?.data?.error || 'Erro ao remover cartão.', true);
    } finally { setDeletingCard(null); }
  };

  // ── Bills ──
  const setBillField = (k, v) => setBillForm(f => ({ ...f, [k]: v }));

  const handleAddBill = async (e) => {
    e.preventDefault();
    if (!billForm.name || !billForm.amount || !billForm.due_day) return;
    setSavingBill(true);
    try {
      const res = await createBill({ name: billForm.name, amount: parseFloat(billForm.amount), due_day: parseInt(billForm.due_day), owner: billForm.owner });
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

  const handleUpdateBill = async (e) => {
    e.preventDefault();
    if (!editBill.name || !editBill.amount || !editBill.due_day) return;
    setSavingEditBill(true);
    try {
      const res = await updateBill(editBill.id, { name: editBill.name, amount: parseFloat(editBill.amount), due_day: parseInt(editBill.due_day), owner: editBill.owner, active: true });
      setBills(prev => prev.map(b => b.id === editBill.id ? res.data : b).sort((a, b) => a.due_day - b.due_day));
      setEditBill(null);
      flash('Conta atualizada.');
    } catch (err) { flash('Erro ao atualizar conta.', true); }
    finally { setSavingEditBill(false); }
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

      {/* ── Categorias ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag size={18} className="text-violet-500" />
            <h2 className="font-semibold text-zinc-900">Categorias</h2>
            <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{categories.length}</span>
          </div>
          <button
            onClick={() => setCatModal({ mode: 'new' })}
            className="flex items-center gap-1.5 text-xs font-semibold bg-violet-500 hover:bg-violet-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} />
            Nova categoria
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Nenhuma categoria</p>
        ) : (
          <div className="space-y-1.5">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50 hover:bg-zinc-100 transition-colors">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                >
                  {renderIcon(cat.icon, 15)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800">{cat.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-zinc-400 font-mono">{cat.color}</p>
                    {cat.budget != null && (
                      <p className="text-xs text-violet-500 font-medium">Meta: {formatCurrency(cat.budget)}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setCatModal({ mode: 'edit', cat })}
                  className="p-1.5 rounded-lg hover:bg-zinc-200 transition-colors flex-shrink-0"
                  title="Editar"
                >
                  <Pencil size={14} className="text-zinc-400" />
                </button>
                <button
                  onClick={() => handleDeleteCategory(cat.id)}
                  disabled={deletingCat === cat.id}
                  className="p-1.5 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0"
                  title="Excluir"
                >
                  <Trash2 size={14} className={deletingCat === cat.id ? 'text-zinc-300' : 'text-zinc-400 hover:text-red-500'} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Cartões ── */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard size={18} className="text-blue-500" />
            <h2 className="font-semibold text-zinc-900">Cartões</h2>
            <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">{cards.length}</span>
          </div>
          <button
            onClick={() => setCardModal({ mode: 'new' })}
            className="flex items-center gap-1.5 text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={13} />
            Novo cartão
          </button>
        </div>

        {cards.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">Nenhum cartão</p>
        ) : (
          <div className="space-y-1.5">
            {cards.map(card => {
              const ownerLabel = card.owner === 'barbara' ? 'Bárbara'
                : card.owner ? card.owner.charAt(0).toUpperCase() + card.owner.slice(1) : null;
              return (
                <div key={card.id} className="flex items-center gap-3 p-3 rounded-xl border border-zinc-100 bg-zinc-50 hover:bg-zinc-100 transition-colors">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: card.color }}
                  >
                    <CreditCard size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{card.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      {card.type && (
                        <span className="text-xs text-zinc-500 bg-zinc-200 px-1.5 py-0.5 rounded-md font-medium">
                          {CARD_TYPE_LABEL[card.type] || card.type}
                        </span>
                      )}
                      {card.owner && (
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md ${OWNER_STYLE[card.owner] || OWNER_STYLE.casal}`}>
                          {ownerLabel}
                        </span>
                      )}
                      {card.due_day && (
                        <span className="text-xs text-zinc-400">Venc. {card.due_day}</span>
                      )}
                      {card.best_purchase_day && (
                        <span className="text-xs text-violet-500">Melhor até {card.best_purchase_day}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setCardModal({ mode: 'edit', card })}
                    className="p-1.5 rounded-lg hover:bg-zinc-200 transition-colors flex-shrink-0"
                    title="Editar"
                  >
                    <Pencil size={14} className="text-zinc-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    disabled={deletingCard === card.id}
                    className="p-1.5 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0"
                    title="Excluir"
                  >
                    <Trash2 size={14} className={deletingCard === card.id ? 'text-zinc-300' : 'text-zinc-400 hover:text-red-500'} />
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

        <form onSubmit={handleAddBill} className="bg-zinc-50 rounded-xl p-4 space-y-3 border border-zinc-100">
          <p className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">Nova conta</p>
          <input
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            placeholder="Nome da conta (ex: Luz, Celular…)"
            value={billForm.name}
            onChange={e => setBillField('name', e.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Valor (R$)</label>
              <input
                type="number" step="0.01" min="0"
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
                type="number" min="1" max="31"
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
            type="submit" disabled={savingBill}
            className="flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus size={14} />
            {savingBill ? 'Salvando…' : 'Adicionar conta'}
          </button>
        </form>

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
                  <button onClick={() => setEditBill({ ...bill, amount: String(bill.amount), due_day: String(bill.due_day) })} className="p-1.5 rounded-lg hover:bg-zinc-200 transition-colors flex-shrink-0">
                    <Pencil size={14} className="text-zinc-400" />
                  </button>
                  <button onClick={() => handleDeleteBill(bill.id)} className="p-1.5 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0">
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
          <button onClick={() => setShowMonthModal(true)} className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <CalendarX size={15} />
            Limpar dados do mês atual
          </button>
        </div>

        <div className="border border-red-200 rounded-xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-zinc-800">Limpar todos os dados</p>
            <p className="text-xs text-zinc-500 mt-0.5">
              Remove <strong>todos</strong> os lançamentos, dívidas e assinaturas permanentemente. Categorias e cartões são mantidos.
            </p>
          </div>
          <button onClick={() => setShowAllModal(true)} className="flex items-center gap-2 bg-red-700 hover:bg-red-800 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors">
            <Trash2 size={15} />
            Limpar todos os dados
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
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

      {catModal && (
        <Modal title={catModal.mode === 'new' ? 'Nova Categoria' : 'Editar Categoria'} onClose={() => setCatModal(null)}>
          <CategoryForm
            initial={catModal.cat}
            onSave={handleSaveCategory}
            onClose={() => setCatModal(null)}
            saving={savingCat}
          />
        </Modal>
      )}

      {cardModal && (
        <Modal title={cardModal.mode === 'new' ? 'Novo Cartão' : 'Editar Cartão'} onClose={() => setCardModal(null)}>
          <CardForm
            initial={cardModal.card}
            onSave={handleSaveCard}
            onClose={() => setCardModal(null)}
            saving={savingCard}
          />
        </Modal>
      )}

      {editBill && (
        <Modal title="Editar Conta Fixa" onClose={() => setEditBill(null)}>
          <form onSubmit={handleUpdateBill} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Nome da conta</label>
              <input
                type="text"
                value={editBill.name}
                onChange={e => setEditBill(b => ({ ...b, name: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                autoFocus required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Valor (R$)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={editBill.amount}
                  onChange={e => setEditBill(b => ({ ...b, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Dia de vencimento</label>
                <input
                  type="number" min="1" max="31"
                  value={editBill.due_day}
                  onChange={e => setEditBill(b => ({ ...b, due_day: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Responsável</label>
              <select
                value={editBill.owner}
                onChange={e => setEditBill(b => ({ ...b, owner: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {OWNER_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setEditBill(null)} className="flex-1 py-2.5 border border-zinc-300 text-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-50">
                Cancelar
              </button>
              <button type="submit" disabled={savingEditBill} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors">
                {savingEditBill ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
