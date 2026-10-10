import { createAuthenticatedSession } from './session.js';
import { hasBlockListRows } from './blockListParser.js';

const BASE = 'https://gall.dcinside.com';

export async function createBlockListClient(env) {
  const session = await createAuthenticatedSession(env);
  return {
    async fetchPage(gallery, page) {
      const path = String(gallery.path || 'mgallery').replace(/^\/+|\/+$/g, '');
      const id = encodeURIComponent(String(gallery.id));
      const url = `${BASE}/${path}/management/block?id=${id}&p=${page}`;
      const response = await session.fetch(url, {
        headers: { Accept: 'text/html,application/xhtml+xml', Referer: `${BASE}/${path}/management/block?id=${id}&p=${Math.max(1, page - 1)}`, 'User-Agent': 'Mozilla/5.0' },
      });
      if (!response.ok) throw new Error(`${gallery.id} ${page}페이지 요청 실패 (HTTP ${response.status})`);
      const html = await response.text();
      if (html.length > 2_000_000) throw new Error(`${gallery.id} ${page}페이지 응답이 비정상적으로 큽니다.`);
      if (!hasBlockListRows(html)) {
        if (/sign\.dcinside\.com\/login|name=["']user_id["']/i.test(html)) throw new Error('DCInside 로그인 세션이 유지되지 않았습니다.');
        throw new Error(`${gallery.id} ${page}페이지에서 차단 목록을 찾지 못했습니다.`);
      }
      return html;
    },
  };
}
