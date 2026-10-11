export const COLS = ['갤러리', '닉네임', '식별코드', '게시글 / 댓글', '사유', '기간', '처리날짜', '처리자'];

export const SEC = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Refresh-Snapshot',
};

export const STATUS_KEY = 'refresh-status';
export const SNAPSHOT_KEY = 'snapshot';
export const SNAPSHOT_CACHE_TAG = 'banlist-snapshot';
