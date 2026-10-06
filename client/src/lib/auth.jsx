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
  return <AuthCtx.Provider value={{ ...state, refresh, setUser }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
export const homeFor = (user) => (!user ? '/login' : user.role === 'user' ? '/user/dashboard' : '/admin/dashboard');
