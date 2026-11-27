export function hasSpendRecord<T extends { proposal_id?: unknown; id?: unknown; title?: unknown }>(spend: T | null | undefined): spend is T {
  return spend != null && (spend.proposal_id != null || spend.id != null || Boolean(spend.title));
}
