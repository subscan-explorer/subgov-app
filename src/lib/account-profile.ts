type Display = { display?: string | null; identity?: boolean | null; people?: { display?: string | null } | null };

/** Prefer an on-chain People identity, then the account's own identity label. */
export function accountProfileIdentity(account?: { account_display?: Display | null } | null): string | null {
  const display = account?.account_display;
  const peopleName = display?.people?.display?.trim();
  if (peopleName) return peopleName;
  const accountName = display?.display?.trim();
  return display?.identity && accountName ? accountName : null;
}
