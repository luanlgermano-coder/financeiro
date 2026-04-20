const express = require('express');
const router = express.Router();
const { query, withTransaction } = require('../db/database-pg');
const { makeHash, findDuplicate } = require('../utils/duplicates');

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
    t.installment_current, t.installment_total,
    c.name  as category_name,  c.color as category_color, c.icon as category_icon,
    ca.name as card_name,      ca.color as card_color
  FROM transactions t
  LEFT JOIN categories c  ON t.category_id = c.id
  LEFT JOIN cards      ca ON t.card_id     = ca.id
`;

// GET /api/transactions/check-duplicate
router.get('/check-duplicate', async (req, res) => {
  try {
    const { amount, date, description, category_id } = req.query;
    if (!amount || !date || !description) {
      return res.status(400).json({ error: 'amount, date e description são obrigatórios' });
    }
    const match = await findDuplicate({ amount, date, description, category_id });
    if (!match) return res.json({ isDuplicate: false });
    const { rows } = await query(`${SELECT_FULL} WHERE t.id = ?`, [match.id]);
    res.json({ isDuplicate: true, existing: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const { month, category_id, type, origin, owner } = req.query;
    let sql = `${SELECT_FULL} WHERE 1=1`;
    const params = [];

    if (month) {
      const [year, mon] = month.split('-');
      sql += ' AND t.date BETWEEN ? AND ?';
      params.push(`${year}-${mon}-01`, `${year}-${mon}-31`);
    }
    if (category_id) { sql += ' AND t.category_id = ?'; params.push(category_id); }
    if (type)        { sql += ' AND t.type = ?';        params.push(type); }
    if (origin)      { sql += ' AND t.origin = ?';      params.push(origin); }
    if (owner)       { sql += ' AND t.owner = ?';       params.push(owner); }

    sql += ' ORDER BY t.date DESC, t.created_at DESC';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/installments
router.post('/installments', async (req, res) => {
  try {
    const { description, total_amount, installments, date, category_id, card_id, owner, notes } = req.body;
    if (!description || !total_amount || !installments || !date) {
      return res.status(400).json({ error: 'Campos obrigatórios: description, total_amount, installments, date' });
    }
    const n = parseInt(installments);
    if (n < 2 || n > 24) return res.status(400).json({ error: 'installments deve ser entre 2 e 24' });

    const total = parseFloat(total_amount);
    const unit  = parseFloat((total / n).toFixed(2));
    const last  = parseFloat((total - unit * (n - 1)).toFixed(2));

    const created = [];
    for (let i = 1; i <= n; i++) {
      const amount      = i === n ? last : unit;
      const installDate = addMonths(date, i - 1);
      const desc        = `${description} (${i}/${n})`;
      const hash        = makeHash(desc, amount, installDate);
      const { rows } = await query(
        `INSERT INTO transactions (description, amount, date, type, category_id, card_id, origin, notes, hash, owner, installment_current, installment_total)
         VALUES (?, ?, ?, 'expense', ?, ?, 'manual', ?, ?, ?, ?, ?) RETURNING id`,
        [desc, amount, installDate, category_id || null, card_id || null, notes || null, hash, owner || null, i, n]
      );
      created.push({ id: rows[0].id, description: desc, amount, date: installDate });
    }

    res.status(201).json({ installments: n, total, unit, last, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { description, amount, date, type, category_id, card_id, origin, notes, owner } = req.body;
    if (!description || !amount || !date || !type) {
      return res.status(400).json({ error: 'Campos obrigatórios: description, amount, date, type' });
    }
    const hash = makeHash(description, amount, date);
    const { rows: [ins] } = await query(
      `INSERT INTO transactions (description, amount, date, type, category_id, card_id, origin, notes, hash, owner)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [description, parseFloat(amount), date, type,
       category_id || null, card_id || null, origin || 'manual', notes || null, hash, owner || null]
    );
    const { rows } = await query(`${SELECT_FULL} WHERE t.id = ?`, [ins.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const { description, amount, date, type, category_id, card_id, notes, owner } = req.body;
    const hash = makeHash(description, amount, date);
    await query(
      `UPDATE transactions SET description=?, amount=?, date=?, type=?, category_id=?, card_id=?, notes=?, hash=?, owner=? WHERE id=?`,
      [description, parseFloat(amount), date, type,
       category_id || null, card_id || null, notes || null, hash, owner || null, req.params.id]
    );
    const { rows } = await query(`${SELECT_FULL} WHERE t.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/month
router.delete('/month', async (req, res) => {
  try {
    const month = new Date().toISOString().slice(0, 7);
    const { rowCount } = await query(
      `DELETE FROM transactions WHERE date BETWEEN ? AND ?`,
      [`${month}-01`, `${month}-31`]
    );
    res.json({ ok: true, deleted: rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/all
router.delete('/all', async (req, res) => {
  try {
    await withTransaction(async (tq) => {
      await tq(`DELETE FROM transactions`);
      await tq(`DELETE FROM debts`);
      await tq(`DELETE FROM subscriptions`);
    });
    res.json({ ok: true, deleted: { transactions: true, debts: true, subscriptions: true } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM transactions WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
