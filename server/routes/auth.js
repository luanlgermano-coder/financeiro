const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();

// Gera um token determinístico a partir da senha configurada.
// Não armazena estado — qualquer request com a senha correta gera o mesmo token.
function makeToken(password) {
  return crypto.createHmac('sha256', password).update('fin-dashboard').digest('hex');
}

// POST /api/auth/login  { password }
router.post('/login', (req, res) => {
  const { password } = req.body || {};
  const configured  = process.env.DASHBOARD_PASSWORD;

  if (!configured) {
    // Sem senha configurada: acesso livre (modo desenvolvimento sem .env)
    return res.json({ token: 'dev-no-auth' });
  }

  if (!password || password !== configured) {
    return res.status(401).json({ error: 'Senha incorreta.' });
  }

  res.json({ token: makeToken(configured) });
});

module.exports = router;
module.exports.makeToken = makeToken;
