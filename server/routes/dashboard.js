const express = require('express');
const router = express.Router();
const db = require('../db/database');

// GET /api/dashboard?month=2024-01
router.get('/', (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01`;
    const endDate   = `${year}-${mon}-31`;

    const incomeRow   = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income'  AND date BETWEEN ? AND ?`).get(startDate, endDate);
    const expenseRow  = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date BETWEEN ? AND ?`).get(startDate, endDate);
    const debtRow     = db.prepare(`SELECT COALESCE(SUM(total_amount - paid_amount),0) as total FROM debts WHERE total_amount > paid_amount`).get();
    const monthlyDebtRow = db.prepare(`SELECT COALESCE(SUM(monthly_payment),0) as total FROM debts WHERE total_amount > paid_amount`).get();
    const subRow      = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM subscriptions WHERE active=1`).get();

    const income  = incomeRow.total;
    const expense = expenseRow.total;
    const totalCommitted = expense + monthlyDebtRow.total + subRow.total;
    const healthPercent  = income > 0 ? Math.min(100, Math.round((totalCommitted / income) * 100)) : 0;

    // Mês anterior (para insights comparativos)
    const prevDate  = new Date(parseInt(year), parseInt(mon) - 2, 1);
    const prevY     = prevDate.getFullYear();
    const prevM     = String(prevDate.getMonth() + 1).padStart(2, '0');
    const prevStart = `${prevY}-${prevM}-01`;
    const prevEnd   = `${prevY}-${prevM}-31`;
    const prevIncomeRow  = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income'  AND date BETWEEN ? AND ?`).get(prevStart, prevEnd);
    const prevExpenseRow = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date BETWEEN ? AND ?`).get(prevStart, prevEnd);
    const prevCategoryBreakdown = db.prepare(`
      SELECT c.id, c.name, c.color, COALESCE(SUM(t.amount),0) as total
      FROM categories c
      LEFT JOIN transactions t ON t.category_id=c.id AND t.type='expense' AND t.date BETWEEN ? AND ?
      GROUP BY c.id HAVING total > 0 ORDER BY total DESC
    `).all(prevStart, prevEnd);

    // Gastos por categoria
    const categoryBreakdown = db.prepare(`
      SELECT c.id, c.name, c.color, c.icon, COALESCE(SUM(t.amount),0) as total
      FROM categories c
      LEFT JOIN transactions t ON t.category_id=c.id AND t.type='expense' AND t.date BETWEEN ? AND ?
      GROUP BY c.id HAVING total > 0 ORDER BY total DESC
    `).all(startDate, endDate);

    // Últimos 5 lançamentos
    const recentTransactions = db.prepare(`
      SELECT t.id, t.description, t.amount, t.date, t.type, t.origin, t.owner,
        c.name as category_name, c.color as category_color, c.icon as category_icon,
        ca.name as card_name, ca.color as card_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id=c.id
      LEFT JOIN cards ca ON t.card_id=ca.id
      ORDER BY t.date DESC, t.created_at DESC LIMIT 5
    `).all();

    // Evolução dos últimos 6 meses
    const monthlyEvolution = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(parseInt(year), parseInt(mon) - 1 - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const s = `${y}-${m}-01`, e = `${y}-${m}-31`;
      const monthLabel = d.toLocaleString('pt-BR', { month: 'short' });
      const ev = db.prepare(`
        SELECT
          COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) as income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as expense
        FROM transactions WHERE date BETWEEN ? AND ?
      `).get(s, e);
      monthlyEvolution.push({ month: monthLabel, income: ev.income, expense: ev.expense });
    }

    // Resumo individual por owner
    const ownerSummary = {};
    for (const owner of ['luan', 'barbara']) {
      const oIncome      = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='income'  AND date BETWEEN ? AND ?`).get(owner, startDate, endDate);
      const oExpense     = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='expense' AND date BETWEEN ? AND ?`).get(owner, startDate, endDate);
      const oDebt        = db.prepare(`SELECT COALESCE(SUM(total_amount - paid_amount),0) as t FROM debts WHERE owner=? AND total_amount > paid_amount`).get(owner);
      const oPrevIncome  = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='income'  AND date BETWEEN ? AND ?`).get(owner, prevStart, prevEnd);
      const oPrevExpense = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='expense' AND date BETWEEN ? AND ?`).get(owner, prevStart, prevEnd);
      ownerSummary[owner] = {
        income:      oIncome.t,
        expense:     oExpense.t,
        balance:     oIncome.t - oExpense.t,
        prevBalance: oPrevIncome.t - oPrevExpense.t,
        debtTotal:   oDebt.t,
      };
    }

    res.json({
      income, expense,
      debtTotal: debtRow.total,
      monthlyDebt: monthlyDebtRow.total,
      subscriptionTotal: subRow.total,
      surplus: income - totalCommitted,
      healthPercent,
      prevMonthIncome:  prevIncomeRow.total,
      prevMonthExpense: prevExpenseRow.total,
      prevCategoryBreakdown,
      categoryBreakdown, recentTransactions, monthlyEvolution,
      ownerSummary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
