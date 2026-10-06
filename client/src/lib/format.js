export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
export const money = (amount, currency) => `${currency?.currency_icon || '$'}${Number(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fullName = (u) => (u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() : '-');
export const initials = (u) => fullName(u).split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const avatarUrl = (u) => u?.avatar || null;
export const label = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
