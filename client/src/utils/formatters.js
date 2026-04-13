export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  return `${day}/${month}/${year}`;
}

export function formatMonth(monthStr) {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
}

export function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function getMonthOptions(count = 12) {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

export function originLabel(origin) {
  const map = { manual: 'Manual', whatsapp: 'WhatsApp', pdf: 'PDF' };
  return map[origin] || origin;
}

export function originColor(origin) {
  const map = { manual: 'bg-zinc-100 text-zinc-600', whatsapp: 'bg-green-100 text-green-700', pdf: 'bg-blue-100 text-blue-700' };
  return map[origin] || 'bg-zinc-100 text-zinc-600';
}
