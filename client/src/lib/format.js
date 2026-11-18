export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
export const money = (amount, currency) => `${currency?.currency_icon || '$'}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fullName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '-');
export const initials = (u) => fullName(u).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const avatarUrl = (u) => u?.avatar || null;
export const label = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
/** 365 -> "1 year", 730 -> "2 years", 90 -> "3 months", 45 -> "45 days" */
export const formatDays = (d) => {
  const n = Number(d || 0);
  if (n > 0 && n % 365 === 0) return `${n / 365} year${n / 365 > 1 ? 's' : ''}`;
  if (n >= 28 && n % 30 === 0) return `${n / 30} month${n / 30 > 1 ? 's' : ''}`;
  return `${n} day${n === 1 ? '' : 's'}`;
};
