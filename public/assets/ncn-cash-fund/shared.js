export const CASH_FUND_TYPES = { in: 'Thu tiền quỹ', out: 'Chi tiền quỹ' };
export const NOTE_MAX_LENGTH = 500;

export function vietnamDate(now = Date.now()) {
  return new Date(now + 7 * 3600000).toISOString().slice(0, 10);
}
