const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { makeHash, findDuplicate } = require('../utils/duplicates');

// Avança N meses em uma data string "YYYY-MM-DD", respeitando o último dia do mês
function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const totalMonths = (y * 12 + (m - 1)) + n;
  const newY  = Math.floor(totalMonths / 12);
  const newM  = (totalMonths % 12) + 1;
  const lastDay = new Date(newY, newM, 0).getDate();
  const newD  = Math.min(d, lastDay);
  return `${newY}-${String(newM).padStart(2,'0')}-${String(newD).padStart(2,'0')}`;
}

const SELECT_FULL = `
  SELECT
    t.id, t.description, t.amount, t.date, t.type, t.origin,
    t.notes, t.hash, t.owner, t.created_at,
    t.category_id, t.card_id,
    c.name  as category_name,  c.color as category_color, c.icon as category_icon,
    ca.name as card_name,      ca.color as card_color
  FROM transactions t
  LEFT JOIN categories c  ON t.category_id = c.id
  LEFT JOIN cards      ca ON t.card_id     = ca.id
`;

// GET /api/transactions/check-duplicate
router.get('/check-duplicate', (req, res) => {
  try {
    const { amount, date, description, category_id } = req.query;
    if (!amount || !date || !description) {
      return res.status(400).json({ error: 'amount, date e description são obrigatórios' });
    }
    const match = findDuplicate(db, { amount, date, description, category_id });
    if (!match) return res.json({ isDuplicate: false });
    const full = db.prepare(`${SELECT_FULL} WHERE t.id = ?`).get(match.id);
    res.json({ isDuplicate: true, existing: full });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions?month&category_id&type&origin&owner
router.get('/', (req, res) => {
  try {
    const { month, category_id, type, origin, owner } = req.query;
    let query = SELECT_FULL + ' WHERE 1=1';
    const params = [];

    if (month) {
      const [year, mon] = month.split('-');
      query += ' AND t.date BETWEEN ? AND ?';
      params.push(`${year}-${mon}-01`, `${year}-${mon}-31`);
    }
    if (category_id) { query += ' AND t.category_id = ?'; params.push(category_id); }
    if (type)        { query += ' AND t.type = ?';        params.push(type); }
    if (origin)      { query += ' AND t.origin = ?';      params.push(origin); }
    if (owner)       { query += ' AND t.owner = ?';       params.push(owner); }

    query += ' ORDER BY t.date DESC, t.created_at DESC';
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/installments — cria N parcelas a partir de uma compra parcelada
router.post('/installments', (req, res) => {
  try {
    const { description, total_amount, installments, date, category_id, card_id, owner, notes } = req.body;
    if (!description || !total_amount || !installments || !date) {
      return res.status(400).json({ error: 'Campos obrigatórios: description, total_amount, installments, date' });
    }
    const n = parseInt(installments);
    if (n < 2 || n > 24) return res.status(400).json({ error: 'installments deve ser entre 2 e 24' });

    const total = parseFloat(total_amount);
    // Distribui o valor: parcelas iguais, última recebe o centavo restante
    const unit = parseFloat((total / n).toFixed(2));
    const last = parseFloat((total - unit * (n - 1)).toFixed(2));

    const created = [];
    for (let i = 1; i <= n; i++) {
      const amount      = i === n ? last : unit;
      const installDate = addMonths(date, i - 1);
      const desc        = `${description} (${i}/${n})`;
      const hash        = makeHash(desc, amount, installDate);
      const result = db.prepare(`
        INSERT INTO transactions (description, amount, date, type, category_id, card_id, origin, notes, hash, owner)
        VALUES (?, ?, ?, 'expense', ?, ?, 'manual', ?, ?, ?)
      `).run(desc, amount, installDate, category_id || null, card_id || null, notes || null, hash, owner || null);
      created.push({ id: result.lastInsertRowid, description: desc, amount, date: installDate });
    }

    res.status(201).json({ installments: n, total, unit, last, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions
router.post('/', (req, res) => {
  try {
    const { description, amount, date, type, category_id, card_id, origin, notes, owner } = req.body;
    if (!description || !amount || !date || !type) {
      return res.status(400).json({ error: 'Campos obrigatórios: description, amount, date, type' });
    }
    const hash = makeHash(description, amount, date);
    const result = db.prepare(`
      INSERT INTO transactions (description, amount, date, type, category_id, card_id, origin, notes, hash, owner)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      description, parseFloat(amount), date, type,
      category_id || null, card_id || null,
      origin || 'manual', notes || null, hash, owner || null
    );
    res.status(201).json(db.prepare(`${SELECT_FULL} WHERE t.id = ?`).get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/transactions/:id
router.put('/:id', (req, res) => {
  try {
    const { description, amount, date, type, category_id, card_id, notes, owner } = req.body;
    const hash = makeHash(description, amount, date);
    db.prepare(`
      UPDATE transactions
      SET description=?, amount=?, date=?, type=?, category_id=?, card_id=?, notes=?, hash=?, owner=?
      WHERE id=?
    `).run(
      description, parseFloat(amount), date, type,
      category_id || null, card_id || null,
      notes || null, hash, owner || null,
      req.params.id
    );
    res.json(db.prepare(`${SELECT_FULL} WHERE t.id = ?`).get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/all — apaga todas as transactions, debts e subscriptions
// (reset de dados de teste). Preserva categories e cards.
router.delete('/all', (req, res) => {
  try {
    // Usa exec() para rodar os 3 DELETEs atomicamente sem _persist() intermediário
    db.exec('DELETE FROM transactions; DELETE FROM debts; DELETE FROM subscriptions;');
    db._persist();
    res.json({ ok: true, deleted: { transactions: true, debts: true, subscriptions: true } });
  } catch (err) {
    console.error('reset-data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM transactions WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
