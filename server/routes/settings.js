const express = require('express');
const router = express.Router();
const { query } = require('../db/database-pg');

router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`SELECT key, value FROM settings`);
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/', async (req, res) => {
  try {
    const entries = Object.entries(req.body);
    for (const [key, value] of entries) {
      await query(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, String(value)]
      );
    }
    const { rows } = await query(`SELECT key, value FROM settings`);
    res.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
