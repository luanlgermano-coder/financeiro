import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, CreditCard, Repeat2, Landmark,
  MessageCircle, FileUp, TrendingUp, ChevronDown, ChevronRight,
  User, ArrowDownCircle, ArrowUpCircle, Settings, LogOut
} from 'lucide-react';
import { getSettings } from '../api';

const NavItem = ({ to, icon: Icon, label, accent }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-zinc-700 text-white'
          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
      }`
    }
  >
    {accent
      ? <span className="w-[18px] h-[18px] rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
      : <Icon size={18} />
    }
    <span>{label}</span>
  </NavLink>
);

const Section = ({ label, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-3 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-400 transition-colors"
      >
        {label}
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && <div className="space-y-0.5 mt-1">{children}</div>}
    </div>
  );
};

export default function Sidebar({ onLogout }) {
  const [userName, setUserName] = useState('Usuário');

  useEffect(() => {
    getSettings().then(r => {
      if (r.data.user_name) setUserName(r.data.user_name);
    }).catch(() => {});
  }, []);

  return (
    <aside className="fixed top-0 left-0 h-full w-60 bg-[#18181b] flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <TrendingUp size={18} className="text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">Financeiro</span>
      </div>

      {/* User */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800">
        <div className="w-8 h-8 bg-zinc-700 rounded-full flex items-center justify-center flex-shrink-0">
          <User size={16} className="text-zinc-300" />
        </div>
        <span className="text-zinc-300 text-sm font-medium truncate">{userName}</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        <Section label="Painel">
          <NavItem to="/" icon={LayoutDashboard} label="Visão Geral" />
        </Section>

        <Section label="Entradas">
          <NavItem to="/entradas/luan"    icon={ArrowDownCircle} label="Entradas — Luan"    accent="#3b82f6" />
          <NavItem to="/entradas/barbara" icon={ArrowDownCircle} label="Entradas — Bárbara" accent="#ec4899" />
        </Section>

        <Section label="Gastos">
          <NavItem to="/gastos/luan"    icon={CreditCard} label="Gastos — Luan"    accent="#3b82f6" />
          <NavItem to="/gastos/barbara" icon={CreditCard} label="Gastos — Bárbara" accent="#ec4899" />
        </Section>

        <Section label="Dívidas">
          <NavItem to="/dividas/luan"    icon={Landmark} label="Dívidas — Luan"    accent="#3b82f6" />
          <NavItem to="/dividas/barbara" icon={Landmark} label="Dívidas — Bárbara" accent="#ec4899" />
        </Section>

        <Section label="Outros" defaultOpen={false}>
          <NavItem to="/assinaturas"   icon={Repeat2}       label="Assinaturas" />
          <NavItem to="/whatsapp"      icon={MessageCircle} label="WhatsApp" />
          <NavItem to="/upload"        icon={FileUp}        label="Upload Fatura" />
          <NavItem to="/configuracoes" icon={Settings}      label="Configurações" />
        </Section>
      </nav>

      <div className="px-3 py-3 border-t border-zinc-800 space-y-1">
        {onLogout && (
          <button
            onClick={onLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        )}
        <p className="text-xs text-zinc-600 text-center py-1">v1.0.0 · 2025</p>
      </div>
    </aside>
  );
}
