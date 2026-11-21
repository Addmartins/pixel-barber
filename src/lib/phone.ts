const brazilianMobile = /^(?:[1-9][0-9])9[0-9]{8}$/;

export function normalizePhone(value: string): string | null {
  const compact = value.trim().replace(/[\s().-]/g, "");
  if (brazilianMobile.test(compact)) return `+55${compact}`;
  if (/^55[0-9]{11}$/.test(compact) && brazilianMobile.test(compact.slice(2))) return `+${compact}`;
  if (!/^\+[1-9][0-9]{7,14}$/.test(compact)) return null;
  if (compact.startsWith("+55") && !brazilianMobile.test(compact.slice(3))) return null;
  return compact;
}
