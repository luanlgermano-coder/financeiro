const express = require('express');
const router = express.Router();
const { query } = require('../db/database-pg');

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM goals ORDER BY deadline ASC, created_at DESC`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, target_amount, current_amount = 0, deadline, owner = 'casal', color = '#10b981' } = req.body;
    if (!title || !target_amount || !deadline) {
      return res.status(400).json({ error: 'title, target_amount e deadline são obrigatórios.' });
    }
    const { rows } = await query(
      `INSERT INTO goals (title, target_amount, current_amount, deadline, owner, color) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [title, Number(target_amount), Number(current_amount), deadline, owner, color]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, target_amount, current_amount, deadline, owner, color } = req.body;
    const { rows: [existing] } = await query(`SELECT * FROM goals WHERE id=?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Meta não encontrada.' });
    const { rows } = await query(
      `UPDATE goals SET title=?, target_amount=?, current_amount=?, deadline=?, owner=?, color=? WHERE id=? RETURNING *`,
      [
        title          ?? existing.title,
        Number(target_amount  ?? existing.target_amount),
        Number(current_amount ?? existing.current_amount),
        deadline       ?? existing.deadline,
        owner          ?? existing.owner,
        color          ?? existing.color,
        req.params.id,
      ]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await query(`DELETE FROM goals WHERE id=?`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/deposit', async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'amount deve ser um valor positivo.' });
    }
    const { rows: [goal] } = await query(`SELECT * FROM goals WHERE id=?`, [req.params.id]);
    if (!goal) return res.status(404).json({ error: 'Meta não encontrada.' });
    const newAmount = Math.min(goal.current_amount + Number(amount), goal.target_amount);
    await query(`UPDATE goals SET current_amount=? WHERE id=?`, [newAmount, req.params.id]);
    res.json({ ...goal, current_amount: newAmount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
