import type {
  ArchiveKey,
  AssetRecord,
  FellowshipEvidence,
  FellowshipFeed,
  IdentityVerification,
  JudgementRequest,
  Motion,
  MultiAssetChildBounty,
  PaPost,
  RecoveryConfig,
} from "@/lib/types";
import { A, ID, comment } from "./seed";

function motion(
  id: number,
  title: string,
  proposer: string,
  status: Motion["status"],
  threshold: string,
  ayes: number,
  nays: number,
  content: string,
): Motion {
  return {
    id,
    title,
    proposer,
    threshold,
    ayes,
    nays,
    status,
    content,
    comments: [comment(`m${id}`, A.bob, "Archive record.", "2024-11-02T10:00:00Z")],
  };
}

export const recoveries: RecoveryConfig[] = [
  {
    account: A.alice,
    identity: ID[A.alice],
    friends: [A.bob, A.charlie, A.dave],
    threshold: 2,
    delay: "14d",
    deposit: "5",
    active: true,
  },
  {
    account: A.ferdie,
    identity: ID[A.ferdie],
    friends: [A.alice, A.eve],
    threshold: 2,
    delay: "7d",
    deposit: "5",
    active: false,
  },
];

export const assets: AssetRecord[] = [
  {
    id: 1984,
    symbol: "USDT",
    name: "Tether USD",
    issuer: A.polkadot,
    issuerIdentity: "Asset Hub",
    supply: "184000000",
    holders: 12840,
    status: "Live",
  },
  {
    id: 1337,
    symbol: "USDC",
    name: "USD Coin",
    issuer: A.polkadot,
    issuerIdentity: "Asset Hub",
    supply: "92000000",
    holders: 6400,
    status: "Live",
  },
  {
    id: 30,
    symbol: "DED",
    name: "DOT is Dead",
    issuer: A.charlie,
    issuerIdentity: ID[A.charlie],
    supply: "1000000000",
    holders: 2100,
    status: "Live",
  },
  {
    id: 8,
    symbol: "OLD",
    name: "Frozen experiment",
    issuer: A.eve,
    issuerIdentity: ID[A.eve],
    supply: "1000",
    holders: 3,
    status: "Frozen",
  },
];

export const judgementRequests: JudgementRequest[] = [
  {
    id: 12,
    address: A.ferdie,
    identity: ID[A.ferdie],
    registrar: "Registrar #0",
    fee: "5",
    status: "FeePaid",
    at: "2026-09-06T11:00:00Z",
  },
  {
    id: 11,
    address: A.orion,
    identity: ID[A.orion],
    registrar: "Registrar #1",
    fee: "8",
    status: "Pending",
    at: "2026-09-04T09:20:00Z",
  },
];

export const identityVerifications: IdentityVerification[] = [
  {
    id: 4,
    address: A.luna,
    identity: ID[A.luna],
    channel: "Twitter",
    status: "Verified",
    at: "2026-08-12T16:00:00Z",
  },
  {
    id: 5,
    address: A.dave,
    identity: ID[A.dave],
    channel: "GitHub",
    status: "Pending",
    at: "2026-09-01T08:00:00Z",
  },
  {
    id: 6,
    address: A.eve,
    identity: ID[A.eve],
    channel: "Email",
    status: "Rejected",
    at: "2026-07-22T12:00:00Z",
  },
];

export const fellowshipEvidences: FellowshipEvidence[] = [
  {
    id: 9,
    member: A.alice,
    identity: ID[A.alice],
    rank: 4,
    wish: "Retention",
    at: "2026-08-30T10:00:00Z",
    summary: "Runtime reviews for v1.6.x. Mentored two candidates.",
  },
  {
    id: 8,
    member: A.fellowship,
    identity: ID[A.fellowship],
    rank: 5,
    wish: "Promotion",
    at: "2026-08-12T10:00:00Z",
    summary: "Authored RFC-123 and the whitelist pipeline.",
  },
];

export const fellowshipFeeds: FellowshipFeed[] = [
  {
    id: "f1",
    at: "2026-09-08T14:00:00Z",
    actor: A.alice,
    identity: ID[A.alice],
    action: "Voted Aye on fellowship referendum #88",
    href: "/fellowship/referenda/88/",
  },
  {
    id: "f2",
    at: "2026-08-30T10:00:00Z",
    actor: A.alice,
    identity: ID[A.alice],
    action: "Submitted retention evidence",
    href: "/fellowship/evidences/9/",
  },
  {
    id: "f3",
    at: "2026-08-12T10:00:00Z",
    actor: A.fellowship,
    identity: ID[A.fellowship],
    action: "Submitted promotion evidence",
    href: "/fellowship/evidences/8/",
  },
];

export const paPosts: PaPost[] = [
  {
    id: 1,
    title: "Runtime upgrade v1.6.2 — asynchronous backing follow-up",
    kind: "Referendum",
    paId: 1945,
    href: "/referenda/1945/",
    at: "2026-09-04T08:12:00Z",
  },
  {
    id: 2,
    title: "Small spend: OpenGov analytics grant — 24,000 USDT",
    kind: "Referendum",
    paId: 1944,
    href: "/referenda/1944/",
    at: "2026-09-02T16:40:00Z",
  },
];

export const multiAssetChildBounties: MultiAssetChildBounty[] = [
  {
    id: 1,
    parentId: 1,
    title: "Q3 analytics dashboard",
    beneficiary: A.charlie,
    asset: "USDT",
    value: "12000",
    status: "Active",
    content: "Child of USDT researcher pool.",
  },
  {
    id: 2,
    parentId: 1,
    title: "Vote-history export",
    beneficiary: A.dave,
    asset: "USDT",
    value: "8000",
    status: "PendingPayout",
    content: "CSV exporter for referenda votes.",
  },
];

export const archives: Record<ArchiveKey, Motion[]> = {
  advisory: [
    motion(1, "Advise against marketing spend without KPIs", A.dave, "Executed", "3/5", 4, 1, "Advisory opinion recorded."),
    motion(2, "Recommend freeze of experimental asset", A.eve, "Proposed", "3/5", 2, 1, "Pending advisory vote."),
  ],
  communityCouncil: [
    motion(1, "Fund community call transcription", A.luna, "Executed", "5/7", 6, 0, "Paid from community treasury."),
    motion(2, "Reject off-topic bounty", A.bob, "Disapproved", "5/7", 1, 5, "Out of scope."),
  ],
  communityTreasury: [
    motion(1, "Translate docs into Spanish", A.luna, "Approved", "—", 0, 0, "Community treasury proposal."),
    motion(2, "Meetup kit for LatAm", A.charlie, "Proposed", "—", 0, 0, "Awaiting council."),
  ],
  financial: [
    motion(1, "Rebalance stablecoin buffer", A.dave, "Executed", "4/5", 4, 0, "Acala-style financial council."),
    motion(2, "Pause leveraged mint", A.eve, "Approved", "4/5", 4, 1, "Risk control."),
  ],
  treasuryCouncil: [
    motion(1, "Approve small tip batch", A.alice, "Executed", "3/4", 3, 0, "Legacy treasury council."),
    motion(2, "Reject duplicate proposal", A.bob, "Disapproved", "3/4", 0, 3, "Already paid via spend 79."),
  ],
  openTechcomm: [
    motion(1, "Whitelist runtime upgrade hash", A.fellowship, "Executed", "3/5", 5, 0, "Open tech-comm whitelist."),
    motion(2, "Fast-track preimage 0x11aa…", A.alice, "Proposed", "3/5", 2, 0, "Pending."),
  ],
};
