const express = require('express');
const router = express.Router();
const { query } = require('../db/database-pg');

// GET /api/bills
router.get('/', async (req, res) => {
  try {
    const { owner } = req.query;
    let sql = 'SELECT * FROM bills WHERE active = true';
    const params = [];
    if (owner) {
      sql += ' AND owner = ?';
      params.push(owner);
    }
    sql += ' ORDER BY due_day';
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bills
router.post('/', async (req, res) => {
  try {
    const { name, amount, due_day, owner, category } = req.body;
    const day = parseInt(due_day);
    if (!day || day < 1 || day > 31) return res.status(400).json({ error: 'due_day deve ser entre 1 e 31' });
    const { rows } = await query(
      `INSERT INTO bills (name, amount, due_day, owner, category) VALUES (?, ?, ?, ?, ?) RETURNING *`,
      [name, amount, day, owner || 'casal', category || null]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/bills/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, amount, due_day, owner, category, active } = req.body;
    const day = parseInt(due_day);
    if (!day || day < 1 || day > 31) return res.status(400).json({ error: 'due_day deve ser entre 1 e 31' });
    const { rows } = await query(
      `UPDATE bills SET name=?, amount=?, due_day=?, owner=?, category=?, active=? WHERE id=? RETURNING *`,
      [name, amount, day, owner, category || null, active !== undefined ? Boolean(active) : true, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bills/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM bills WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
