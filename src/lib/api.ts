import type {
  ArchiveKey,
  AssetRecord,
  Bounty,
  CalendarEvent,
  ChainConfig,
  ChildBounty,
  CoreRecord,
  CoretimeSale,
  Delegate,
  DemocracyReferendum,
  FellowshipEvidence,
  FellowshipFeed,
  FellowshipMember,
  FellowshipReferendum,
  IdentityRecord,
  IdentityVerification,
  JudgementRequest,
  Motion,
  MultiAssetChildBounty,
  NominationPool,
  PaPost,
  Preimage,
  ProxyRelation,
  RecoveryConfig,
  Referendum,
  Registrar,
  ScheduledCall,
  Tip,
  Track,
  TreasuryProposal,
  TreasurySpend,
  TreasuryStatus,
  Username,
  Validator,
  VestingSchedule,
  WhitelistCall,
} from "@/lib/types";
import {
  archives,
  assets,
  bounties,
  burns,
  calendar,
  childBounties,
  cores,
  coretimeSales,
  councilMotions,
  delegates,
  democracyReferenda,
  fellowshipEvidences,
  fellowshipFeeds,
  fellowshipMembers,
  fellowshipReferenda,
  identities,
  identityVerifications,
  judgementRequests,
  multiAssetBounties,
  multiAssetChildBounties,
  multisigs,
  myDeposits,
  myVotes,
  news,
  notifications,
  paPosts,
  pools,
  preimages,
  proxies,
  recoveries,
  referenda,
  registrars,
  scheduledCalls,
  spends,
  techCommProposals,
  tips,
  tracks,
  treasuryProjects,
  treasuryProposals,
  treasuryStatus,
  usernames,
  validators,
  vesting,
  whitelist,
} from "@/lib/mock";

export const chains: ChainConfig[] = [
  { id: "polkadot", name: "Polkadot", symbol: "DOT", decimals: 10, ss58: 0, blockTimeMs: 6000 },
  { id: "kusama", name: "Kusama", symbol: "KSM", decimals: 12, ss58: 2, blockTimeMs: 6000 },
];

export const api = {
  summary() {
    const active = (s: string) =>
      ["Preparing", "Deciding", "Confirming", "Active", "Pending", "Proposed", "Funded", "Opened"].includes(s);
    return {
      gov2Referenda: {
        active: referenda.filter((r) => active(r.status)).length,
        all: referenda.length,
      },
      treasuryProposals: {
        active: treasuryProposals.filter((p) => p.status === "Proposed").length,
        all: treasuryProposals.length,
      },
      treasurySpends: {
        active: spends.filter((s) => s.status === "Pending" || s.status === "Approved").length,
        all: spends.length,
      },
      bounties: { active: bounties.filter((b) => b.status === "Active" || b.status === "Funded").length, all: bounties.length },
      childBounties: { active: childBounties.filter((c) => c.status !== "Claimed").length, all: childBounties.length },
      multiAssetBounties: { active: 2, all: multiAssetBounties.length },
      tracks: tracks.map((t) => ({ id: t.id, name: t.name, activeCount: t.activeCount })),
    };
  },
  tracks(): Track[] {
    return tracks;
  },
  track(id: number): Track | undefined {
    return tracks.find((t) => t.id === id);
  },
  referenda(filter?: { trackId?: number; status?: string; q?: string }): Referendum[] {
    return referenda.filter((r) => {
      if (filter?.trackId != null && r.trackId !== filter.trackId) return false;
      if (filter?.status && filter.status !== "all" && r.status !== filter.status) return false;
      if (filter?.q) {
        const q = filter.q.toLowerCase();
        if (!`${r.id} ${r.title}`.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  },
  referendum(id: number): Referendum | undefined {
    return referenda.find((r) => r.id === id);
  },
  whales() {
    return [...referenda]
      .flatMap((r) => r.votes.map((v) => ({ ...v, referendumId: r.id, title: r.title })))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .slice(0, 20);
  },
  treasuryStatus(): TreasuryStatus {
    return treasuryStatus;
  },
  spends(): TreasurySpend[] {
    return spends;
  },
  spend(id: number): TreasurySpend | undefined {
    return spends.find((s) => s.id === id);
  },
  treasuryProposals(): TreasuryProposal[] {
    return treasuryProposals;
  },
  treasuryProposal(id: number): TreasuryProposal | undefined {
    return treasuryProposals.find((p) => p.id === id);
  },
  bounties(): Bounty[] {
    return bounties;
  },
  bounty(id: number): Bounty | undefined {
    return bounties.find((b) => b.id === id);
  },
  childBounties(): ChildBounty[] {
    return childBounties;
  },
  childBounty(id: number): ChildBounty | undefined {
    return childBounties.find((c) => c.id === id);
  },
  tips(): Tip[] {
    return tips;
  },
  tip(id: string): Tip | undefined {
    return tips.find((t) => t.id === id);
  },
  burns() {
    return burns;
  },
  treasuryProjects() {
    return treasuryProjects;
  },
  multiAssetBounties() {
    return multiAssetBounties;
  },
  multiAssetBounty(id: number) {
    return multiAssetBounties.find((b) => b.id === id);
  },
  delegates(): Delegate[] {
    return delegates;
  },
  delegate(address: string): Delegate | undefined {
    return delegates.find((d) => d.address === address);
  },
  preimages(): Preimage[] {
    return preimages;
  },
  preimage(hash: string): Preimage | undefined {
    return preimages.find((p) => p.hash === hash);
  },
  scheduler(): ScheduledCall[] {
    return scheduledCalls;
  },
  whitelist(): WhitelistCall[] {
    return whitelist;
  },
  proxies(): ProxyRelation[] {
    return proxies;
  },
  vesting(): VestingSchedule[] {
    return vesting;
  },
  validators(): Validator[] {
    return validators;
  },
  validator(address: string): Validator | undefined {
    return validators.find((v) => v.address === address);
  },
  pools(): NominationPool[] {
    return pools;
  },
  pool(id: number): NominationPool | undefined {
    return pools.find((p) => p.id === id);
  },
  identities(): IdentityRecord[] {
    return identities;
  },
  identity(address: string): IdentityRecord | undefined {
    return identities.find((i) => i.address === address);
  },
  registrars(): Registrar[] {
    return registrars;
  },
  usernames(): Username[] {
    return usernames;
  },
  coretimeSales(): CoretimeSale[] {
    return coretimeSales;
  },
  coretimeSale(id: number): CoretimeSale | undefined {
    return coretimeSales.find((s) => s.id === id);
  },
  cores(): CoreRecord[] {
    return cores;
  },
  calendar(): CalendarEvent[] {
    return calendar;
  },
  fellowshipMembers(): FellowshipMember[] {
    return fellowshipMembers;
  },
  fellowshipReferenda(): FellowshipReferendum[] {
    return fellowshipReferenda;
  },
  fellowshipReferendum(id: number): FellowshipReferendum | undefined {
    return fellowshipReferenda.find((r) => r.id === id);
  },
  councilMotions(): Motion[] {
    return councilMotions;
  },
  councilMotion(id: number): Motion | undefined {
    return councilMotions.find((m) => m.id === id);
  },
  techComm(): Motion[] {
    return techCommProposals;
  },
  techCommProposal(id: number): Motion | undefined {
    return techCommProposals.find((m) => m.id === id);
  },
  democracy(): DemocracyReferendum[] {
    return democracyReferenda;
  },
  democracyReferendum(id: number): DemocracyReferendum | undefined {
    return democracyReferenda.find((r) => r.id === id);
  },
  news() {
    return news;
  },
  notifications() {
    return notifications;
  },
  myVotes() {
    return myVotes;
  },
  myDeposits() {
    return myDeposits;
  },
  multisigs() {
    return multisigs;
  },
  search(q: string) {
    const s = q.toLowerCase().trim();
    if (!s) return { referenda: [], spends: [], identities: [], assets: [] };
    return {
      referenda: referenda.filter((r) => `${r.id} ${r.title}`.toLowerCase().includes(s)),
      spends: spends.filter((x) => `${x.id} ${x.title}`.toLowerCase().includes(s)),
      identities: identities.filter(
        (i) => i.display.toLowerCase().includes(s) || i.address.toLowerCase().includes(s),
      ),
      assets: assets.filter((a) => `${a.id} ${a.symbol} ${a.name}`.toLowerCase().includes(s)),
    };
  },
  recoveries(): RecoveryConfig[] {
    return recoveries;
  },
  assets(): AssetRecord[] {
    return assets;
  },
  asset(id: number): AssetRecord | undefined {
    return assets.find((a) => a.id === id);
  },
  judgementRequests(): JudgementRequest[] {
    return judgementRequests;
  },
  verifications(): IdentityVerification[] {
    return identityVerifications;
  },
  fellowshipEvidences(): FellowshipEvidence[] {
    return fellowshipEvidences;
  },
  fellowshipEvidence(id: number): FellowshipEvidence | undefined {
    return fellowshipEvidences.find((e) => e.id === id);
  },
  fellowshipFeeds(): FellowshipFeed[] {
    return fellowshipFeeds;
  },
  paPosts(): PaPost[] {
    return paPosts;
  },
  multiAssetChildBounties(): MultiAssetChildBounty[] {
    return multiAssetChildBounties;
  },
  multiAssetChildBounty(id: number): MultiAssetChildBounty | undefined {
    return multiAssetChildBounties.find((c) => c.id === id);
  },
  archive(key: ArchiveKey): Motion[] {
    return archives[key];
  },
  archiveMotion(key: ArchiveKey, id: number): Motion | undefined {
    return archives[key].find((m) => m.id === id);
  },
};
