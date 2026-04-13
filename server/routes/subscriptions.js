const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT s.*, c.name as card_name, c.color as card_color
      FROM subscriptions s
      LEFT JOIN cards c ON s.card_id = c.id
      ORDER BY s.name
    `).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, amount, billing_day, card_id } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'Nome e valor são obrigatórios' });
    const result = db.prepare(`
      INSERT INTO subscriptions (name, amount, billing_day, card_id, active)
      VALUES (?, ?, ?, ?, 1)
    `).run(name, parseFloat(amount), billing_day || 1, card_id || null);

    const created = db.prepare(`
      SELECT s.*, c.name as card_name, c.color as card_color
      FROM subscriptions s LEFT JOIN cards c ON s.card_id = c.id
      WHERE s.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, amount, billing_day, card_id, active } = req.body;
    db.prepare(`
      UPDATE subscriptions SET name=?, amount=?, billing_day=?, card_id=?, active=? WHERE id=?
    `).run(name, parseFloat(amount), billing_day, card_id || null, active !== undefined ? (active ? 1 : 0) : 1, req.params.id);

    const updated = db.prepare(`
      SELECT s.*, c.name as card_name, c.color as card_color
      FROM subscriptions s LEFT JOIN cards c ON s.card_id = c.id
      WHERE s.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM subscriptions WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
