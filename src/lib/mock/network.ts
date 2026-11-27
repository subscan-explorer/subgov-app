import type {
  CalendarEvent,
  CoreRecord,
  CoretimeSale,
  DemocracyReferendum,
  FellowshipMember,
  FellowshipReferendum,
  IdentityRecord,
  Motion,
  NominationPool,
  Preimage,
  ProxyRelation,
  Registrar,
  ScheduledCall,
  Username,
  Validator,
  VestingSchedule,
  WhitelistCall,
} from "@/lib/types";
import { A, ID, comment } from "./seed";

export const preimages: Preimage[] = [
  {
    hash: "0x11aa22bb33cc44dd55ee66ff77889900aabbccddeeff00112233445566778899",
    len: 184320,
    depositor: A.fellowship,
    deposit: "42",
    status: "Requested",
    call: "Utility.batch_all([System.set_code_without_checks, Scheduler.schedule])",
  },
  {
    hash: "0x22bb33cc44dd55ee66ff77889900aabbccddeeff0011223344556677889900aa",
    len: 612,
    depositor: A.dave,
    deposit: "1.2",
    status: "Requested",
    call: "Treasury.spend({ assetKind: USDT, amount: 24000_000000 })",
  },
  {
    hash: "0x44dd55ee66ff77889900aabbccddeeff0011223344556677889900aabbccdd",
    len: 96,
    depositor: A.alice,
    deposit: "12",
    status: "Unrequested",
    call: "System.remark_with_event(\"Wish: beneficiary registry\")",
  },
];

export const scheduledCalls: ScheduledCall[] = [
  {
    id: "sch-1",
    when: "2026-09-09T20:00:00Z",
    block: 28_520_000,
    origin: "WhitelistedCaller",
    call: "System.set_code_without_checks",
  },
  {
    id: "sch-2",
    when: "2026-09-12T08:00:00Z",
    block: 28_556_000,
    origin: "BigTipper",
    call: "Treasury.spend(8000 DOT)",
  },
  {
    id: "sch-3",
    when: "2026-09-20T00:00:00Z",
    block: 28_666_000,
    origin: "Root",
    call: "Scheduler.schedule_named",
    periodic: "every 24d",
  },
];

export const whitelist: WhitelistCall[] = [
  {
    hash: "0xwl01",
    preimageHash: "0x11aa22bb33cc44dd55ee66ff77889900aabbccddeeff00112233445566778899",
    call: "System.set_code_without_checks",
    active: true,
  },
  {
    hash: "0xwl02",
    preimageHash: "0x55ee66ff77889900aabbccddeeff0011223344556677889900aabbccddee00",
    call: "System.set_code_without_checks (RFC-123)",
    active: true,
  },
];

export const proxies: ProxyRelation[] = [
  { delegator: A.alice, delegate: A.bob, type: "Governance", delay: 0 },
  { delegator: A.charlie, delegate: A.dave, type: "Any", delay: 12 },
  { delegator: A.luna, delegate: A.nova, type: "Staking", delay: 0 },
  { delegator: A.orion, delegate: A.alice, type: "NonTransfer", delay: 6 },
];

export const vesting: VestingSchedule[] = [
  { address: A.ferdie, identity: ID[A.ferdie], locked: "120000", perBlock: "2", startingBlock: 24_000_000, remaining: "48000" },
  { address: A.luna, identity: ID[A.luna], locked: "50000", perBlock: "1", startingBlock: 25_000_000, remaining: "22000" },
];

export const validators: Validator[] = [
  { address: A.alice, identity: "Alice", commission: 3, selfStake: "18000", totalStake: "2_400_000", nominators: 420, active: true },
  { address: A.bob, identity: "Bob", commission: 5, selfStake: "12000", totalStake: "1_900_000", nominators: 310, active: true },
  { address: A.charlie, identity: "ChaosDAO", commission: 8, selfStake: "40000", totalStake: "3_100_000", nominators: 510, active: true },
  { address: A.dave, identity: "OpenGov Watch", commission: 2, selfStake: "8000", totalStake: "900000", nominators: 80, active: false },
  { address: A.eve, identity: "Eve Labs", commission: 10, selfStake: "22000", totalStake: "1_200_000", nominators: 140, active: true },
  { address: A.nova, identity: "Nova Delegate", commission: 4, selfStake: "15000", totalStake: "2_050_000", nominators: 260, active: true },
];

export const pools: NominationPool[] = [
  { id: 1, name: "Nova Pool", points: "4200000", members: 1280, state: "Open", commission: 2 },
  { id: 8, name: "Chaos Collective", points: "2100000", members: 640, state: "Open", commission: 4 },
  { id: 21, name: "Quiet Stake", points: "180000", members: 40, state: "Blocked", commission: 1 },
];

export const identities: IdentityRecord[] = [
  {
    address: A.alice,
    display: "Alice",
    legal: "Alice Research Ltd",
    email: "alice@example.org",
    web: "https://alice.example",
    twitter: "@alice",
    github: "alice",
    judgements: [{ registrar: "Registrar 0", judgement: "Reasonable" }],
  },
  {
    address: A.bob,
    display: "Bob",
    email: "bob@example.org",
    twitter: "@bob",
    judgements: [{ registrar: "Registrar 1", judgement: "KnownGood" }],
  },
  {
    address: A.charlie,
    display: "ChaosDAO",
    web: "https://chaos.example",
    matrix: "@chaos:matrix.org",
    judgements: [{ registrar: "Registrar 0", judgement: "Reasonable" }],
  },
  {
    address: A.nova,
    display: "Nova Delegate",
    web: "https://nova.example",
    twitter: "@novadelegate",
    judgements: [{ registrar: "Nova", judgement: "Reasonable" }],
  },
];

export const registrars: Registrar[] = [
  { id: 0, address: A.polkadot, identity: "Polkadot", fee: "20", fields: "Display | Legal | Email" },
  { id: 1, address: A.bob, identity: "Bob", fee: "5", fields: "Display | Twitter" },
  { id: 2, address: A.nova, identity: "Nova Delegate", fee: "8", fields: "All" },
];

export const usernames: Username[] = [
  { name: "alice", address: A.alice, provider: "People" },
  { name: "chaos", address: A.charlie, provider: "People" },
  { name: "nova", address: A.nova, provider: "People" },
];

export const coretimeSales: CoretimeSale[] = [
  {
    id: 12,
    regionBegin: 28_500_000,
    regionEnd: 28_932_000,
    price: "42.8",
    floor: "18.0",
    revenue: "910",
    coresOffered: 60,
    coresSold: 41,
    phase: "Leadin",
  },
  {
    id: 11,
    regionBegin: 28_068_000,
    regionEnd: 28_500_000,
    price: "31.2",
    floor: "18.0",
    revenue: "1240",
    coresOffered: 60,
    coresSold: 60,
    phase: "Ended",
  },
];

export const cores: CoreRecord[] = [
  { id: 0, task: "Asset Hub", type: "Reservation", begin: "2026-08-01", end: "2026-11-01" },
  { id: 1, task: "Collectives", type: "Reservation", begin: "2026-08-01", end: "2026-11-01" },
  { id: 14, task: "Hydration", type: "Bulk", begin: "2026-08-20", end: "2026-11-20" },
  { id: 22, task: "On-demand pool", type: "OnDemand", begin: "2026-09-01", end: "2026-12-01" },
];

export const calendar: CalendarEvent[] = [
  { id: "e1", title: "Ref 1945 confirming ends", type: "Confirmation", startAt: "2026-09-09T20:00:00Z", href: "/referenda/1945/" },
  { id: "e2", title: "Spend 77 payout window", type: "Treasury", startAt: "2026-09-12T08:00:00Z", href: "/treasury/spends/77/" },
  { id: "e3", title: "Coretime sale 12 lead-in", type: "Coretime", startAt: "2026-09-04T00:00:00Z", endAt: "2026-09-18T00:00:00Z", href: "/coretime/sales/12/" },
  { id: "e4", title: "Treasury spend period ends", type: "Treasury", startAt: "2026-09-20T00:00:00Z", href: "/treasury/" },
  { id: "e5", title: "Ref 1944 decision period", type: "Decision", startAt: "2026-09-02T20:40:00Z", endAt: "2026-09-16T20:40:00Z", href: "/referenda/1944/" },
];

export const fellowshipMembers: FellowshipMember[] = [
  { address: A.alice, identity: "Alice", rank: 5, salary: "10000", isActive: true },
  { address: A.bob, identity: "Bob", rank: 3, salary: "4000", isActive: true },
  { address: A.eve, identity: "Eve Labs", rank: 4, salary: "7000", isActive: true },
  { address: A.ferdie, identity: "Ferdie", rank: 1, salary: "1000", isActive: false },
];

export const fellowshipReferenda: FellowshipReferendum[] = [
  {
    id: 88,
    title: "Promote Eve to rank 5",
    proposer: A.alice,
    trackId: 3,
    status: "Deciding",
    content: "Evidence attached on-chain.",
    aye: 12,
    nay: 1,
    comments: [comment("fr1", A.bob, "Evidence is solid.", "2026-09-01T08:00:00Z")],
  },
  {
    id: 87,
    title: "Whitelist runtime v1.6.2",
    proposer: A.alice,
    trackId: 1,
    status: "Executed",
    content: "Whitelisted. See OpenGov 1945.",
    aye: 14,
    nay: 0,
    comments: [],
  },
];

export const councilMotions: Motion[] = [
  {
    id: 312,
    title: "Archive motion: set next spend period",
    proposer: A.bob,
    threshold: "8/13",
    ayes: 8,
    nays: 2,
    status: "Executed",
    content: "Historical council motion.",
    comments: [],
  },
  {
    id: 311,
    title: "Archive motion: reject proposal 880",
    proposer: A.alice,
    threshold: "8/13",
    ayes: 9,
    nays: 1,
    status: "Executed",
    content: "Rejected the marketing bundle.",
    comments: [],
  },
];

export const techCommProposals: Motion[] = [
  {
    id: 90,
    title: "Fast-track runtime 1.4.0 (historical)",
    proposer: A.fellowship,
    threshold: "3/5",
    ayes: 4,
    nays: 0,
    status: "Executed",
    content: "Archived technical committee fast-track.",
    comments: [],
  },
];

export const democracyReferenda: DemocracyReferendum[] = [
  {
    id: 140,
    title: "Democracy: enable OpenGov (historical)",
    status: "Executed",
    aye: "92000000",
    nay: "1100000",
    content: "The referendum that switched the network to OpenGov.",
  },
  {
    id: 138,
    title: "Democracy: rejected parachain slot tweak",
    status: "NotPassed",
    aye: "12000000",
    nay: "44000000",
    content: "Did not pass.",
  },
];
