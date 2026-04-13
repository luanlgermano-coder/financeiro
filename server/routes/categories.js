const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM categories ORDER BY name`).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const result = db.prepare(`INSERT INTO categories (name, color, icon) VALUES (?, ?, ?)`).run(name, color || '#6b7280', icon || 'tag');
    res.status(201).json(db.prepare(`SELECT * FROM categories WHERE id = ?`).get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, color, icon } = req.body;
    db.prepare(`UPDATE categories SET name=?, color=?, icon=? WHERE id=?`).run(name, color, icon, req.params.id);
    res.json(db.prepare(`SELECT * FROM categories WHERE id = ?`).get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM categories WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
