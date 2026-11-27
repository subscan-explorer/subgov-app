export type ChainId = "polkadot" | "kusama" | "paseo";

export type ReferendumStatus =
  | "Preparing"
  | "Deciding"
  | "Confirming"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "TimedOut"
  | "Killed"
  | "Executed"
  | "ExecutedFailed";

export type VoteSide = "Aye" | "Nay" | "Abstain";

export type DecisionCurve =
  | { kind: "LinearDecreasing"; label: string; length: number; floor: number; ceil: number }
  | { kind: "SteppedDecreasing"; label: string; begin: number; end: number; step: number; period: number }
  | { kind: "Reciprocal"; label: string; factor: number; xOffset: number; yOffset: number };

export type Track = {
  id: number;
  name: string;
  displayName: string;
  description: string;
  maxDeciding: number;
  decisionDeposit: string;
  preparePeriod: string;
  decisionPeriod: string;
  confirmPeriod: string;
  minEnactmentPeriod: string;
  minApproval: string;
  minSupport: string;
  minApprovalCurve?: DecisionCurve;
  minSupportCurve?: DecisionCurve;
  activeCount: number | null;
  allCount: number;
};

export type TimelineEvent = {
  id: string;
  title: string;
  at: string;
  block: number;
  detail?: string;
};

export type Vote = {
  voter: string;
  identity?: string;
  side: VoteSide;
  amount: string;
  conviction: string;
  at: string;
  /** Extrinsic that cast the vote; split votes index one row per side. */
  extrinsicIndex?: string;
  /** Migrated votes still refer to an extrinsic on their original relay chain. */
  relayChain?: boolean;
  delegated?: boolean;
  /** Set when this row is one part of a Split / SplitAbstain vote. */
  split?: "Split" | "SplitAbstain";
};

export type Comment = {
  id: string;
  author: string;
  identity?: string;
  body: string;
  at: string;
  thumbsUp: number;
  thumbsDown: number;
  replies: Comment[];
};

export type Referendum = {
  id: number;
  title: string;
  proposer: string;
  proposerIdentity?: string;
  trackId: number;
  trackLabel?: string;
  status: ReferendumStatus;
  hash: string;
  preimageHash: string;
  call: string;
  content: string;
  summary: string;
  submittedAt: string;
  submittedBlock: number;
  decideAt?: string;
  confirmAt?: string;
  enactAt?: string;
  aye: string | null;
  nay: string | null;
  abstain: string | null;
  support: number | null;
  supportAmount?: string | null;
  approval: number | null;
  issuance: string;
  decisionDeposit: string;
  submissionDeposit: string;
  votes: Vote[];
  timeline: TimelineEvent[];
  comments: Comment[];
  spendId?: number;
};

export type TreasuryStatus = {
  balance: string;
  nextBurn: string;
  burnRate: string;
  spendPeriod: string;
  spendPeriodRemaining: string;
  toBeAwarded: string;
};

export type TreasurySpend = {
  id: number;
  title: string;
  proposer: string;
  proposerIdentity?: string;
  amount: string;
  asset: string;
  beneficiary: string;
  status: "Pending" | "Approved" | "Paid" | "Expired";
  referendumId?: number;
  validFrom: string;
  expireAt: string;
  content: string;
  timeline: TimelineEvent[];
  comments: Comment[];
};

export type TreasuryProposal = {
  id: number;
  title: string;
  proposer: string;
  amount: string;
  beneficiary: string;
  status: "Proposed" | "Approved" | "Awarded" | "Rejected";
  content: string;
  comments: Comment[];
};

export type Bounty = {
  id: number;
  title: string;
  proposer: string;
  curator?: string;
  value: string;
  fee: string;
  status: "Proposed" | "Funded" | "Active" | "PendingPayout" | "Claimed" | "Cancelled";
  content: string;
  childIds: number[];
  comments: Comment[];
  timeline: TimelineEvent[];
};

export type ChildBounty = {
  id: number;
  parentId: number;
  title: string;
  beneficiary: string;
  value: string;
  status: "Added" | "Active" | "PendingPayout" | "Claimed";
  content: string;
};

export type Tip = {
  id: string;
  title: string;
  finder: string;
  beneficiary: string;
  amount: string;
  status: "Opened" | "Retracted" | "Closed";
  content: string;
};

export type Delegate = {
  address: string;
  identity: string;
  bio: string;
  maxDelegated: string;
  delegators: number;
  participation: number;
  tracks: number[];
  announcement: string;
};

export type Preimage = {
  hash: string;
  len: number;
  depositor: string;
  deposit: string;
  status: "Requested" | "Unrequested";
  call: string;
};

export type ScheduledCall = {
  id: string;
  when: string;
  block: number;
  origin: string;
  call: string;
  periodic?: string;
};

export type WhitelistCall = {
  hash: string;
  preimageHash: string;
  call: string;
  active: boolean;
};

export type ProxyRelation = {
  delegator: string;
  delegate: string;
  type: "Any" | "NonTransfer" | "Governance" | "Staking" | "NominationPools";
  delay: number;
};

export type VestingSchedule = {
  address: string;
  identity?: string;
  locked: string;
  perBlock: string;
  startingBlock: number;
  remaining: string;
};

export type Validator = {
  address: string;
  identity?: string;
  commission: number;
  selfStake: string;
  totalStake: string;
  nominators: number;
  active: boolean;
};

export type NominationPool = {
  id: number;
  name: string;
  points: string;
  members: number;
  state: "Open" | "Blocked" | "Destroying";
  commission: number;
};

export type IdentityRecord = {
  address: string;
  display: string;
  legal?: string;
  email?: string;
  web?: string;
  twitter?: string;
  github?: string;
  matrix?: string;
  judgements: { registrar: string; judgement: string }[];
};

export type Registrar = {
  id: number;
  address: string;
  identity?: string;
  fee: string;
  fields: string;
};

export type Username = {
  name: string;
  address: string;
  provider: string;
};

export type CoretimeSale = {
  id: number;
  regionBegin: number;
  regionEnd: number;
  price: string;
  floor: string;
  revenue: string;
  coresOffered: number;
  coresSold: number;
  phase: "Interlude" | "Leadin" | "FixedPrice" | "Ended";
};

export type CoreRecord = {
  id: number;
  task: string;
  type: "Reservation" | "OnDemand" | "Bulk";
  begin: string;
  end: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  type: string;
  startAt: string;
  endAt?: string;
  href: string;
};

export type FellowshipMember = {
  address: string;
  identity?: string;
  rank: number;
  salary: string;
  isActive: boolean;
};

export type FellowshipReferendum = {
  id: number;
  title: string;
  proposer: string;
  trackId: number;
  status: ReferendumStatus;
  content: string;
  aye: number;
  nay: number;
  comments: Comment[];
};

export type Motion = {
  id: number;
  title: string;
  proposer: string;
  threshold: string;
  ayes: number;
  nays: number;
  status: "Proposed" | "Approved" | "Disapproved" | "Executed";
  content: string;
  comments: Comment[];
};

export type DemocracyReferendum = {
  id: number;
  title: string;
  status: "Passed" | "NotPassed" | "Cancelled" | "Executed";
  aye: string;
  nay: string;
  content: string;
};

export type NewsItem = {
  id: number;
  title: string;
  source: string;
  at: string;
  href: string;
  summary: string;
};

export type Multisig = {
  address: string;
  signatories: string[];
  threshold: number;
  pending: number;
};

export type AccountVote = {
  referendumId: number;
  title: string;
  side: VoteSide;
  amount: string;
  conviction: string;
};

export type Deposit = {
  kind: string;
  ref: string;
  amount: string;
  href: string;
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
  href: string;
};

export type ChainConfig = {
  id: ChainId;
  name: string;
  symbol: string;
  decimals: number;
  ss58: number;
  blockTimeMs: number;
};

export type RecoveryConfig = {
  account: string;
  identity?: string;
  friends: string[];
  threshold: number;
  delay: string;
  deposit: string;
  active: boolean;
};

export type AssetRecord = {
  id: number;
  symbol: string;
  name: string;
  issuer: string;
  issuerIdentity?: string;
  supply: string;
  holders: number;
  status: "Live" | "Frozen" | "Destroyed";
};

export type JudgementRequest = {
  id: number;
  address: string;
  identity: string;
  registrar: string;
  fee: string;
  status: "Pending" | "FeePaid" | "KnownGood" | "Reasonable";
  at: string;
};

export type IdentityVerification = {
  id: number;
  address: string;
  identity: string;
  channel: "Email" | "Twitter" | "Matrix" | "GitHub";
  status: "Pending" | "Verified" | "Rejected";
  at: string;
};

export type FellowshipEvidence = {
  id: number;
  member: string;
  identity?: string;
  rank: number;
  wish: "Retention" | "Promotion";
  at: string;
  summary: string;
};

export type FellowshipFeed = {
  id: string;
  at: string;
  actor: string;
  identity?: string;
  action: string;
  href: string;
};

export type PaPost = {
  id: number;
  title: string;
  kind: "Referendum" | "Post" | "Tip" | "Motion";
  paId: number;
  href: string;
  at: string;
};

export type MultiAssetChildBounty = {
  id: number;
  parentId: number;
  title: string;
  beneficiary: string;
  asset: string;
  value: string;
  status: "Added" | "Active" | "PendingPayout" | "Claimed";
  content: string;
};

export type ArchiveKey =
  | "advisory"
  | "communityCouncil"
  | "communityTreasury"
  | "financial"
  | "treasuryCouncil"
  | "openTechcomm";
