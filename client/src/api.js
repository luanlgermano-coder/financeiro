import axios from 'axios';

const TOKEN_KEY = 'fin_token';
export const getToken  = ()        => localStorage.getItem(TOKEN_KEY);
export const saveToken = (t)       => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = ()       => localStorage.removeItem(TOKEN_KEY);

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? ''}/api`,
  timeout: 30000,
});

// Injeta o token em todas as requisições
api.interceptors.request.use(config => {
  const token = getToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// Se o servidor retornar 401, limpa o token (força novo login)
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (password) => api.post('/auth/login', { password });

// Dashboard
export const getDashboard = (month) => api.get(`/dashboard${month ? `?month=${month}` : ''}`);

// Transactions
export const getTransactions = (params) => api.get('/transactions', { params });
export const createTransaction = (data) => api.post('/transactions', data);
export const createInstallments = (data) => api.post('/transactions/installments', data);
export const updateTransaction = (id, data) => api.put(`/transactions/${id}`, data);
export const deleteTransaction = (id) => api.delete(`/transactions/${id}`);
export const checkDuplicate = (params) => api.get('/transactions/check-duplicate', { params });

// Categories
export const getCategories = () => api.get('/categories');
export const createCategory = (data) => api.post('/categories', data);
export const updateCategory = (id, data) => api.put(`/categories/${id}`, data);
export const deleteCategory = (id) => api.delete(`/categories/${id}`);

// Cards
export const getCards = () => api.get('/cards');
export const createCard = (data) => api.post('/cards', data);
export const updateCard = (id, data) => api.put(`/cards/${id}`, data);
export const deleteCard = (id) => api.delete(`/cards/${id}`);

// Subscriptions
export const getSubscriptions = () => api.get('/subscriptions');
export const createSubscription = (data) => api.post('/subscriptions', data);
export const updateSubscription = (id, data) => api.put(`/subscriptions/${id}`, data);
export const deleteSubscription = (id) => api.delete(`/subscriptions/${id}`);

// Debts
export const getDebts = (params) => api.get('/debts', { params });
export const createDebt = (data) => api.post('/debts', data);
export const updateDebt = (id, data) => api.put(`/debts/${id}`, data);
export const deleteDebt = (id) => api.delete(`/debts/${id}`);
export const registerDebtPayment = (id, amount) => api.post(`/debts/${id}/payment`, { amount });

// WhatsApp
export const getWhatsAppLogs = () => api.get('/webhook/whatsapp/logs');
export const getWhatsAppStats = () => api.get('/webhook/whatsapp/stats');

// Upload
export const uploadFatura = (file) => {
  const formData = new FormData();
  formData.append('pdf', file);
  return api.post('/upload/fatura', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  });
};
export const confirmUpload = (transactions, card_id, owner) =>
  api.post('/upload/confirm', { transactions, card_id, owner });

// Settings
export const getSettings = () => api.get('/settings');
export const updateSettings = (data) => api.put('/settings', data);
export const resetData = () => api.delete('/transactions/all');

// Goals
export const getGoals = () => api.get('/goals');
export const createGoal = (data) => api.post('/goals', data);
export const updateGoal = (id, data) => api.put(`/goals/${id}`, data);
export const deleteGoal = (id) => api.delete(`/goals/${id}`);
export const depositGoal = (id, amount) => api.post(`/goals/${id}/deposit`, { amount });

export default api;
