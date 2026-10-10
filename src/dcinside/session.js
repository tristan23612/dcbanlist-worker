const SIGN_ORIGIN = 'https://sign.dcinside.com';

function cookieAttributes(setCookie, requestUrl) {
  const parts = setCookie.split(';');
  const first = parts.shift() || '';
  const separator = first.indexOf('=');
  if (separator <= 0) return null;
  const cookie = {
    name: first.slice(0, separator).trim(),
    value: first.slice(separator + 1).trim(),
    domain: new URL(requestUrl).hostname.toLowerCase(),
    path: '/',
    secure: false,
  };
  for (const part of parts) {
    const [rawName, ...rawValue] = part.trim().split('=');
    const name = rawName.toLowerCase();
    const value = rawValue.join('=').trim();
    if (name === 'domain' && value) cookie.domain = value.replace(/^\./, '').toLowerCase();
    if (name === 'path' && value.startsWith('/')) cookie.path = value;
    if (name === 'secure') cookie.secure = true;
    if (name === 'max-age' && Number(value) <= 0) cookie.deleted = true;
  }
  return cookie;
}

export class DcInsideSession {
  constructor() { this.cookies = new Map(); }

  absorb(response, requestUrl) {
    const values = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : (response.headers.get('set-cookie') || '').split(/,(?=\s*[^;,=\s]+=[^;,]*)/g);
    for (const value of values) {
      const cookie = cookieAttributes(value, requestUrl);
      if (!cookie) continue;
      const key = `${cookie.domain}|${cookie.path}|${cookie.name}`;
      if (cookie.deleted) this.cookies.delete(key);
      else this.cookies.set(key, cookie);
    }
  }

  headerFor(urlValue) {
    const url = new URL(urlValue);
    const host = url.hostname.toLowerCase();
    const pairs = [];
    for (const cookie of this.cookies.values()) {
      const domainMatches = host === cookie.domain || host.endsWith(`.${cookie.domain}`);
      if (!domainMatches || !url.pathname.startsWith(cookie.path) || (cookie.secure && url.protocol !== 'https:')) continue;
      pairs.push(`${cookie.name}=${cookie.value}`);
    }
    return pairs.join('; ');
  }

  async fetch(urlValue, init = {}, maxRedirects = 8) {
    let url = new URL(urlValue);
    let method = init.method || 'GET';
    let body = init.body;
    for (let count = 0; count <= maxRedirects; count++) {
      const headers = new Headers(init.headers || {});
      const cookie = this.headerFor(url.href);
      if (cookie) headers.set('Cookie', cookie);
      const response = await fetch(url.href, { ...init, method, body, headers, redirect: 'manual' });
      this.absorb(response, url.href);
      if (![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.get('Location');
      if (!location) return response;
      if (count === maxRedirects) throw new Error('DCInside 로그인 리다이렉션이 너무 많습니다.');
      await response.body?.cancel();
      url = new URL(location, url);
      if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === 'POST')) {
        method = 'GET';
        body = undefined;
      }
    }
    throw new Error('DCInside 요청 리다이렉션 처리에 실패했습니다.');
  }
}

export async function createAuthenticatedSession(env) {
  if (!env.DC_USER_ID || !env.DC_PASSWORD) throw new Error('DC_USER_ID 또는 DC_PASSWORD secret이 설정되지 않았습니다.');
  const session = new DcInsideSession();
  const redirectUrl = 'https://www.dcinside.com/';
  const loginPageUrl = `${SIGN_ORIGIN}/login?s_url=${encodeURIComponent(redirectUrl)}`;
  const loginPage = await session.fetch(loginPageUrl, {
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!loginPage.ok) throw new Error(`로그인 페이지 요청 실패 (HTTP ${loginPage.status})`);
  const loginHtml = await loginPage.text();
  const tokenMatch = loginHtml.match(/<input\b[^>]*\bname=["']ci_t["'][^>]*\bvalue=["']([^"']*)["']/i)
    || loginHtml.match(/<input\b[^>]*\bvalue=["']([^"']*)["'][^>]*\bname=["']ci_t["']/i);
  const ciToken = tokenMatch?.[1];
  if (!ciToken) throw new Error('로그인 페이지에서 ci_t 값을 찾지 못했습니다. 로그인 양식이 변경되었을 수 있습니다.');

  const form = new URLSearchParams({
    ci_t: ciToken,
    s_url: redirectUrl,
    tieup: '',
    url: '',
    ssl: 'Y',
    user_id: env.DC_USER_ID,
    pw: env.DC_PASSWORD,
  });
  const response = await session.fetch(`${SIGN_ORIGIN}/login/member_check`, {
    method: 'POST',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: SIGN_ORIGIN,
      Referer: loginPageUrl,
      'User-Agent': 'Mozilla/5.0',
    },
    body: form.toString(),
  });
  const responseText = await response.text();
  const hasSessionCookie = [...session.cookies.values()].some(cookie => /sso_token|PHPSESSID|csid/i.test(cookie.name));
  const loginFormStillVisible = /<input\b[^>]*\bname=["'](?:user_id|pw)["']/i.test(responseText);
  if (!response.ok || (!hasSessionCookie && loginFormStillVisible)) {
    throw new Error(`DCInside 로그인에 실패했습니다 (HTTP ${response.status}). 계정 확인 또는 추가 인증이 필요할 수 있습니다.`);
  }
  return session;
}
