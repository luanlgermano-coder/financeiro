const express = require('express');
const router = express.Router();
const { query } = require('../db/database-pg');

const SELECT_WITH_CARD = `
  SELECT s.*, c.name as card_name, c.color as card_color
  FROM subscriptions s
  LEFT JOIN cards c ON s.card_id = c.id
`;

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    const { rows } = await query(`${SELECT_WITH_CARD} ORDER BY s.name`);
    if (month) {
      const { rows: checks } = await query(
        `SELECT ref_id FROM due_checks WHERE type = 'subscription' AND month = ?`,
        [month]
      );
      const checkedIds = new Set(checks.map(c => Number(c.ref_id)));
      rows.forEach(s => { s.checked = checkedIds.has(s.id); });
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, amount, billing_day, card_id } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'Nome e valor são obrigatórios' });
    const { rows: [ins] } = await query(
      `INSERT INTO subscriptions (name, amount, billing_day, card_id, active) VALUES (?, ?, ?, ?, 1) RETURNING id`,
      [name, parseFloat(amount), billing_day || 1, card_id || null]
    );
    const { rows } = await query(`${SELECT_WITH_CARD} WHERE s.id = ?`, [ins.id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, amount, billing_day, card_id, active } = req.body;
    await query(
      `UPDATE subscriptions SET name=?, amount=?, billing_day=?, card_id=?, active=? WHERE id=?`,
      [name, parseFloat(amount), billing_day, card_id || null,
       active !== undefined ? (active ? 1 : 0) : 1, req.params.id]
    );
    const { rows } = await query(`${SELECT_WITH_CARD} WHERE s.id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM subscriptions WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
