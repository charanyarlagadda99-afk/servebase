export function formatRupees(paise: number, showDecimals = true): string {
  if (isNaN(paise) || paise === null || paise === undefined) return '₹0';
  const rupees = paise / 100.0;
  
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  });

  return formatter.format(rupees);
}

export function formatQuantity(qty: number, uom = ''): string {
  const formatted = Number(qty).toFixed(qty % 1 === 0 ? 0 : 2);
  return uom ? `${formatted} ${uom}` : formatted;
}
