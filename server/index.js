require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initialize: initDB } = require('./db/database');

// Carrega node-cron apenas se disponível (não quebra se não instalado)
let cron;
try { cron = require('node-cron'); } catch (_) { /* ignorado */ }

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

async function start() {
  // Initialize database FIRST — routes are registered after it resolves
  await initDB();
  console.log('✅ Banco de dados inicializado');

  // Auth (sem proteção — é a própria rota de login)
  app.use('/api/auth', require('./routes/auth'));

  // Protege todas as rotas /api/* a partir daqui
  app.use('/api', require('./middleware/auth'));

  // API Routes (registered after DB is ready)
  app.use('/api/dashboard',     require('./routes/dashboard'));
  app.use('/api/transactions',  require('./routes/transactions'));
  app.use('/api/categories',    require('./routes/categories'));
  app.use('/api/cards',         require('./routes/cards'));
  app.use('/api/subscriptions', require('./routes/subscriptions'));
  app.use('/api/debts',         require('./routes/debts'));
  app.use('/api/webhook',       require('./routes/whatsapp'));
  app.use('/api/upload',        require('./routes/upload'));
  app.use('/api/settings',      require('./routes/settings'));
  app.use('/api/goals',         require('./routes/goals'));
  app.use('/api/reports',       require('./routes/reports'));

  // Serve frontend estático em produção
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(__dirname, '../client/dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📦 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });

  // Cron job: todo dia 1 do mês às 8h — envia relatório mensal
  if (cron) {
    cron.schedule('0 8 1 * *', async () => {
      console.log('[cron] Enviando relatório mensal do mês anterior…');
      try {
        const { buildReport } = require('./routes/reports');
        const { sendToFamily } = require('./services/whatsapp.service');
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        const month = d.toISOString().slice(0, 7);
        const report = buildReport(month);
        await sendToFamily(report, 'both');
        console.log('[cron] Relatório enviado com sucesso.');
      } catch (err) {
        console.error('[cron] Erro ao enviar relatório:', err.message);
      }
    }, { timezone: 'America/Sao_Paulo' });
    console.log('📅 Cron job de relatório mensal agendado (dia 1 às 08h)');
  } else {
    console.warn('⚠️  node-cron não instalado — rode: cd server && npm install');
  }
}

start().catch((err) => {
  console.error('❌ Falha ao iniciar servidor:', err);
  process.exit(1);
});
