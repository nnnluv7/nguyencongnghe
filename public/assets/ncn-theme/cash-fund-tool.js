export const CASH_FUND_ICON = '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M9 8h6m-6 4h6m-6 4h3"/>';
export const CASH_FUND_TOOL = {
  id: 'cash-fund',
  title: 'Tiền quỹ Siêu Thị',
  href: '/tien-quy-sieu-thi/',
  description: 'Lập phiếu thu, chi và tra cứu số dư quỹ siêu thị.',
  group: 'kho',
  icon: 'receipt',
  tone: 'teal'
};

export function withCashFundTool(tools) {
  const list = tools.filter(tool => tool?.id !== CASH_FUND_TOOL.id);
  const cashIndex = list.findIndex(tool => tool?.id === 'cash');
  list.splice(cashIndex < 0 ? list.length : cashIndex + 1, 0, CASH_FUND_TOOL);
  return list;
}
