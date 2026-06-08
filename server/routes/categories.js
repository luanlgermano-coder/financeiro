const express = require('express');
const router = express.Router();
const { query } = require('../db/database-pg');

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM categories ORDER BY name`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, color, icon, budget } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const { rows } = await query(
      `INSERT INTO categories (name, color, icon, budget) VALUES (?, ?, ?, ?) RETURNING *`,
      [name, color || '#6b7280', icon || 'tag', budget != null && budget !== '' ? parseFloat(budget) : null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { name, color, icon, budget } = req.body;
    const { rows } = await query(
      `UPDATE categories SET name=?, color=?, icon=?, budget=? WHERE id=? RETURNING *`,
      [name, color, icon, budget != null && budget !== '' ? parseFloat(budget) : null, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows: [countRow] } = await query(
      `SELECT COUNT(*) as count FROM transactions WHERE category_id = ?`, [req.params.id]
    );
    const count = parseInt(countRow.count);
    if (count > 0) {
      return res.status(409).json({
        error: `Não é possível excluir: ${count} transação(ões) usam esta categoria.`
      });
    }
    await query(`DELETE FROM categories WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
