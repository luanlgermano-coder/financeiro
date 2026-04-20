const express = require('express');
const router = express.Router();
const { query } = require('../db/database-pg');

router.get('/', async (req, res) => {
  try {
    const { owner } = req.query;
    let sql = `SELECT * FROM debts`;
    const params = [];
    if (owner) { sql += ` WHERE owner = ?`; params.push(owner); }
    sql += ` ORDER BY created_at DESC`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, total_amount, monthly_payment, paid_amount, owner } = req.body;
    if (!name || !total_amount || !monthly_payment) {
      return res.status(400).json({ error: 'Nome, valor total e parcela mensal são obrigatórios' });
    }
    const { rows } = await query(
      `INSERT INTO debts (name, total_amount, monthly_payment, paid_amount, owner) VALUES (?, ?, ?, ?, ?) RETURNING *`,
      [name, parseFloat(total_amount), parseFloat(monthly_payment), parseFloat(paid_amount || 0), owner || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, total_amount, monthly_payment, paid_amount, owner } = req.body;
    const { rows } = await query(
      `UPDATE debts SET name=?, total_amount=?, monthly_payment=?, paid_amount=?, owner=? WHERE id=? RETURNING *`,
      [name, parseFloat(total_amount), parseFloat(monthly_payment), parseFloat(paid_amount), owner || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/payments', async (req, res) => {
  try {
    const { rows: [debt] } = await query(`SELECT * FROM debts WHERE id = ?`, [req.params.id]);
    if (!debt) return res.status(404).json({ error: 'Dívida não encontrada' });

    const { rows: payments } = await query(
      `SELECT * FROM debt_payments WHERE debt_id = ? ORDER BY date ASC, created_at ASC`,
      [req.params.id]
    );

    const points = [];
    let balance = debt.total_amount;
    const createdDate = debt.created_at
      ? String(debt.created_at).slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    points.push({ date: createdDate, balance });

    for (const p of payments) {
      balance = Math.max(0, balance - p.amount);
      points.push({ date: p.date, balance });
    }

    res.json({ debt, payments, points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/payment', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valor do pagamento é obrigatório' });
    }
    const { rows: [debt] } = await query(`SELECT * FROM debts WHERE id = ?`, [req.params.id]);
    if (!debt) return res.status(404).json({ error: 'Dívida não encontrada' });

    const paid    = parseFloat(amount);
    const newPaid = Math.min(debt.total_amount, debt.paid_amount + paid);
    const today   = new Date().toISOString().slice(0, 10);

    await query(`UPDATE debts SET paid_amount = ? WHERE id = ?`, [newPaid, req.params.id]);
    await query(`INSERT INTO debt_payments (debt_id, amount, date) VALUES (?, ?, ?)`, [req.params.id, paid, today]);

    const { rows } = await query(`SELECT * FROM debts WHERE id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM debt_payments WHERE debt_id = ?`, [req.params.id]);
    await query(`DELETE FROM debts WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
