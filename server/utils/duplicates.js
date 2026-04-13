/**
 * Utilitários de detecção de duplicatas e geração de hash.
 * Usados por transactions, whatsapp e upload routes.
 */

/** Remove acentos, pontuação e normaliza para minúsculas */
function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Gera hash identificador de uma transação */
function makeHash(description, amount, date) {
  const desc = normalizeText(description).replace(/\s/g, '');
  const amt  = parseFloat(amount).toFixed(2);
  return `${desc}|${amt}|${date}`;
}

/** Similaridade de Jaccard sobre palavras com ≥ 3 caracteres */
function wordSimilarity(a, b) {
  const words = (s) => new Set(s.split(' ').filter(w => w.length >= 3));
  const wa = words(a);
  const wb = words(b);
  if (wa.size === 0 && wb.size === 0) return 1;
  if (wa.size === 0 || wb.size === 0) return 0;
  const intersection = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return intersection / union;
}

/**
 * Procura no banco uma transação provavelmente duplicada.
 * Critérios: mesmo valor (±0,01), data até 2 dias de diferença,
 * e (descrição similar ≥ 40% Jaccard OU mesma categoria).
 *
 * @returns {object|null} Transação existente, ou null se não encontrou.
 */
function findDuplicate(db, { amount, date, description, category_id }) {
  const amt = parseFloat(amount);

  const candidates = db.prepare(`
    SELECT id, description, amount, date, type, category_id
    FROM transactions
    WHERE ABS(amount - ?) <= 0.01
      AND ABS(julianday(date) - julianday(?)) <= 2
  `).all(amt, date);

  if (!candidates.length) return null;

  const normNew = normalizeText(description);

  for (const row of candidates) {
    const normExist = normalizeText(row.description);
    const sim = wordSimilarity(normNew, normExist);
    const catMatch =
      category_id &&
      row.category_id &&
      String(category_id) === String(row.category_id);

    if (sim >= 0.4 || catMatch) return row;
  }

  return null;
}

module.exports = { normalizeText, makeHash, findDuplicate };
