import React, { useState, useRef, useEffect } from 'react';
import {
  FileUp, Upload, CheckCircle2, AlertCircle, Trash2, FileText, AlertTriangle
} from 'lucide-react';
import { uploadFatura, confirmUpload, getCards, getCategories } from '../api';
import { formatCurrency, formatDate } from '../utils/formatters';

export default function UploadFatura() {
  const [file, setFile]           = useState(null);
  const [dragging, setDragging]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult]       = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [cards, setCards]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCard, setSelectedCard] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('luan');
  const fileInputRef = useRef(null);

  useEffect(() => {
    Promise.all([getCards(), getCategories()]).then(([cs, cats]) => {
      setCards(cs.data);
      setCategories(cats.data);
    });
  }, []);

  const handleFile = (f) => {
    if (!f || f.type !== 'application/pdf') {
      setError('Por favor, selecione um arquivo PDF.');
      return;
    }
    setFile(f);
    setError('');
    setResult(null);
    setTransactions([]);
    setSuccess('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadFatura(file);
      setResult(res.data);
      setTransactions(res.data.transactions || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao processar PDF. Verifique sua GEMINI_API_KEY.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (transactions.length === 0) return;
    setConfirming(true);
    try {
      const toImport = transactions.filter(t => t._include !== false);
      await confirmUpload(toImport, selectedCard || undefined, selectedOwner);
      setSuccess(`${toImport.length} transações importadas com sucesso!`);
      setFile(null);
      setResult(null);
      setTransactions([]);
      window.dispatchEvent(new CustomEvent('transaction-saved'));
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao confirmar importação');
    } finally {
      setConfirming(false);
    }
  };

  const updateTx = (idx, field, value) =>
    setTransactions(txs => txs.map((t, i) => i === idx ? { ...t, [field]: value } : t));

  const toggleTx = (idx) =>
    setTransactions(txs => txs.map((t, i) =>
      i === idx ? { ...t, _include: t._include === false } : t
    ));

  // Forçar inclusão de uma duplicata específica
  const forceIncludeDuplicate = (idx) =>
    setTransactions(txs => txs.map((t, i) =>
      i === idx ? { ...t, isDuplicate: false, duplicateOf: null, _include: true } : t
    ));

  const includedCount  = transactions.filter(t => t._include !== false).length;
  const duplicateCount = transactions.filter(t => t.isDuplicate && t._include !== false).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Upload de Fatura</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Importe transações de PDFs de faturas bancárias com IA</p>
      </div>

      {/* Upload area */}
      {!result && (
        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
          <div
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
              dragging ? 'border-emerald-400 bg-emerald-50' : 'border-zinc-200 hover:border-emerald-300 hover:bg-zinc-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef} type="file" accept="application/pdf"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center">
                <FileUp size={24} className="text-zinc-400" />
              </div>
              {file ? (
                <div>
                  <p className="font-semibold text-zinc-800">{file.name}</p>
                  <p className="text-sm text-zinc-400 mt-0.5">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="font-semibold text-zinc-700">Arraste o PDF aqui ou clique para selecionar</p>
                  <p className="text-sm text-zinc-400 mt-0.5">Faturas de cartão, extratos bancários (PDF, máx. 20MB)</p>
                </div>
              )}
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-3">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <select
                  value={selectedOwner}
                  onChange={e => setSelectedOwner(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="luan">Fatura de: Luan</option>
                  <option value="barbara">Fatura de: Bárbara</option>
                </select>
                <select
                  value={selectedCard}
                  onChange={e => setSelectedCard(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecionar cartão (opcional)</option>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
              >
                {uploading ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Processando...</>
                ) : (
                  <><Upload size={16} />Processar PDF</>
                )}
              </button>
            </div>
          )}

          {uploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 flex-shrink-0" />
              <p className="text-sm text-blue-700">Extraindo texto e analisando transações com IA... Isso pode levar alguns segundos.</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700">{success}</p>
        </div>
      )}

      {/* Alerta geral de duplicatas */}
      {result && duplicateCount > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {duplicateCount} possível{duplicateCount > 1 ? 'is duplicata' : ' duplicata'} detectada{duplicateCount > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              As linhas marcadas com ⚠️ já existem no banco. Desmarque-as ou clique em "Forçar" para incluir mesmo assim.
            </p>
          </div>
        </div>
      )}

      {/* Preview das transações extraídas */}
      {result && transactions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-zinc-900">Transações Extraídas</h3>
              <p className="text-sm text-zinc-500 mt-0.5">
                {transactions.length} encontradas · {includedCount} selecionadas
                {result.reference_month && ` · Ref: ${result.reference_month}`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setResult(null); setFile(null); setTransactions([]); }}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-700 border border-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-50"
              >
                <Trash2 size={14} />
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming || includedCount === 0}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {confirming
                  ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Importando...</>
                  : <><CheckCircle2 size={15} />Confirmar importação ({includedCount})</>
                }
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 border-b border-zinc-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Descrição</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Data</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Categoria</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase">Tipo</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-500 uppercase">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {transactions.map((t, i) => (
                    <React.Fragment key={i}>
                      <tr className={`transition-colors ${
                        t._include === false
                          ? 'opacity-30 bg-zinc-50'
                          : t.isDuplicate
                            ? 'bg-amber-50 hover:bg-amber-100'
                            : 'hover:bg-zinc-50'
                      }`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={t._include !== false}
                            onChange={() => toggleTx(i)}
                            className="w-4 h-4 rounded accent-emerald-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {t.isDuplicate && t._include !== false && (
                              <span title="Possível duplicata" className="text-amber-500 flex-shrink-0">
                                <AlertTriangle size={13} />
                              </span>
                            )}
                            <input
                              type="text"
                              value={t.description}
                              onChange={e => updateTx(i, 'description', e.target.value)}
                              className="w-full bg-transparent border-0 p-0 text-sm text-zinc-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 rounded px-1 -mx-1"
                            />
                          </div>
                          {/* Linha de duplicata com botão "Forçar" */}
                          {t.isDuplicate && t.duplicateOf && t._include !== false && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-amber-700">
                                Já existe: "{t.duplicateOf.description}" ({formatCurrency(t.duplicateOf.amount)} em {formatDate(t.duplicateOf.date)})
                              </span>
                              <button
                                onClick={() => forceIncludeDuplicate(i)}
                                className="text-xs text-amber-700 underline hover:text-amber-900 whitespace-nowrap"
                              >
                                Forçar inclusão
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                          {formatDate(t.date)}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={t.category_id || ''}
                            onChange={e => updateTx(i, 'category_id', e.target.value)}
                            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-zinc-700"
                          >
                            <option value="">Sem categoria</option>
                            {categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={t.type}
                            onChange={e => updateTx(i, 'type', e.target.value)}
                            className="text-xs border border-zinc-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-400 text-zinc-700"
                          >
                            <option value="expense">Gasto</option>
                            <option value="income">Receita</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          <span className={t.type === 'income' ? 'text-emerald-600' : 'text-red-500'}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </span>
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
                <tfoot className="bg-zinc-50 border-t border-zinc-200">
                  <tr>
                    <td colSpan="5" className="px-4 py-3 text-sm font-semibold text-zinc-700">Total selecionado</td>
                    <td className="px-4 py-3 text-right font-bold text-red-500">
                      {formatCurrency(
                        transactions
                          .filter(t => t._include !== false && t.type === 'expense')
                          .reduce((s, t) => s + t.amount, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {result && transactions.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
          <FileText size={32} className="text-zinc-300 mx-auto mb-2" />
          <p className="text-zinc-500 text-sm">Nenhuma transação encontrada no PDF</p>
          <button
            onClick={() => { setResult(null); setFile(null); }}
            className="mt-4 text-sm text-emerald-600 hover:underline"
          >
            Tentar outro arquivo
          </button>
        </div>
      )}
    </div>
  );
}
