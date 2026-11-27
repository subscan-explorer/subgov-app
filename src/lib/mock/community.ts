import type {
  AccountVote,
  Comment,
  Delegate,
  Deposit,
  Multisig,
  NewsItem,
  Notification,
} from "@/lib/types";
import { A, ID, comment } from "./seed";

export const delegates: Delegate[] = [
  {
    address: A.nova,
    identity: "Nova Delegate",
    bio: "Votes every track. Public rationale within 24h.",
    maxDelegated: "4200000",
    delegators: 186,
    participation: 96,
    tracks: [0, 1, 2, 11, 32, 33, 34],
    announcement: "Will vote Nay on marketing spends without KPIs.",
  },
  {
    address: A.luna,
    identity: "Luna Vote",
    bio: "Community-first. Small/medium spender specialist.",
    maxDelegated: "2100000",
    delegators: 94,
    participation: 88,
    tracks: [30, 31, 32, 33],
    announcement: "Accepting delegations on spender tracks only.",
  },
  {
    address: A.orion,
    identity: "Orion",
    bio: "Skeptical on large spends. Publishes a weekly newsletter.",
    maxDelegated: "1800000",
    delegators: 61,
    participation: 81,
    tracks: [11, 33, 34],
    announcement: "Need clawbacks on multi-month grants.",
  },
  {
    address: A.charlie,
    identity: "ChaosDAO",
    bio: "Collective of builders. Votes via multisig.",
    maxDelegated: "5400000",
    delegators: 40,
    participation: 74,
    tracks: [1, 2, 32, 33, 34],
    announcement: "Delegation pool reopens next month.",
  },
  {
    address: A.alice,
    identity: "Alice",
    bio: "Independent. Security and runtime focus.",
    maxDelegated: "900000",
    delegators: 22,
    participation: 91,
    tracks: [0, 1, 10],
    announcement: "Root and whitelist only.",
  },
];

export const news: NewsItem[] = [
  {
    id: 1,
    title: "OpenGov turnout recovered in August",
    source: "Eco News",
    at: "2026-09-01T08:00:00Z",
    href: "/news/",
    summary: "Average support on spender tracks rose from 3.1% to 5.4%.",
  },
  {
    id: 2,
    title: "Fellowship whitelist cadence",
    source: "Fellowship",
    at: "2026-08-28T08:00:00Z",
    href: "/fellowship/",
    summary: "Four whitelisted upgrades shipped in 30 days.",
  },
  {
    id: 3,
    title: "Asset Hub spend pool refill executed",
    source: "Treasury",
    at: "2026-07-03T08:00:00Z",
    href: "/treasury/spends/78/",
    summary: "5M USDT teleported after referendum 1930.",
  },
];

export const notifications: Notification[] = [
  {
    id: "n1",
    title: "Referendum 1945 entered confirming",
    body: "Whitelisted runtime upgrade.",
    at: "2026-09-08T14:00:00Z",
    read: false,
    href: "/referenda/1945/",
  },
  {
    id: "n3",
    title: "Spend 80 is still pending",
    body: "You subscribed to this spend.",
    at: "2026-09-06T08:00:00Z",
    read: true,
    href: "/treasury/spends/80/",
  },
];

export const myVotes: AccountVote[] = [
  { referendumId: 1945, title: "Runtime upgrade v1.6.2", side: "Aye", amount: "1200000", conviction: "6x" },
  { referendumId: 1944, title: "OpenGov analytics grant", side: "Aye", amount: "500000", conviction: "3x" },
  { referendumId: 1942, title: "Beneficiary registry", side: "Aye", amount: "800000", conviction: "6x" },
];

export const myDeposits: Deposit[] = [
  { kind: "Decision", ref: "Referendum 1942", amount: "2000", href: "/referenda/1942/" },
  { kind: "Submission", ref: "Referendum 1942", amount: "10", href: "/referenda/1942/" },
  { kind: "Preimage", ref: "0x44dd…ccdd", amount: "12", href: "/preimages/0x44dd55ee66ff77889900aabbccddeeff0011223344556677889900aabbccdd/" },
];

export const multisigs: Multisig[] = [
  { address: "15msigA11B22C33D44E55F66G77H88J99K00L", signatories: [A.alice, A.bob, A.charlie], threshold: 2, pending: 1 },
  { address: "14msigZ99Y88X77W66V55U44T33S22R11Q00P", signatories: [A.dave, A.eve, A.luna], threshold: 2, pending: 0 },
];

export const extraComments: Comment[] = [];
