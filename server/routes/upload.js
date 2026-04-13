const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../db/database');
const { makeHash, findDuplicate } = require('../utils/duplicates');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Apenas arquivos PDF são aceitos'), false);
    }
    cb(null, true);
  }
});

// POST /api/upload/fatura
router.post('/fatura', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    if (!process.env.GEMINI_API_KEY) {
      return res.status(400).json({
        error: 'GEMINI_API_KEY não configurada. Obtenha gratuitamente em aistudio.google.com'
      });
    }

    const pdfData = await pdfParse(req.file.buffer);
    const pdfText = pdfData.text;

    if (!pdfText || pdfText.trim().length < 10) {
      return res.status(400).json({
        error: 'Não foi possível extrair texto do PDF. Verifique se o arquivo não é uma imagem escaneada.'
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const categories = db.prepare(`SELECT id, name FROM categories`).all();
    const categoryNames = categories.map(c => c.name).join(', ');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Analise este extrato/fatura de cartão de crédito e extraia TODAS as transações.

Texto do PDF:
${pdfText.slice(0, 30000)}

Data de referência: ${today}
Categorias disponíveis: ${categoryNames}

Retorne SOMENTE um JSON válido no formato:
{
  "transactions": [
    {
      "description": "descrição da transação",
      "amount": 0.00,
      "date": "YYYY-MM-DD",
      "type": "expense",
      "category": "nome da categoria mais adequada",
      "original_text": "texto original da linha"
    }
  ],
  "reference_month": "YYYY-MM",
  "total": 0.00
}

Regras:
- Extraia apenas transações reais (compras, pagamentos)
- Ignore totais, subtotais, saldos anteriores e encargos de juros
- Classifique cada transação na categoria mais adequada da lista
- Se não houver data explícita, use o mês de referência da fatura
- Valores negativos = crédito (type: "income"), positivos = débito (type: "expense")`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Não foi possível processar o PDF. Tente novamente.' });

    const extracted = JSON.parse(jsonMatch[0]);

    // Enriquece com IDs de categoria + flag de duplicata
    const enriched = (extracted.transactions || []).map(t => {
      const cat = categories.find(
        c => c.name.toLowerCase() === (t.category || '').toLowerCase()
      );
      const category_id = cat ? cat.id : null;

      // Verifica duplicata
      const duplicate = findDuplicate(db, {
        amount: t.amount,
        date: t.date,
        description: t.description,
        category_id,
      });

      return {
        ...t,
        category_id,
        category_name: cat ? cat.name : t.category,
        isDuplicate: !!duplicate,
        duplicateOf: duplicate || null,
      };
    });

    res.json({
      transactions: enriched,
      reference_month: extracted.reference_month || today.slice(0, 7),
      total: extracted.total || 0,
      pages: pdfData.numpages
    });
  } catch (err) {
    console.error('Erro no upload:', err);
    const msg =
      err.message?.includes('API key') || err.message?.includes('quota')
        ? 'Erro na API do Gemini. Verifique sua GEMINI_API_KEY.'
        : err.message;
    res.status(500).json({ error: msg });
  }
});

// POST /api/upload/confirm — confirma importação das transações extraídas
router.post('/confirm', (req, res) => {
  try {
    const { transactions, card_id, owner } = req.body;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Nenhuma transação para importar' });
    }

    const insert = db.prepare(`
      INSERT INTO transactions (description, amount, date, type, category_id, card_id, origin, hash, owner)
      VALUES (?, ?, ?, ?, ?, ?, 'pdf', ?, ?)
    `);

    const insertMany = db.transaction((txns) => {
      for (const t of txns) {
        const hash = makeHash(t.description, t.amount, t.date);
        insert.run(
          t.description,
          Math.abs(parseFloat(t.amount)),
          t.date,
          t.type || 'expense',
          t.category_id || null,
          card_id || null,
          hash,
          owner || null
        );
      }
    });

    insertMany(transactions);
    res.json({ success: true, count: transactions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
