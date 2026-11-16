import { createContext, useContext, useEffect, useState } from 'react';
import api from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, settings: {}, loading: true });
  const refresh = async () => {
    const [me, s] = await Promise.all([api.get('/auth/me'), api.get('/public/settings')]);
    setState({ user: me.data.user, settings: s.data.data, loading: false });
  };
  useEffect(() => { refresh().catch(() => setState((x) => ({ ...x, loading: false }))); }, []);
  const setUser = (user) => setState((x) => ({ ...x, user }));
  // Settings > General > Panel colour: the super admin's brand colour for buttons, links and highlights
  useEffect(() => {
    const c = state.settings?.panel_color; const root = document.documentElement.style;
    if (/^#[0-9a-f]{6}$/i.test(c || '')) { root.setProperty('--primary', c); root.setProperty('--primary-soft', `color-mix(in oklab, ${c} 13%, var(--background))`); } else { root.removeProperty('--primary'); root.removeProperty('--primary-soft'); }
  }, [state.settings?.panel_color]);
  return <AuthCtx.Provider value={{ ...state, refresh, setUser }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
export const homeFor = (user) => (!user ? '/login' : user.role === 'user' ? '/user/dashboard' : '/admin/dashboard');
