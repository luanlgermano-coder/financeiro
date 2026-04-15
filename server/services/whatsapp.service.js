/**
 * whatsapp.service.js
 * Centraliza todas as chamadas para a Evolution API.
 * Se EVOLUTION_API_URL não estiver configurada, loga e retorna sem quebrar.
 */
const axios = require('axios');

function isConfigured() {
  return !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE);
}

/**
 * Envia mensagem de texto via Evolution API.
 * @param {string} to   - Número no formato 5519999999999
 * @param {string} text - Texto da mensagem
 */
async function sendMessage(to, text) {
  if (!isConfigured()) {
    console.log(`[WhatsApp] Evolution API não configurada. Mensagem para ${to}:\n${text}`);
    return;
  }
  try {
    await axios.post(
      `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE}`,
      { number: to, textMessage: { text } },
      {
        headers: { apikey: process.env.EVOLUTION_API_KEY },
        timeout: 10000,
      }
    );
  } catch (err) {
    console.error(`[WhatsApp] Erro ao enviar para ${to}:`, err.message);
  }
}

/**
 * Envia a mesma mensagem para Luan e/ou Bárbara.
 * @param {string} text
 * @param {'luan'|'barbara'|'both'} target
 */
async function sendToFamily(text, target = 'both') {
  const promises = [];
  if ((target === 'luan' || target === 'both') && process.env.LUAN_PHONE) {
    promises.push(sendMessage(process.env.LUAN_PHONE, text));
  }
  if ((target === 'barbara' || target === 'both') && process.env.BARBARA_PHONE) {
    promises.push(sendMessage(process.env.BARBARA_PHONE, text));
  }
  await Promise.allSettled(promises);
}

module.exports = { sendMessage, sendToFamily, isConfigured };
