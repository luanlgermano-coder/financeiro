const express = require('express');
const router = express.Router();
const { query } = require('../db/database-pg');

// GET /api/dues?month=YYYY-MM
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);

    const [
      { rows: bills },
      { rows: cardsWithDue },
      { rows: cardSpend },
      { rows: checks },
    ] = await Promise.all([
      query(`SELECT * FROM bills WHERE active = 1 ORDER BY due_day`),
      query(`SELECT * FROM cards WHERE due_day IS NOT NULL ORDER BY due_day`),
      query(
        `SELECT card_id, COALESCE(SUM(amount), 0) as total
         FROM transactions
         WHERE type = 'expense' AND date LIKE ?
         GROUP BY card_id`,
        [month + '%']
      ),
      query(`SELECT type, ref_id FROM due_checks WHERE month = ?`, [month]),
    ]);

    const spendMap = Object.fromEntries(cardSpend.map(r => [r.card_id, r.total]));
    const checkedSet = new Set(checks.map(c => `${c.type}-${c.ref_id}`));

    const items = [
      ...bills.map(b => ({
        type:     'bill',
        id:       b.id,
        name:     b.name,
        amount:   b.amount,
        due_day:  b.due_day,
        owner:    b.owner,
        category: b.category,
        checked:  checkedSet.has(`bill-${b.id}`),
      })),
      ...cardsWithDue.map(c => ({
        type:    'card',
        id:      c.id,
        name:    c.name,
        color:   c.color,
        due_day: c.due_day,
        owner:   c.owner,
        amount:  spendMap[c.id] || 0,
        checked: checkedSet.has(`card-${c.id}`),
      })),
    ].sort((a, b) => a.due_day - b.due_day);

    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dues/check  { type, ref_id, month }
router.post('/check', async (req, res) => {
  try {
    const { type, ref_id, month } = req.body;
    await query(
      `INSERT INTO due_checks (type, ref_id, month) VALUES (?, ?, ?) ON CONFLICT (type, ref_id, month) DO NOTHING`,
      [type, ref_id, month]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/dues/check  { type, ref_id, month }
router.delete('/check', async (req, res) => {
  try {
    const { type, ref_id, month } = req.body;
    await query(
      `DELETE FROM due_checks WHERE type = ? AND ref_id = ? AND month = ?`,
      [type, ref_id, month]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
