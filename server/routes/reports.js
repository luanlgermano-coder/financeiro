/**
 * reports.js
 * GET /api/reports/monthly?month=YYYY-MM
 * Gera relatório financeiro mensal e (opcionalmente) envia via WhatsApp.
 */
const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { sendToFamily } = require('../services/whatsapp.service');

/**
 * Monta o texto do relatório para um determinado mês.
 * @param {string} month  'YYYY-MM'
 * @returns {string}
 */
function buildReport(month) {
  const [year, mon] = month.split('-');
  const start = `${year}-${mon}-01`;
  const end   = `${year}-${mon}-31`;

  const monthName = new Date(parseInt(year), parseInt(mon) - 1, 1)
    .toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
  const monthNameCap = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  // Totais gerais
  const incomeRow  = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE type='income'  AND date BETWEEN ? AND ?`).get(start, end);
  const expenseRow = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE type='expense' AND date BETWEEN ? AND ?`).get(start, end);
  const totalIncome  = incomeRow.t;
  const totalExpense = expenseRow.t;

  // Totais por owner
  const luanIncome  = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner='luan'    AND type='income'  AND date BETWEEN ? AND ?`).get(start, end).t;
  const barbaraIncome = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner='barbara' AND type='income'  AND date BETWEEN ? AND ?`).get(start, end).t;

  // Gastos por categoria (top 8)
  const categories = db.prepare(`
    SELECT c.name, COALESCE(SUM(t.amount),0) as total
    FROM categories c
    LEFT JOIN transactions t ON t.category_id=c.id AND t.type='expense' AND t.date BETWEEN ? AND ?
    GROUP BY c.id HAVING total > 0 ORDER BY total DESC LIMIT 8
  `).all(start, end);

  // Sobra
  const debtMonthlyRow = db.prepare(`SELECT COALESCE(SUM(monthly_payment),0) as t FROM debts WHERE total_amount > paid_amount`).get();
  const subRow         = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM subscriptions WHERE active=1`).get();
  const surplus = totalIncome - totalExpense - debtMonthlyRow.t - subRow.t;

  // Dívidas
  const debtTotalRow   = db.prepare(`SELECT COALESCE(SUM(total_amount - paid_amount),0) as t FROM debts WHERE total_amount > paid_amount`).get();
  const paidThisMonth  = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM debt_payments WHERE date BETWEEN ? AND ?`).get(start, end);

  // Metas ativas
  const goals = db.prepare(`SELECT * FROM goals WHERE current_amount < target_amount ORDER BY deadline ASC`).all();

  // Monta a mensagem
  const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  let msg = `📊 *Relatório de ${monthNameCap} - Família Goulart*\n\n`;

  msg += `💰 *Entradas: ${fmt(totalIncome)}*\n`;
  if (luanIncome > 0)    msg += `   └ Luan: ${fmt(luanIncome)}\n`;
  if (barbaraIncome > 0) msg += `   └ Bárbara: ${fmt(barbaraIncome)}\n`;

  msg += `\n💸 *Gastos: ${fmt(totalExpense)}*\n`;
  for (const cat of categories) {
    msg += `   └ ${cat.name}: ${fmt(cat.total)}\n`;
  }

  const surplusEmoji = surplus >= 0 ? '✅' : '⚠️';
  msg += `\n${surplusEmoji} *Sobra: ${fmt(surplus)}*\n`;

  msg += `\n🏦 *Dívidas: ${fmt(debtTotalRow.t)} no total*\n`;
  if (paidThisMonth.t > 0) msg += `   └ Quitado esse mês: ${fmt(paidThisMonth.t)}\n`;

  if (goals.length > 0) {
    msg += `\n🎯 *Metas:*\n`;
    for (const g of goals) {
      const pct = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;
      msg += `   └ ${g.title}: ${pct}% concluída\n`;
    }
  }

  return msg.trim();
}

// GET /api/reports/monthly?month=YYYY-MM&send=true
router.get('/monthly', async (req, res) => {
  try {
    const month = req.query.month || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.toISOString().slice(0, 7);
    })();

    const report = buildReport(month);

    if (req.query.send === 'true') {
      await sendToFamily(report, 'both');
    }

    res.json({ month, report, sent: req.query.send === 'true' });
  } catch (err) {
    console.error('[reports] Erro ao gerar relatório:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.buildReport = buildReport;
