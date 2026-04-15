/**
 * alerts.service.js
 * Verifica e envia alertas automáticos via WhatsApp.
 * Cada alerta é enviado no máximo uma vez por mês (chave armazenada em settings).
 */
const { sendMessage } = require('./whatsapp.service');

const fmt = (v) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Lê o registro de alertas enviados neste mês
function getSentAlerts(db) {
  const month = new Date().toISOString().slice(0, 7);
  const key   = `alerts_sent_${month}`;
  const row   = db.prepare(`SELECT value FROM settings WHERE key=?`).get(key);
  return { key, sent: row ? JSON.parse(row.value) : [] };
}

function markAlertSent(db, key, alertId) {
  const row  = db.prepare(`SELECT value FROM settings WHERE key=?`).get(key);
  const sent = row ? JSON.parse(row.value) : [];
  if (!sent.includes(alertId)) {
    sent.push(alertId);
    db.prepare(`INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(key, JSON.stringify(sent));
    db._persist();
  }
}

/**
 * Verifica e dispara alertas para um owner específico após um novo lançamento.
 * @param {object} db
 * @param {'luan'|'barbara'} owner
 * @param {string} phone  - número do dono
 */
async function checkAndSendAlerts(db, owner, phone) {
  if (!phone) return;

  const today     = new Date();
  const month     = today.toISOString().slice(0, 7);
  const start     = `${month}-01`;
  const end       = `${month}-31`;
  const ownerLabel = owner === 'luan' ? 'Luan' : 'Bárbara';

  const { key, sent } = getSentAlerts(db);

  // Renda do mês para este owner
  const incomeRow = db.prepare(
    `SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='income' AND date BETWEEN ? AND ?`
  ).get(owner, start, end);
  const income = incomeRow.t;
  if (income <= 0) return; // sem renda registrada, sem alerta

  // Gastos totais do mês
  const expenseRow = db.prepare(
    `SELECT COALESCE(SUM(amount),0) as t FROM transactions WHERE owner=? AND type='expense' AND date BETWEEN ? AND ?`
  ).get(owner, start, end);
  const totalExpense = expenseRow.t;

  // ── Alerta 1: categoria > 30% da renda ──────────────────────────────────────
  const categories = db.prepare(`
    SELECT c.id, c.name, COALESCE(SUM(t.amount),0) as total
    FROM categories c
    LEFT JOIN transactions t ON t.category_id=c.id
      AND t.owner=? AND t.type='expense' AND t.date BETWEEN ? AND ?
    GROUP BY c.id HAVING total > 0
  `).all(owner, start, end);

  for (const cat of categories) {
    const pct = Math.round((cat.total / income) * 100);
    if (pct >= 30) {
      const alertId = `cat_${cat.id}_${month}_${owner}`;
      if (!sent.includes(alertId)) {
        const msg =
          `⚠️ Atenção ${ownerLabel}! Seus gastos com *${cat.name}* já estão em ${fmt(cat.total)} esse mês — isso representa ${pct}% da sua renda.`;
        await sendMessage(phone, msg);
        markAlertSent(db, key, alertId);
      }
    }
  }

  // ── Alerta 2: total de gastos > 70% da renda ────────────────────────────────
  const expPct = Math.round((totalExpense / income) * 100);
  if (expPct >= 70) {
    const alertId = `expense70_${month}_${owner}`;
    if (!sent.includes(alertId)) {
      const sobra = income - totalExpense;
      const monthName = today.toLocaleString('pt-BR', { month: 'long' });
      const msg =
        `🚨 Alerta! Você já comprometeu ${expPct}% da sua renda em ${monthName}. Sobram apenas ${fmt(Math.max(0, sobra))}.`;
      await sendMessage(phone, msg);
      markAlertSent(db, key, alertId);
    }
  }

  // ── Alerta 3: meta próxima do prazo e abaixo de 50% ─────────────────────────
  const goals = db.prepare(
    `SELECT * FROM goals WHERE (owner=? OR owner='casal') AND current_amount < target_amount`
  ).all(owner);

  for (const g of goals) {
    const todayZero = new Date(); todayZero.setHours(0, 0, 0, 0);
    const dl   = new Date(g.deadline + 'T00:00:00');
    const days = Math.ceil((dl - todayZero) / 86400000);
    const pct  = g.target_amount > 0 ? Math.round((g.current_amount / g.target_amount) * 100) : 0;

    if (days > 0 && days <= 30 && pct < 50) {
      const alertId = `goal_${g.id}_${month}_${owner}`;
      if (!sent.includes(alertId)) {
        const msg =
          `🎯 Sua meta *${g.title}* vence em ${days} dias e está em ${pct}%. Que tal adicionar um valor essa semana?`;
        await sendMessage(phone, msg);
        markAlertSent(db, key, alertId);
      }
    }
  }
}

module.exports = { checkAndSendAlerts };
