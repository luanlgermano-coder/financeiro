const { query } = require('../db/database-pg');

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeHash(description, amount, date) {
  const desc = normalizeText(description).replace(/\s/g, '');
  const amt  = parseFloat(amount).toFixed(2);
  return `${desc}|${amt}|${date}`;
}

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

async function findDuplicate({ amount, date, description, category_id }) {
  const amt = parseFloat(amount);

  // PostgreSQL: compare TEXT dates cast to date type (±2 days)
  const { rows: candidates } = await query(
    `SELECT id, description, amount, date, type, category_id
     FROM transactions
     WHERE ABS(amount - ?) <= 0.01
       AND date::date BETWEEN (?::date - INTERVAL '2 days') AND (?::date + INTERVAL '2 days')`,
    [amt, date, date]
  );

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
