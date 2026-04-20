const { query } = require('../db/database-pg');
const { sendMessage } = require('./whatsapp.service');

const fmt = (v) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function getSentAlerts() {
  const month = new Date().toISOString().slice(0, 7);
  const key   = `alerts_sent_${month}`;
  const { rows } = await query(`SELECT value FROM settings WHERE key = ?`, [key]);
  return { key, sent: rows[0] ? JSON.parse(rows[0].value) : [] };
}

async function markAlertSent(key, alertId) {
  const { rows } = await query(`SELECT value FROM settings WHERE key = ?`, [key]);
  const sent = rows[0] ? JSON.parse(rows[0].value) : [];
  if (!sent.includes(alertId)) {
    sent.push(alertId);
    await query(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(sent)]
    );
  }
}

async function checkAndSendAlerts(owner, phone) {
  if (!phone) return;

  const today      = new Date();
  const month      = today.toISOString().slice(0, 7);
  const start      = `${month}-01`;
  const end        = `${month}-31`;
  const ownerLabel = owner === 'luan' ? 'Luan' : 'Bárbara';

  const { key, sent } = await getSentAlerts();

  const { rows: [incomeRow] } = await query(
    `SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='income' AND date BETWEEN ? AND ?`,
    [owner, start, end]
  );
  const income = incomeRow.t;
  if (income <= 0) return;

  const { rows: [expenseRow] } = await query(
    `SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='expense' AND date BETWEEN ? AND ?`,
    [owner, start, end]
  );
  const totalExpense = expenseRow.t;

  // Alert 1: category > 30% of income
  const { rows: categories } = await query(
    `SELECT c.id, c.name, COALESCE(SUM(t.amount),0) as total
     FROM categories c
     LEFT JOIN transactions t ON t.category_id=c.id
       AND t.owner=? AND t.type='expense' AND t.date BETWEEN ? AND ?
     GROUP BY c.id, c.name HAVING COALESCE(SUM(t.amount),0) > 0`,
    [owner, start, end]
  );

  for (const cat of categories) {
    const pct = Math.round((cat.total / income) * 100);
    if (pct >= 30) {
      const alertId = `cat_${cat.id}_${month}_${owner}`;
      if (!sent.includes(alertId)) {
        await sendMessage(phone,
          `⚠️ Atenção ${ownerLabel}! Seus gastos com *${cat.name}* já estão em ${fmt(cat.total)} esse mês — ${pct}% da sua renda.`
        );
        await markAlertSent(key, alertId);
      }
    }
  }

  // Alert 2: total expenses > 70% of income
  const expPct = Math.round((totalExpense / income) * 100);
  if (expPct >= 70) {
    const alertId = `expense70_${month}_${owner}`;
    if (!sent.includes(alertId)) {
      const monthName = today.toLocaleString('pt-BR', { month: 'long' });
      await sendMessage(phone,
        `🚨 Alerta! Você já comprometeu ${expPct}% da sua renda em ${monthName}. Sobram apenas ${fmt(Math.max(0, income - totalExpense))}.`
      );
      await markAlertSent(key, alertId);
    }
  }

  // Alert 3: goal expiring in ≤30 days and < 50% complete
  const { rows: goals } = await query(
    `SELECT * FROM goals WHERE (owner=? OR owner='casal') AND current_amount < target_amount`,
    [owner]
  );

  for (const g of goals) {
    const todayZero = new Date(); todayZero.setHours(0, 0, 0, 0);
    const dl   = new Date(g.deadline + 'T00:00:00');
    const days = Math.ceil((dl - todayZero) / 86400000);
    const pct  = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;

    if (days > 0 && days <= 30 && pct < 50) {
      const alertId = `goal_${g.id}_${month}_${owner}`;
      if (!sent.includes(alertId)) {
        await sendMessage(phone,
          `🎯 Sua meta *${g.title}* vence em ${days} dias e está em ${pct}%. Que tal adicionar um valor essa semana?`
        );
        await markAlertSent(key, alertId);
      }
    }
  }
}

module.exports = { checkAndSendAlerts };
