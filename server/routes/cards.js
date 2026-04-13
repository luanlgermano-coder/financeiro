const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`SELECT * FROM cards ORDER BY name`).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const result = db.prepare(`INSERT INTO cards (name, color) VALUES (?, ?)`).run(name, color || '#6b7280');
    res.status(201).json(db.prepare(`SELECT * FROM cards WHERE id = ?`).get(result.lastInsertRowid));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { name, color } = req.body;
    db.prepare(`UPDATE cards SET name=?, color=? WHERE id=?`).run(name, color, req.params.id);
    res.json(db.prepare(`SELECT * FROM cards WHERE id = ?`).get(req.params.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM cards WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
