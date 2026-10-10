import { parse } from 'node-html-parser';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

export function parseBlockListPage(html) {
  const root = parse(html, { lowerCaseTagName: true, comment: false });
  const rows = root.querySelectorAll('tbody tr').filter(row => row.querySelector('.blocknik'));
  if (!rows.length) throw new Error('차단 목록 행을 찾지 못했습니다. 로그인 상태 또는 PC 페이지 구조를 확인하세요.');

  return rows.map(row => {
    const nicknameCell = row.querySelector('.blocknik');
    const paragraphs = nicknameCell.querySelectorAll('p').map(p => clean(p.text));
    const nonempty = paragraphs.filter(Boolean);
    const nickname = nonempty[0] || '';
    const idText = nonempty[1] || '';
    const identifier = idText.replace(/^\(/, '').replace(/\)$/, '').trim() +
      (nicknameCell.querySelector('.txtip') ? ' + IP' : '');

    const contentCell = row.querySelector('.blockcontent');
    const contentType = clean(contentCell?.querySelector('em')?.text);
    const contentTitle = clean(contentCell?.querySelector('a')?.text);
    const content = contentType === '직접 차단'
      ? contentType
      : contentType && contentTitle ? `[${contentType}] ${contentTitle}` : contentTitle || contentType;

    const dateCell = row.querySelector('.blockday');
    const date = clean(dateCell?.querySelector('.block_date')?.text);
    const time = clean(dateCell?.querySelector('.block_time')?.text).replace(/^처리\s*시간\s*:\s*/, '');
    const manager = clean(dateCell?.querySelector('.block_conduct')?.text).replace(/^처리자\s*:\s*/, '');

    return {
      nickname,
      identifier,
      content,
      reason: clean(row.querySelector('.blockreason')?.text),
      duration: clean(row.querySelector('.blocktime')?.text),
      dateTime: [date, time].filter(Boolean).join(' '),
      manager,
    };
  });
}

export function isSameEntry(left, right) {
  return ['nickname', 'identifier', 'content', 'reason', 'duration', 'dateTime', 'manager']
    .every(key => String(left?.[key] ?? '') === String(right?.[key] ?? ''));
}

export function hasBlockListRows(html) {
  return /class=["'][^"']*blocknik/.test(html);
}
