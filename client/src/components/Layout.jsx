import React, { useState } from 'react';
import Sidebar from './Sidebar';
import TransactionModal from './TransactionModal';
import { Plus } from 'lucide-react';

export default function Layout({ children, onLogout }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex min-h-screen bg-zinc-100">
      <Sidebar onLogout={onLogout} />
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-end gap-3 px-6 py-3 bg-white border-b border-zinc-200 shadow-sm">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <Plus size={16} />
            Lançamento
          </button>
        </header>

        {/* Main content */}
        <main className="flex-1 p-6">
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
