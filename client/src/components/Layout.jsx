import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TransactionModal from './TransactionModal';
import { Plus, Menu } from 'lucide-react';

const ROUTE_LABELS = {
  '/':                   'Visão Geral',
  '/entradas/luan':      'Entradas — Luan',
  '/entradas/barbara':   'Entradas — Bárbara',
  '/gastos/luan':        'Gastos — Luan',
  '/gastos/barbara':     'Gastos — Bárbara',
  '/dividas/luan':       'Dívidas — Luan',
  '/dividas/barbara':    'Dívidas — Bárbara',
  '/assinaturas':        'Assinaturas',
  '/whatsapp':           'WhatsApp',
  '/upload':             'Upload Fatura',
  '/configuracoes':      'Configurações',
};

export default function Layout({ children, onLogout }) {
  const [showModal,    setShowModal]    = useState(false);
  const [sidebarOpen, setSidebarOpen]  = useState(false);
  const location = useLocation();
  const pageTitle = ROUTE_LABELS[location.pathname] ?? 'Financeiro';

  return (
    <div className="flex min-h-screen bg-zinc-100">

      {/* Overlay — mobile only, fecha ao clicar fora */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={onLogout}
      />

      {/* Conteúdo principal — sem margin no mobile, ml-60 no desktop */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen w-0">

        {/* Header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-white border-b border-zinc-200 shadow-sm">

          {/* Hamburguer — só mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors flex-shrink-0"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>

          {/* Nome da página — centro no mobile */}
          <span className="md:hidden flex-1 text-center text-sm font-semibold text-zinc-800 truncate">
            {pageTitle}
          </span>

          {/* Spacer — desktop */}
          <div className="hidden md:flex flex-1" />

          {/* Botão lançamento — ícone no mobile, texto no desktop */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-lg transition-colors shadow-sm
              w-9 h-9 md:w-auto md:h-auto md:px-4 md:py-2 md:text-sm flex-shrink-0"
            aria-label="Novo lançamento"
          >
            <Plus size={16} />
            <span className="hidden md:inline">Lançamento</span>
          </button>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>

      {showModal && (
        <TransactionModal
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            window.dispatchEvent(new CustomEvent('transaction-saved'));
          }}
        />
      )}
    </div>
  );
}
