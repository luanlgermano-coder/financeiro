const express = require('express');
const router = express.Router();
const { query } = require('../db/database-pg');

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM cards ORDER BY name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, color, due_day, owner, best_purchase_day, type } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { rows } = await query(
      `INSERT INTO cards (name, color, due_day, owner, best_purchase_day, type) VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [name, color || '#6b7280', due_day || null, owner || null, best_purchase_day || null, type || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, color, due_day, owner, best_purchase_day, type } = req.body;
    const { rows } = await query(
      `UPDATE cards SET name=?, color=?, due_day=?, owner=?, best_purchase_day=?, type=? WHERE id=? RETURNING *`,
      [name, color, due_day || null, owner || null, best_purchase_day || null, type || null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows: [countRow] } = await query(
      `SELECT COUNT(*) as count FROM transactions WHERE card_id = ?`, [req.params.id]
    );
    const count = parseInt(countRow.count);
    if (count > 0) {
      return res.status(409).json({
        error: `Não é possível excluir: ${count} transação(ões) usam este cartão.`
      });
    }
    await query(`DELETE FROM cards WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
