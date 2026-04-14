const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/goals
router.get('/', (req, res) => {
  try {
    const goals = db.prepare('SELECT * FROM goals ORDER BY deadline ASC, created_at DESC').all();
    res.json(goals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals
router.post('/', (req, res) => {
  try {
    const { title, target_amount, current_amount = 0, deadline, owner = 'casal', color = '#10b981' } = req.body;
    if (!title || !target_amount || !deadline) {
      return res.status(400).json({ error: 'title, target_amount e deadline são obrigatórios.' });
    }
    const result = db.prepare(
      'INSERT INTO goals (title, target_amount, current_amount, deadline, owner, color) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, Number(target_amount), Number(current_amount), deadline, owner, color);
    db._persist();
    const goal = db.prepare('SELECT * FROM goals WHERE id=?').get(result.lastInsertRowid);
    res.status(201).json(goal);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/goals/:id
router.put('/:id', (req, res) => {
  try {
    const { title, target_amount, current_amount, deadline, owner, color } = req.body;
    const existing = db.prepare('SELECT * FROM goals WHERE id=?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Meta não encontrada.' });
    db.prepare(
      'UPDATE goals SET title=?, target_amount=?, current_amount=?, deadline=?, owner=?, color=? WHERE id=?'
    ).run(
      title ?? existing.title,
      Number(target_amount ?? existing.target_amount),
      Number(current_amount ?? existing.current_amount),
      deadline ?? existing.deadline,
      owner ?? existing.owner,
      color ?? existing.color,
      req.params.id
    );
    db._persist();
    res.json(db.prepare('SELECT * FROM goals WHERE id=?').get(req.params.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM goals WHERE id=?').run(req.params.id);
    db._persist();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/goals/:id/deposit — adiciona valor ao current_amount
router.post('/:id/deposit', (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'amount deve ser um valor positivo.' });
    }
    const goal = db.prepare('SELECT * FROM goals WHERE id=?').get(req.params.id);
    if (!goal) return res.status(404).json({ error: 'Meta não encontrada.' });
    const newAmount = Math.min(goal.current_amount + Number(amount), goal.target_amount);
    db.prepare('UPDATE goals SET current_amount=? WHERE id=?').run(newAmount, req.params.id);
    db._persist();
    res.json({ ...goal, current_amount: newAmount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
