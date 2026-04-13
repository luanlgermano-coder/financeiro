const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/debts?owner=luan
router.get('/', (req, res) => {
  try {
    const { owner } = req.query;
    let query = `SELECT * FROM debts`;
    const params = [];
    if (owner) { query += ` WHERE owner = ?`; params.push(owner); }
    query += ` ORDER BY created_at DESC`;
    res.json(db.prepare(query).all(...params));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/debts
router.post('/', (req, res) => {
  try {
    const { name, total_amount, monthly_payment, paid_amount, owner } = req.body;
    if (!name || !total_amount || !monthly_payment) {
      return res.status(400).json({ error: 'Nome, valor total e parcela mensal são obrigatórios' });
    }
    const result = db.prepare(`
      INSERT INTO debts (name, total_amount, monthly_payment, paid_amount, owner)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, parseFloat(total_amount), parseFloat(monthly_payment), parseFloat(paid_amount || 0), owner || null);
    res.status(201).json(db.prepare(`SELECT * FROM debts WHERE id = ?`).get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/debts/:id
router.put('/:id', (req, res) => {
  try {
    const { name, total_amount, monthly_payment, paid_amount, owner } = req.body;
    db.prepare(`
      UPDATE debts SET name=?, total_amount=?, monthly_payment=?, paid_amount=?, owner=? WHERE id=?
    `).run(name, parseFloat(total_amount), parseFloat(monthly_payment), parseFloat(paid_amount), owner || null, req.params.id);
    res.json(db.prepare(`SELECT * FROM debts WHERE id = ?`).get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/debts/:id/payment
router.post('/:id/payment', (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valor do pagamento é obrigatório' });
    }
    const debt = db.prepare(`SELECT * FROM debts WHERE id = ?`).get(req.params.id);
    if (!debt) return res.status(404).json({ error: 'Dívida não encontrada' });
    const newPaid = Math.min(debt.total_amount, debt.paid_amount + parseFloat(amount));
    db.prepare(`UPDATE debts SET paid_amount = ? WHERE id = ?`).run(newPaid, req.params.id);
    res.json(db.prepare(`SELECT * FROM debts WHERE id = ?`).get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/debts/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM debts WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
