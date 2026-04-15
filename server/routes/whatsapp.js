const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { makeHash, findDuplicate } = require('../utils/duplicates');
const { sendMessage } = require('../services/whatsapp.service');
const { checkAndSendAlerts } = require('../services/alerts.service');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const totalMonths = (y * 12 + (m - 1)) + n;
  const newY  = Math.floor(totalMonths / 12);
  const newM  = (totalMonths % 12) + 1;
  const lastDay = new Date(newY, newM, 0).getDate();
  const newD  = Math.min(d, lastDay);
  return `${newY}-${String(newM).padStart(2,'0')}-${String(newD).padStart(2,'0')}`;
}

// Detecta "Nx" (12x, 3x…) e retorna N + texto limpo
function detectInstallments(text) {
  const match = text.match(/\b(\d{1,2})[xX]\b/);
  if (!match) return { installments: 1, textClean: text };
  const n = parseInt(match[1]);
  if (n < 2 || n > 24) return { installments: 1, textClean: text };
  return { installments: n, textClean: text.replace(match[0], ' ').replace(/\s+/g, ' ').trim() };
}

// Detecta cartão pelo nome no texto
function detectCardFromText(text, cards) {
  for (const card of cards) {
    const words = card.name.split(/\s+/).filter(w => w.length >= 4);
    for (const word of words) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(text)) return card;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Parser rápido por regex
// ---------------------------------------------------------------------------
const CATEGORY_KEYWORDS = {
  'Alimentação':  /almo[çc]o|jantar|caf[eé]|lanche|restaurante|pizza|burger|hamburguer|sushi|ifood|rappi|delivery|padaria|a[çc]ougue/i,
  'Supermercado': /mercado|supermercado|hortifruti|feira|atacad[ao]|\bcompras\b/i,
  'Transporte':   /\buber\b|\b99\b|taxi|t[áa]xi|gasolina|combust[ií]vel|\bposto\b|metr[ôo]|[ôo]nibus|passagem|estacionamento|ped[áa]gio/i,
  'Saúde':        /farm[áa]cia|rem[eé]dio|\bmedic|\bconsul|dentista|m[eé]dico|plano.{0,10}sa[úu]de|academia|\bgym\b/i,
  'Moradia':      /aluguel|condom[íi]nio|[áa]gua|\bluz\b|energia|\bg[áa]s\b|internet|telefone|celular/i,
  'Lazer':        /cinema|netflix|spotify|disney|\bprime\b|streaming|\bjogo\b|\bshow\b|barzinho|\bbar\b|balada|viagem|hotel/i,
  'Educação':     /\bcurso\b|faculdade|escola|mensalidade|\blivro\b|material/i,
  'Roupas':       /roupa|cal[çc]a|camisa|sapato|t[êe]nis|vest[íi]do|\bloja\b/i,
};

function guessCategory(text) {
  for (const [cat, regex] of Object.entries(CATEGORY_KEYWORDS)) {
    if (regex.test(text)) return cat;
  }
  return 'Outros';
}

function regexParser(text) {
  // Detecta parcelamento (12x, 3x…) e remove do texto para não confundir o parser de valor
  const { installments, textClean } = detectInstallments(text);

  const isIncome = /\b(recebi|receb[eu]|salário|salario|renda|entrada|pix\s+receb)\b/i.test(text);
  const type = isIncome ? 'income' : 'expense';

  // Usa textClean (sem "Nx") para evitar que "12" de "12x" seja capturado como valor
  const valueMatch = textClean.match(/R?\$?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?|\d+[.,]\d{1,2}|\d+)/i);
  if (!valueMatch) return null;

  let raw = valueMatch[1].replace(/\./g, '').replace(',', '.');
  const amount = parseFloat(raw);
  if (isNaN(amount) || amount <= 0) return null;

  let date = new Date().toISOString().slice(0, 10);
  const today = new Date();
  if (/\bontem\b/i.test(text)) {
    today.setDate(today.getDate() - 1);
    date = today.toISOString().slice(0, 10);
  } else {
    const dmMatch = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (dmMatch) {
      const d = dmMatch[1].padStart(2, '0');
      const m = dmMatch[2].padStart(2, '0');
      const y = dmMatch[3]
        ? (dmMatch[3].length === 2 ? '20' + dmMatch[3] : dmMatch[3])
        : new Date().getFullYear();
      date = `${y}-${m}-${d}`;
    }
  }

  // Limpa descrição a partir do texto sem "Nx" e sem o valor
  let description = textClean
    .replace(/R?\$?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?/gi, '')
    .replace(/\b(gastei|paguei|comprei|recebi|hoje|ontem|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi, '')
    .replace(/\s+/g, ' ').trim();

  if (!description) description = text.trim();
  description = description.charAt(0).toUpperCase() + description.slice(1);

  return { description, amount, date, type, category: guessCategory(text), installments };
}

async function parseWithGemini(text) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY não configurada');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `Analise esta mensagem financeira e extraia as informações em JSON.
Mensagem: "${text}"
Data de hoje: ${today}

Retorne SOMENTE um JSON válido:
{
  "description": "descrição curta",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "type": "expense" ou "income",
  "category": "Alimentação|Transporte|Moradia|Saúde|Lazer|Educação|Roupas|Supermercado|Outros"
}`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Gemini não retornou JSON válido');
  return JSON.parse(jsonMatch[0]);
}

async function parseMessage(text) {
  const fromRegex = regexParser(text);
  if (fromRegex) return { ...fromRegex, _source: 'regex' };
  const fromGemini = await parseWithGemini(text);
  return { ...fromGemini, _source: 'gemini' };
}

// Alias local para manter compatibilidade com o restante do arquivo
const sendWhatsAppReply = (to, message) => sendMessage(to, message);

// ---------------------------------------------------------------------------
// Identifica o owner pelo número do remetente
// ---------------------------------------------------------------------------
function resolveOwner(senderNumber) {
  if (!senderNumber) return null;
  // RemoteJid formato: "5519999999999@s.whatsapp.net" ou só o número
  const phone = senderNumber.replace(/@.*$/, '').replace(/\D/g, '');
  const luanPhone    = (process.env.LUAN_PHONE    || '').replace(/\D/g, '');
  const barbaraPhone = (process.env.BARBARA_PHONE || '').replace(/\D/g, '');

  if (luanPhone    && phone === luanPhone)    return 'luan';
  if (barbaraPhone && phone === barbaraPhone) return 'barbara';
  return null;
}

// ---------------------------------------------------------------------------
// POST /api/webhook/whatsapp
// ---------------------------------------------------------------------------
router.post('/whatsapp', async (req, res) => {
  try {
    const body = req.body;
    const messageData = body?.data?.message || body?.message;
    let messageText =
      messageData?.conversation ||
      messageData?.extendedTextMessage?.text ||
      body?.data?.messageText ||
      body?.text;

    const senderNumber =
      body?.data?.key?.remoteJid ||
      body?.sender ||
      body?.from;

    if (!messageText || !messageText.trim()) {
      return res.json({ status: 'ignored', reason: 'Sem texto na mensagem' });
    }

    // Identifica owner pelo telefone
    const owner = resolveOwner(senderNumber);

    // Número desconhecido → pede identificação e ignora
    if (!owner && (process.env.LUAN_PHONE || process.env.BARBARA_PHONE)) {
      if (senderNumber) {
        await sendWhatsAppReply(
          senderNumber,
          '❓ Número não identificado. Por favor, configure seu número no sistema para usar o registro via WhatsApp.'
        );
      }
      return res.json({ status: 'ignored', reason: 'Número não identificado' });
    }

    // Prefixo CONFIRMAR: bypass de duplicata
    const FORCE_PREFIX = /^CONFIRMAR\s+/i;
    const forceInsert = FORCE_PREFIX.test(messageText.trim());
    if (forceInsert) messageText = messageText.trim().replace(FORCE_PREFIX, '');

    const receivedAt = new Date().toISOString();
    let parsed;
    let status = 'processed';
    let errorMsg = null;

    try {
      parsed = await parseMessage(messageText);

      const categoryRow = db.prepare(`SELECT id FROM categories WHERE name = ? COLLATE NOCASE`).get(parsed.category);
      const categoryId  = categoryRow ? categoryRow.id : null;

      // Detecta cartão pelo texto da mensagem
      const allCards = db.prepare(`SELECT * FROM cards`).all();
      const detectedCard = detectCardFromText(messageText, allCards);
      const cardId = detectedCard ? detectedCard.id : null;

      // -----------------------------------------------------------------------
      // COMPRA PARCELADA: cria N transações com "(i/N)" na descrição
      // -----------------------------------------------------------------------
      if ((parsed.installments || 1) > 1) {
        const n     = parsed.installments;
        const total = Math.abs(parsed.amount);
        const unit  = parseFloat((total / n).toFixed(2));
        const last  = parseFloat((total - unit * (n - 1)).toFixed(2));

        for (let i = 1; i <= n; i++) {
          const amount      = i === n ? last : unit;
          const installDate = addMonths(parsed.date, i - 1);
          const desc        = `${parsed.description} (${i}/${n})`;
          const hash        = makeHash(desc, amount, installDate);
          db.prepare(`
            INSERT INTO transactions (description, amount, date, type, category_id, card_id, origin, hash, owner)
            VALUES (?, ?, ?, 'expense', ?, ?, 'whatsapp', ?, ?)
          `).run(desc, amount, installDate, categoryId, cardId, hash, owner);
        }

        const ownerLabel = owner ? ` · ${owner === 'luan' ? 'Luan' : 'Bárbara'}` : '';
        const cardLabel  = detectedCard ? `\n💳 ${detectedCard.name}` : '';
        const replyMsg =
          `💳 *Compra parcelada registrada!*${ownerLabel}\n` +
          `📝 ${parsed.description}\n` +
          `💵 Total: R$ ${total.toFixed(2)} em ${n}x de R$ ${unit.toFixed(2)}\n` +
          `📅 1ª parcela: ${parsed.date}` +
          `${cardLabel}\n` +
          `🏷️ ${parsed.category || 'Outros'}`;

        if (senderNumber) await sendWhatsAppReply(senderNumber, replyMsg);

      } else {
        // -----------------------------------------------------------------------
        // TRANSAÇÃO SIMPLES
        // -----------------------------------------------------------------------

        // Anti-duplicata
        if (!forceInsert) {
          const duplicate = findDuplicate(db, {
            amount: parsed.amount, date: parsed.date,
            description: parsed.description, category_id: categoryId,
          });

          if (duplicate) {
            status = 'duplicate_pending';
            const ownerLabel = owner ? ` (${owner === 'luan' ? 'Luan' : 'Bárbara'})` : '';
            const dupMsg =
              `⚠️ *Possível duplicata detectada!*${ownerLabel}\n` +
              `Já existe: "${duplicate.description}" — R$ ${duplicate.amount.toFixed(2)} em ${duplicate.date}\n\n` +
              `Para registrar mesmo assim:\n*CONFIRMAR ${messageText}*`;

            if (senderNumber) await sendWhatsAppReply(senderNumber, dupMsg);

            const logsRow = db.prepare(`SELECT value FROM settings WHERE key='whatsapp_logs'`).get();
            const logs = logsRow ? JSON.parse(logsRow.value) : [];
            logs.unshift({
              id: Date.now(), text: messageText, sender: senderNumber || 'desconhecido',
              receivedAt, status: 'duplicate_pending', error: null,
              parsed: { ...parsed, category: parsed.category }, owner, duplicateOf: duplicate,
            });
            db.prepare(`INSERT INTO settings (key,value) VALUES ('whatsapp_logs',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(JSON.stringify(logs.slice(0, 100)));
            return res.json({ status: 'duplicate_pending' });
          }
        }

        // Insere transação simples
        const hash = makeHash(parsed.description, parsed.amount, parsed.date);
        db.prepare(`
          INSERT INTO transactions (description, amount, date, type, category_id, card_id, origin, hash, owner)
          VALUES (?, ?, ?, ?, ?, ?, 'whatsapp', ?, ?)
        `).run(parsed.description, Math.abs(parsed.amount), parsed.date, parsed.type, categoryId, cardId, hash, owner);

        const emoji = parsed.type === 'income' ? '💰' : '💸';
        const typeLabel = parsed.type === 'income' ? 'Receita' : 'Gasto';
        const ownerLabel = owner ? ` · ${owner === 'luan' ? 'Luan' : 'Bárbara'}` : '';
        const replyMsg =
          `${emoji} *${typeLabel} registrado!*${ownerLabel}${forceInsert ? ' ✅' : ''}\n` +
          `📝 ${parsed.description}\n` +
          `💵 R$ ${Math.abs(parsed.amount).toFixed(2)}\n` +
          `📅 ${parsed.date}\n` +
          `🏷️ ${parsed.category || 'Outros'}`;

        if (senderNumber) await sendWhatsAppReply(senderNumber, replyMsg);

        // Verifica e envia alertas automáticos (fire-and-forget, não bloqueia resposta)
        if (owner && parsed.type === 'expense') {
          const ownerPhone = owner === 'luan' ? process.env.LUAN_PHONE : process.env.BARBARA_PHONE;
          checkAndSendAlerts(db, owner, ownerPhone).catch(e =>
            console.error('[alerts] Erro ao verificar alertas:', e.message)
          );
        }
      }

    } catch (err) {
      status = 'error';
      errorMsg = err.message;
      console.error('Erro ao processar mensagem WhatsApp:', err);
      if (senderNumber) {
        await sendWhatsAppReply(senderNumber, '❌ Não entendi a mensagem. Tente: "almoço 35" ou "uber 15,50 ontem"');
      }
    }

    const logsRow = db.prepare(`SELECT value FROM settings WHERE key='whatsapp_logs'`).get();
    const logs = logsRow ? JSON.parse(logsRow.value) : [];
    logs.unshift({
      id: Date.now(), text: messageText, sender: senderNumber || 'desconhecido',
      receivedAt, status, error: errorMsg, parsed: parsed || null, owner,
    });
    db.prepare(`INSERT INTO settings (key,value) VALUES ('whatsapp_logs',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value`).run(JSON.stringify(logs.slice(0, 100)));

    res.json({ status, message: 'Webhook processado' });
  } catch (err) {
    console.error('Erro no webhook WhatsApp:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/webhook/whatsapp/logs
router.get('/whatsapp/logs', (req, res) => {
  try {
    const row = db.prepare(`SELECT value FROM settings WHERE key='whatsapp_logs'`).get();
    res.json(row ? JSON.parse(row.value) : []);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/webhook/whatsapp/stats
router.get('/whatsapp/stats', (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 7) + '-01';
    const todayCount = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE origin='whatsapp' AND date=?`).get(today);
    const monthCount = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE origin='whatsapp' AND date>=?`).get(monthStart);
    const totalCount = db.prepare(`SELECT COUNT(*) as c FROM transactions WHERE origin='whatsapp'`).get();
    res.json({ today: todayCount.c, thisMonth: monthCount.c, total: totalCount.c });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
