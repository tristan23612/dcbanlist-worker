import { CORS, SEC } from './constants.js';

export function apiResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...SEC, ...CORS },
  });
}

export function hasBearerToken(request, expected) {
  const bearer = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  return Boolean(expected) && bearer === expected;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('Invalid JSON');
  }
}

export function safeError(error) {
  return error instanceof Error ? error.message : String(error);
}
