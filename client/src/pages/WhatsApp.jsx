import React, { useState, useEffect } from 'react';
import { MessageCircle, CheckCircle2, XCircle, RefreshCw, Copy, Check } from 'lucide-react';
import { getWhatsAppLogs, getWhatsAppStats } from '../api';
import { formatCurrency } from '../utils/formatters';

const examples = [
  { text: 'gastei 50 reais no mercado', desc: 'Gasto no supermercado' },
  { text: 'paguei 32,90 no almoço', desc: 'Refeição' },
  { text: 'uber 15 reais', desc: 'Transporte' },
  { text: 'recebi 3000 de salário', desc: 'Receita' },
  { text: 'farmácia 45,50', desc: 'Saúde' },
  { text: 'netflix 55,90', desc: 'Lazer' },
  { text: 'pagamento conta de luz 180', desc: 'Moradia' },
  { text: 'academia 120 reais mês', desc: 'Saúde/Lazer' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-zinc-200 transition-colors text-zinc-400 hover:text-zinc-600">
      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
}

export default function WhatsApp() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ today: 0, thisMonth: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [logsRes, statsRes] = await Promise.all([getWhatsAppLogs(), getWhatsAppStats()]);
      setLogs(logsRes.data);
      setStats(statsRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">WhatsApp</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Lançamentos via mensagem</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 bg-white border border-zinc-200 px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-green-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Lançamentos hoje</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{stats.today}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-zinc-400">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Este mês</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{stats.thisMonth}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-blue-500">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total via WhatsApp</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1">{stats.total}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Como usar */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle size={18} className="text-green-500" />
            <h3 className="font-semibold text-zinc-900">Como Usar</h3>
          </div>
          <p className="text-sm text-zinc-600 mb-4 leading-relaxed">
            Envie mensagens em linguagem natural para o seu número de WhatsApp configurado.
            O sistema usa IA para identificar valor, categoria, data e descrição automaticamente.
          </p>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Exemplos de mensagens aceitas:</p>
            {examples.map((ex, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-50 rounded-xl px-3 py-2.5 group">
                <div className="flex-1">
                  <p className="text-sm font-medium text-zinc-800">"{ex.text}"</p>
                  <p className="text-xs text-zinc-400 mt-0.5">→ {ex.desc}</p>
                </div>
                <CopyButton text={ex.text} />
              </div>
            ))}
          </div>

          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-800 mb-1">Webhook endpoint:</p>
            <code className="text-xs text-amber-700 font-mono break-all">POST /api/webhook/whatsapp</code>
            <p className="text-xs text-amber-600 mt-1">Configure este URL na Evolution API como destino do webhook.</p>
          </div>
        </div>

        {/* Histórico de mensagens */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-zinc-900 mb-4">Histórico de Mensagens</h3>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <MessageCircle size={32} className="text-zinc-300 mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">Nenhuma mensagem recebida ainda</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
              {logs.map(log => (
                <div key={log.id} className="flex items-start gap-2">
                  {/* Bolha estilo chat */}
                  <div className="flex-1">
                    <div className="bg-green-50 border border-green-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[90%]">
                      <p className="text-sm text-zinc-800">{log.text}</p>
                      {log.parsed && (
                        <div className="mt-2 pt-2 border-t border-green-100">
                          <p className="text-xs text-green-700">
                            {log.parsed.type === 'income' ? '💰' : '💸'} {log.parsed.description} — {log.parsed.amount ? formatCurrency(log.parsed.amount) : ''}
                          </p>
                          {log.parsed.category && <p className="text-xs text-green-600">{log.parsed.category}</p>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-1">
                      <span className="text-xs text-zinc-400">{formatTime(log.receivedAt)}</span>
                      {log.status === 'processed' ? (
                        <span className="flex items-center gap-0.5 text-xs text-emerald-600 font-medium">
                          <CheckCircle2 size={11} /> Processado
                        </span>
                      ) : (
                        <span className="flex items-center gap-0.5 text-xs text-red-500 font-medium">
                          <XCircle size={11} /> Erro
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
