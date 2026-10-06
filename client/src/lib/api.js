import axios from 'axios';

const api = axios.create({ baseURL: '/api', withCredentials: true, headers: { 'X-Requested-With': 'XMLHttpRequest' } });

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status;
    if (status === 401 && !String(err.config?.url).includes('/auth/')) window.location.href = '/login';
    err.message = err.response?.data?.message || err.message;
    err.errors = err.response?.data?.errors || {};
    return Promise.reject(err);
  },
);

/** Build FormData from a plain object (arrays/objects are JSON-encoded, File values appended as-is). */
export function toFormData(obj) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (v instanceof File || v instanceof Blob) fd.append(k, v);
    else if (typeof v === 'object') fd.append(k, JSON.stringify(v));
    else fd.append(k, v);
  }
  return fd;
}

export default api;
