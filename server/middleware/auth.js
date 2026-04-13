const { makeToken } = require('../routes/auth');

// Middleware que protege todas as rotas /api/* (exceto /api/auth/login).
// Se DASHBOARD_PASSWORD não estiver configurado, passa sem verificar.
module.exports = function authMiddleware(req, res, next) {
  const configured = process.env.DASHBOARD_PASSWORD;
  if (!configured) return next(); // sem senha → livre

  // O webhook do WhatsApp não usa autenticação de browser
  if (req.path.startsWith('/webhook')) return next();

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token || token !== makeToken(configured)) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  next();
};
