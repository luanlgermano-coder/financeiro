const express = require('express');
const router = express.Router();
const { query } = require('../db/database-pg');

// GET /api/dashboard?month=2024-01
router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01`;
    const endDate   = `${year}-${mon}-31`;

    const [
      { rows: [incomeRow]  },
      { rows: [expenseRow] },
      { rows: [debtRow]    },
      { rows: [monthlyDebtRow] },
      { rows: [subRow]     },
    ] = await Promise.all([
      query(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income'  AND date BETWEEN ? AND ?`, [startDate, endDate]),
      query(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date BETWEEN ? AND ?`, [startDate, endDate]),
      query(`SELECT COALESCE(SUM(total_amount - paid_amount),0) as total FROM debts WHERE total_amount > paid_amount`),
      query(`SELECT COALESCE(SUM(monthly_payment),0) as total FROM debts WHERE total_amount > paid_amount`),
      query(`SELECT COALESCE(SUM(amount),0) as total FROM subscriptions WHERE active=1`),
    ]);

    const income  = incomeRow.total;
    const expense = expenseRow.total;
    const totalCommitted = expense + monthlyDebtRow.total + subRow.total;
    const healthPercent  = income > 0 ? Math.min(100, Math.round((totalCommitted / income) * 100)) : 0;

    // Previous month
    const prevDate  = new Date(parseInt(year), parseInt(mon) - 2, 1);
    const prevY     = prevDate.getFullYear();
    const prevM     = String(prevDate.getMonth() + 1).padStart(2, '0');
    const prevStart = `${prevY}-${prevM}-01`;
    const prevEnd   = `${prevY}-${prevM}-31`;

    const [
      { rows: [prevIncomeRow]  },
      { rows: [prevExpenseRow] },
      { rows: prevCategoryBreakdown },
    ] = await Promise.all([
      query(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='income'  AND date BETWEEN ? AND ?`, [prevStart, prevEnd]),
      query(`SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE type='expense' AND date BETWEEN ? AND ?`, [prevStart, prevEnd]),
      query(`
        SELECT c.id, c.name, c.color, COALESCE(SUM(t.amount),0) as total
        FROM categories c
        LEFT JOIN transactions t ON t.category_id=c.id AND t.type='expense' AND t.date BETWEEN ? AND ?
        GROUP BY c.id, c.name, c.color HAVING COALESCE(SUM(t.amount),0) > 0 ORDER BY total DESC
      `, [prevStart, prevEnd]),
    ]);

    // Current month category breakdown
    const { rows: categoryBreakdown } = await query(`
      SELECT c.id, c.name, c.color, c.icon, COALESCE(SUM(t.amount),0) as total
      FROM categories c
      LEFT JOIN transactions t ON t.category_id=c.id AND t.type='expense' AND t.date BETWEEN ? AND ?
      GROUP BY c.id, c.name, c.color, c.icon HAVING COALESCE(SUM(t.amount),0) > 0 ORDER BY total DESC
    `, [startDate, endDate]);

    // Recent transactions
    const { rows: recentTransactions } = await query(`
      SELECT t.id, t.description, t.amount, t.date, t.type, t.origin, t.owner,
        c.name as category_name, c.color as category_color, c.icon as category_icon,
        ca.name as card_name, ca.color as card_color
      FROM transactions t
      LEFT JOIN categories c ON t.category_id=c.id
      LEFT JOIN cards ca ON t.card_id=ca.id
      ORDER BY t.date DESC, t.created_at DESC LIMIT 5
    `);

    // Monthly evolution (last 6 months)
    const monthlyEvolution = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(parseInt(year), parseInt(mon) - 1 - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const s = `${y}-${m}-01`, e = `${y}-${m}-31`;
      const monthLabel = d.toLocaleString('pt-BR', { month: 'short' });
      const { rows: [ev] } = await query(`
        SELECT
          COALESCE(SUM(CASE WHEN type='income'  THEN amount ELSE 0 END),0) as income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END),0) as expense
        FROM transactions WHERE date BETWEEN ? AND ?
      `, [s, e]);
      monthlyEvolution.push({ month: monthLabel, income: ev.income, expense: ev.expense });
    }

    // Owner summary
    const ownerSummary = {};
    for (const owner of ['luan', 'barbara']) {
      const [
        { rows: [oIncome]  },
        { rows: [oExpense] },
        { rows: [oDebt]    },
        { rows: [oPrevIncome]  },
        { rows: [oPrevExpense] },
      ] = await Promise.all([
        query(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='income'  AND date BETWEEN ? AND ?`, [owner, startDate, endDate]),
        query(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='expense' AND date BETWEEN ? AND ?`, [owner, startDate, endDate]),
        query(`SELECT COALESCE(SUM(total_amount - paid_amount),0) as t FROM debts WHERE owner=? AND total_amount > paid_amount`, [owner]),
        query(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='income'  AND date BETWEEN ? AND ?`, [owner, prevStart, prevEnd]),
        query(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='expense' AND date BETWEEN ? AND ?`, [owner, prevStart, prevEnd]),
      ]);
      ownerSummary[owner] = {
        income:      oIncome.t,
        expense:     oExpense.t,
        balance:     oIncome.t - oExpense.t,
        prevBalance: oPrevIncome.t - oPrevExpense.t,
        debtTotal:   oDebt.t,
      };
    }

    // Debt evolution (last 6 months, reconstructed from payment history)
    const currentDebtTotal = debtRow.total;
    const debtEvolution = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(parseInt(year), parseInt(mon) - 1 - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const monthEnd   = `${y}-${m}-31`;
      const monthLabel = d.toLocaleString('pt-BR', { month: 'short' });
      const { rows: [paidAfterRow] } = await query(
        `SELECT COALESCE(SUM(amount),0) as total FROM debt_payments WHERE date > ?`,
        [monthEnd]
      );
      debtEvolution.push({
        month:   monthLabel,
        balance: Math.max(0, currentDebtTotal + paidAfterRow.total),
      });
    }

    // Active installment purchases (uses installment_current/total columns)
    const today = new Date().toISOString().slice(0, 10);
    const { rows: allInstallmentTx } = await query(`
      SELECT t.description, t.amount, t.date, t.card_id,
             t.installment_current, t.installment_total,
             c.name as card_name, c.color as card_color
      FROM transactions t
      LEFT JOIN cards c ON t.card_id = c.id
      WHERE t.type = 'expense'
        AND t.installment_total IS NOT NULL
        AND t.installment_total > 0
      ORDER BY t.description, t.date
    `);

    const installmentMap = {};
    for (const tx of allInstallmentTx) {
      const baseTitle = tx.description.replace(/\s*\(\d+\/\d+\)$/, '').trim();
      const key = `${baseTitle}|||${tx.installment_total}|||${tx.card_id || 0}`;
      if (!installmentMap[key]) {
        installmentMap[key] = {
          title:      baseTitle,
          total:      tx.installment_total,
          amount:     tx.amount,
          card_name:  tx.card_name || null,
          card_color: tx.card_color || null,
          dates: [],
        };
      }
      installmentMap[key].dates.push({ x: tx.installment_current, date: tx.date });
    }

    const installmentSummary = Object.values(installmentMap)
      .map(g => {
        const paidCount      = g.dates.filter(d => d.date <= today).length;
        const remainingCount = g.total - paidCount;
        return {
          title:          g.title,
          current:        paidCount,
          total:          g.total,
          remainingCount,
          monthlyAmount:  g.amount,
          totalRemaining: parseFloat((remainingCount * g.amount).toFixed(2)),
          card_name:      g.card_name,
          card_color:     g.card_color,
        };
      })
      .filter(g => g.remainingCount > 0)
      .sort((a, b) => a.remainingCount - b.remainingCount);

    const totalMonthlyInstallments = parseFloat(
      installmentSummary.reduce((s, g) => s + g.monthlyAmount, 0).toFixed(2)
    );

    // Upcoming goals (top 3, sorted by deadline)
    const { rows: upcomingGoals } = await query(`
      SELECT * FROM goals WHERE current_amount < target_amount ORDER BY deadline ASC LIMIT 3
    `);

    res.json({
      income, expense,
      debtTotal:         debtRow.total,
      monthlyDebt:       monthlyDebtRow.total,
      subscriptionTotal: subRow.total,
      surplus:           income - totalCommitted,
      healthPercent,
      prevMonthIncome:   prevIncomeRow.total,
      prevMonthExpense:  prevExpenseRow.total,
      prevCategoryBreakdown,
      categoryBreakdown,
      recentTransactions,
      monthlyEvolution,
      ownerSummary,
      upcomingGoals,
      debtEvolution,
      installmentSummary,
      totalMonthlyInstallments,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
