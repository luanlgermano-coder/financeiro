const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/', (req, res) => {
  try {
    const rows = db.prepare(`SELECT key, value FROM settings`).all();
    const settings = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', (req, res) => {
  try {
    const updates = req.body;
    const upsert = db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`);
    const updateMany = db.transaction((entries) => {
      for (const [key, value] of entries) {
        upsert.run(key, String(value));
      }
    });
    updateMany(Object.entries(updates));
    const rows = db.prepare(`SELECT key, value FROM settings`).all();
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
