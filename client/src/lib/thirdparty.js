/* Lazy loaders for Google reCAPTCHA v3 and Google Identity Services */
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true; s.defer = true;
      s.onload = resolve; s.onerror = () => { delete loaded[src]; reject(new Error('Could not load script')); };
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}

/** Returns a reCAPTCHA v3 token, or undefined when reCAPTCHA is disabled */
export async function recaptchaToken(settings, action = 'submit') {
  if (settings?.recaptcha_enable !== '1' || !settings.recaptcha_site_key) return undefined;
  const key = settings.recaptcha_site_key;
  try {
    await loadScript(`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`);
    await new Promise((r) => window.grecaptcha.ready(r));
    return await window.grecaptcha.execute(key, { action });
  } catch { return undefined; }
}

export const googleEnabled = (settings) => settings?.google_login_enable === '1' && !!settings.google_client_id;

/** Renders the official "Sign in with Google" button into `el` */
export async function renderGoogleButton(el, settings, onCredential, text = 'signin_with') {
  await loadScript('https://accounts.google.com/gsi/client');
  if (!el || !window.google?.accounts?.id) return;
  window.google.accounts.id.initialize({ client_id: settings.google_client_id, callback: (r) => onCredential(r.credential), ux_mode: 'popup' });
  window.google.accounts.id.renderButton(el, { theme: document.documentElement.classList.contains('dark') ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text, width: Math.min(el.offsetWidth || 360, 400) });
}

export const facebookEnabled = (settings) => settings?.facebook_login_enable === '1' && !!settings.facebook_app_id;

/** Opens the Facebook login window and resolves with a user access token (the server verifies it) */
export async function facebookLogin(settings) {
  await loadScript('https://connect.facebook.net/en_US/sdk.js');
  if (!window.FB) throw new Error('Facebook could not be loaded');
  if (!window.__fbReady) { window.FB.init({ appId: settings.facebook_app_id, cookie: false, xfbml: false, version: 'v21.0' }); window.__fbReady = true; }
  return new Promise((resolve, reject) => {
    window.FB.login((r) => (r?.authResponse?.accessToken ? resolve(r.authResponse.accessToken) : reject(new Error('Facebook sign-in was cancelled'))), { scope: 'public_profile,email' });
  });
}
