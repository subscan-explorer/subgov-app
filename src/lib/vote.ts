import type { Signer } from "@polkadot/api/types";
import type { ApiPromise } from "@polkadot/api";
import type { SubmittableExtrinsic } from "@polkadot/api/promise/types";
import { getChainApi } from "./chain-api";
import { sameAccount } from "./account-chain";
import { governanceProxyType } from "./wallets";
import { verifyConvictionReceipt, waitForConvictionFinality, type ConfirmationProgress } from "./conviction-finality";
import { buildConvictionVote, classLock, confirmDelegationChange, convictionVoteBalance, delegationChangePlan, parseTrackVoting, votableBalance, type ConvictionName, type Delegation, type ExistingVote, type TrackVoting, type VoteAmounts, type VoteMode } from "./conviction-voting";

const convictions = {
  "0.1x": "None",
  "1x": "Locked1x",
  "2x": "Locked2x",
  "3x": "Locked3x",
  "4x": "Locked4x",
  "5x": "Locked5x",
  "6x": "Locked6x",
} as const;


export type Conviction = keyof typeof convictions;
export type VoteProgress = "Connecting to network" | "Awaiting wallet signature" | ConfirmationProgress;

export function tokenAmountToPlanck(value: string, decimals: number): bigint {
  const match = value.trim().match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error("Enter a valid positive amount");
  const fraction = match[2] ?? "";
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error(`Amount supports at most ${decimals} decimal places`);
  }
  const planck = BigInt(match[1]) * BigInt(10) ** BigInt(decimals) + BigInt((fraction.slice(0, decimals) || "0").padEnd(decimals, "0"));
  if (planck <= BigInt(0)) throw new Error("Amount must be greater than zero");
  return planck;
}

/** Conviction multipliers and how many vote-locking periods each locks the balance for. */
export const CONVICTION_OPTIONS: { value: Conviction; multiplier: number; lockPeriods: number }[] = [
  { value: "0.1x", multiplier: 0.1, lockPeriods: 0 },
  { value: "1x", multiplier: 1, lockPeriods: 1 },
  { value: "2x", multiplier: 2, lockPeriods: 2 },
  { value: "3x", multiplier: 3, lockPeriods: 4 },
  { value: "4x", multiplier: 4, lockPeriods: 8 },
  { value: "5x", multiplier: 5, lockPeriods: 16 },
  { value: "6x", multiplier: 6, lockPeriods: 32 },
];

export function convictionValue(value: Conviction) {
  return convictions[value];
}

export function convictionFromName(name: ConvictionName): Conviction {
  return (Object.entries(convictions).find(([, value]) => value === name)?.[0] ?? "0.1x") as Conviction;
}

export function delegationCallArgs(trackId: number, target: string, amount: string, decimals: number, conviction: Conviction) {
  if (!Number.isSafeInteger(trackId) || trackId < 0) throw new Error("Select a valid OpenGov track");
  if (!target.trim()) throw new Error("Delegate address is required");
  return [trackId, target, convictionValue(conviction), tokenAmountToPlanck(amount, decimals)] as const;
}

// Extensions Polkadot.js drops when an older Asset Hub runtime put them in the signed (v4) list.
const paseoCustomExtensions = new Set(["UnitTransactionExtension", "AuthorizeCall", "AsPgas", "AsDotnsGateway", "RestrictOrigins", "EthSetOrigin", "StorageWeightReclaim"]);

export function transactionSigner(signer: Signer, walletSource?: string | null, assetHubCompatibility = false, onSigned?: () => void): Signer {
  const signPayload = signer.signPayload?.bind(signer);
  if (!signPayload) throw new Error("This wallet cannot sign transactions on this network");
  const needsCompatibility = walletSource === "polkadot-js" && assetHubCompatibility;
  if (!needsCompatibility && !onSigned) return signer;
  return {
    signPayload: async (payload) => {
      const signature = await signPayload(needsCompatibility ? {
        ...payload,
        // Polkadot.js drops these unknown extensions; their defaults encode as None, None, false.
        method: `${payload.method}000000`,
        signedExtensions: payload.signedExtensions.filter((extension) => !paseoCustomExtensions.has(extension)),
      } : payload);
      onSigned?.();
      return signature;
    },
    ...(signer.update ? { update: signer.update.bind(signer) } : {}),
  };
}

type TransactionArgs = {
  rpc: string;
  genesisHash: `0x${string}`;
  address: string;
  signer: Signer;
  walletSource?: string | null;
  onProgress?: (progress: VoteProgress) => void;
  /**
   * Proxy signing (#116): this wallet signs with a verified, explicit proxy type, so the call runs as `address`.
   */
  signAs?: string | null;
};

async function connectGovernanceApi(rpc: string, genesisHash: `0x${string}`) {
  return getChainApi(rpc, genesisHash);
}

/** Runs read-only chain queries against the selected Asset Hub. */
async function withGovernanceApi<T>(rpc: string, genesisHash: `0x${string}`, read: (api: ApiPromise) => Promise<T>) {
  const api = await connectGovernanceApi(rpc, genesisHash);
  if (!api.query.convictionVoting?.votingFor) throw new Error("This network does not support conviction voting");
  return read(api);
}

type Json = { toJSON: () => unknown };

async function trackVoting(api: ApiPromise, address: string, trackId: number): Promise<TrackVoting> {
  return parseTrackVoting((await api.query.convictionVoting.votingFor(address, trackId) as unknown as Json).toJSON());
}

function trackNames(api: ApiPromise) {
  const tracks = api.consts.referenda?.tracks?.toJSON() as unknown;
  const names = new Map<number, string>();
  if (Array.isArray(tracks)) {
    for (const track of tracks) {
      if (!Array.isArray(track)) continue;
      const info = track[1] as { name?: unknown } | undefined;
      const raw = typeof info?.name === "string" ? info.name : "";
      const name = /^0x[0-9a-f]*$/i.test(raw) ? hexToText(raw) : raw;
      names.set(Number(track[0]), name.replace(/\0+$/, "").replaceAll("_", " "));
    }
  }
  return names;
}

function hexToText(hex: string) {
  const bytes = hex.slice(2).match(/../g) ?? [];
  return bytes.map((byte) => String.fromCharCode(Number.parseInt(byte, 16))).join("");
}

export type VotingContext = {
  /** Total balance the pallet allows behind a vote. */
  votable: bigint;
  /** Existing conviction-voting lock on this track. */
  trackLock: bigint;
  /** The account's current vote on this referendum, if any. */
  existing: ExistingVote | null;
  /** Set when the account delegates this track and cannot vote directly. */
  delegating: Delegation | null;
};

export async function readVotingContext({ rpc, genesisHash, address, trackId, referendumId }: {
  rpc: string;
  genesisHash: `0x${string}`;
  address: string;
  trackId: number;
  referendumId: number;
}): Promise<VotingContext> {
  return withGovernanceApi(rpc, genesisHash, async (api) => {
    const [account, locks, voting] = await Promise.all([
      api.query.system.account(address) as unknown as Promise<Json>,
      api.query.convictionVoting.classLocksFor(address) as unknown as Promise<Json>,
      trackVoting(api, address, trackId),
    ]);
    return {
      votable: votableBalance(account.toJSON()),
      trackLock: classLock(locks.toJSON(), trackId),
      existing: voting.kind === "casting" ? voting.votes.get(referendumId) ?? null : null,
      delegating: voting.kind === "delegating" ? { target: voting.target, conviction: voting.conviction, balance: voting.balance } : null,
    };
  });
}

export type AccountDelegation = { trackId: number; trackName: string } & Delegation;

/** Every class the account currently delegates, read from `convictionVoting.votingFor` entries. */
export async function readAccountDelegations({ rpc, genesisHash, address }: { rpc: string; genesisHash: `0x${string}`; address: string }): Promise<AccountDelegation[]> {
  return withGovernanceApi(rpc, genesisHash, async (api) => {
    const names = trackNames(api);
    const entries = await api.query.convictionVoting.votingFor.entries(address) as unknown as [{ args: [unknown, { toString: () => string }] }, Json][];
    return entries.flatMap(([key, value]) => {
      const trackId = Number(key.args[1].toString());
      const voting = parseTrackVoting(value.toJSON());
      return voting.kind === "delegating"
        ? [{ trackId, trackName: names.get(trackId) || `Track ${trackId}`, target: voting.target, conviction: voting.conviction, balance: voting.balance }]
        : [];
    }).sort((a, b) => a.trackId - b.trackId);
  });
}

/** Signs and submits any governance call on the selected Asset Hub with the shared progress and error handling. */
export async function submitGovernanceTransaction(
  args: TransactionArgs,
  build: (api: ApiPromise) => Promise<SubmittableExtrinsic | SubmittableExtrinsic[]> | SubmittableExtrinsic | SubmittableExtrinsic[],
) {
  return submitConvictionTransaction(args, async (api) => {
    const built = await build(api);
    if (!Array.isArray(built)) return built;
    if (!built.length) throw new Error("Nothing to submit");
    if (built.length === 1) return built[0];
    if (!api.tx.utility?.batchAll) throw new Error("This network cannot batch these calls");
    return api.tx.utility.batchAll(built);
  });
}

export type { TransactionArgs };

async function submitConvictionTransaction(
  args: TransactionArgs,
  build: (api: ApiPromise) => Promise<SubmittableExtrinsic> | SubmittableExtrinsic,
) {
  args.onProgress?.("Connecting to network");
  const api = await connectGovernanceApi(args.rpc, args.genesisHash);
  const inner = await build(api);
  const proxied = Boolean(args.signAs && !sameAccount(args.signAs, args.address));
  if (proxied && !api.tx.proxy?.proxy) throw new Error("This network has no proxy pallet");
  let extrinsic = inner;
  if (proxied) {
    const [definitions] = (await api.query.proxy.proxies(args.address)).toJSON() as [{ delegate: string; proxyType: string; delay: number }[], unknown];
    const proxyType = governanceProxyType(definitions, args.signAs!, sameAccount);
    if (!proxyType) throw new Error("This wallet no longer has an immediate governance proxy permission for the account.");
    // None would let the runtime choose the first permission, including a delayed or unrelated one.
    extrinsic = api.tx.proxy.proxy(args.address, proxyType, inner);
  }
  const signerAddress = proxied ? args.signAs! : args.address;
  args.onProgress?.("Awaiting wallet signature");

  const assetHubCompatibility = api.registry.signedExtensions.includes("AsPgas")
    && api.registry.signedExtensions.includes("AsDotnsGateway")
    && api.registry.signedExtensions.includes("RestrictOrigins");
  return waitForConvictionFinality((notify, startConfirmation) => {
    const signer = transactionSigner(args.signer, args.walletSource, assetHubCompatibility, startConfirmation);
    return extrinsic.signAndSend(signerAddress, { signer }, (result) => {
      // A retracted extrinsic can execute differently on reinclusion.
      notify({
        status: result.status.type,
        readFinalizedReceipt: result.status.isFinalized ? () => {
          const error = result.dispatchError;
          return verifyConvictionReceipt({
            readReceipt: () => ({ txHash: result.txHash.toHex(), blockHash: result.status.asFinalized.toHex() }),
            dispatchError: error ? () => {
              if (!error.isModule) return error.toString();
              const decoded = api.registry.findMetaError(error.asModule);
              return `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
            } : proxied ? proxyFailure(api, result.events) : undefined,
            hasSuccessEvent: result.events.some(({ event }) => event.section === "system" && event.method === "ExtrinsicSuccess"),
            lookupFailed: Boolean(result.internalError),
          });
        } : undefined,
      });
    });
  }, args.onProgress);
}

/** A proxied call that fails still lands the outer extrinsic; the inner error is in `proxy.ProxyExecuted`. */
function proxyFailure(api: ApiPromise, events: { event: { data: unknown[] } & Parameters<ApiPromise["events"]["system"]["ExtrinsicSuccess"]["is"]>[0] }[]) {
  const executed = events.find(({ event }) => api.events.proxy?.ProxyExecuted?.is(event));
  if (!executed) return undefined;
  const outcome = executed.event.data[0] as unknown as { isErr: boolean; asErr: { isModule: boolean; asModule: Parameters<typeof api.registry.findMetaError>[0]; toString(): string } };
  if (!outcome.isErr) return undefined;
  return () => {
    const error = outcome.asErr;
    if (!error.isModule) return error.toString();
    const decoded = api.registry.findMetaError(error.asModule);
    return `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
  };
}

export async function submitReferendumVote({
  rpc,
  genesisHash,
  referendumId,
  trackId,
  mode,
  amounts,
  decimals,
  conviction,
  address,
  signer,
  walletSource,
  signAs,
  onProgress,
}: TransactionArgs & {
  referendumId: number;
  /** Track of the referendum; used to refuse voting while that track is delegated. */
  trackId?: number;
  mode: VoteMode;
  amounts: VoteAmounts;
  decimals: number;
  conviction: Conviction;
}) {
  if (!Number.isSafeInteger(referendumId) || referendumId < 0) throw new Error("Invalid referendum ID");
  const vote = buildConvictionVote(mode, amounts, decimals, convictionValue(conviction));
  return submitConvictionTransaction({ rpc, genesisHash, address, signer, walletSource, signAs, onProgress }, async (api) => {
    if (!api.tx.convictionVoting?.vote) throw new Error("This network does not support conviction voting");
    const [info, account, voting] = await Promise.all([
      api.query.referenda.referendumInfoFor(referendumId) as unknown as Promise<{ isSome: boolean; unwrap: () => { isOngoing: boolean } }>,
      api.query.system.account(address) as unknown as Promise<Json>,
      trackId == null ? Promise.resolve(null) : trackVoting(api, address, trackId),
    ]);
    if (!info.isSome || !info.unwrap().isOngoing) throw new Error("This referendum is no longer open for voting");
    if (voting?.kind === "delegating") throw new Error("This account delegates this track. Undelegate it before voting directly.");
    const balance = votableBalance(account.toJSON());
    const amount = convictionVoteBalance(vote);
    if (amount > balance) throw new Error("Vote amount exceeds the account balance");
    const extrinsic = api.tx.convictionVoting.vote(referendumId, vote);
    // Direct voters pay their own fee. For a proxy, the signing account pays the outer call's fee;
    // it must not be deducted from the real account's voting balance.
    if (!signAs || sameAccount(signAs, address)) {
      const { partialFee } = await extrinsic.paymentInfo(address);
      if (amount + partialFee.toBigInt() > balance) {
        throw new Error("Vote amount plus the estimated network fee exceeds the account balance");
      }
    }
    return extrinsic;
  });
}

export async function submitDelegation({
  rpc,
  genesisHash,
  trackId,
  expectedDelegation,
  target,
  amount,
  decimals,
  conviction,
  address,
  signer,
  walletSource,
  signAs,
  onProgress,
}: TransactionArgs & {
  trackId: number;
  expectedDelegation: Delegation | null;
  target: string;
  amount: string;
  decimals: number;
  conviction: Conviction;
}) {
  const callArgs = delegationCallArgs(trackId, target, amount, decimals, conviction);
  return submitConvictionTransaction({ rpc, genesisHash, address, signer, walletSource, signAs, onProgress }, async (api) => {
    if (!api.tx.convictionVoting?.delegate) throw new Error("This network does not support conviction delegation");
    const tracks = api.consts.referenda?.tracks?.toJSON() as unknown;
    if (!Array.isArray(tracks) || !tracks.some((track) => Array.isArray(track) && Number(track[0]) === trackId)) {
      throw new Error("The selected track is not available on this network");
    }
    const replace = confirmDelegationChange(await trackVoting(api, address, trackId), expectedDelegation);
    const delegate = api.tx.convictionVoting.delegate(...callArgs);
    if (!replace) return delegate;
    if (!api.tx.utility?.batchAll || !api.tx.convictionVoting.undelegate) {
      throw new Error("This network cannot batch the delegation change");
    }
    return api.tx.utility.batchAll([api.tx.convictionVoting.undelegate(trackId), delegate]);
  });
}

export async function submitUndelegation({
  rpc,
  genesisHash,
  trackIds,
  address,
  signer,
  walletSource,
  signAs,
  onProgress,
}: TransactionArgs & { trackIds: number[] }) {
  const plan = delegationChangePlan(trackIds);
  return submitConvictionTransaction({ rpc, genesisHash, address, signer, walletSource, signAs, onProgress }, async (api) => {
    if (!api.tx.convictionVoting?.undelegate) throw new Error("This network does not support conviction delegation");
    const states = await Promise.all(plan.map((step) => trackVoting(api, address, step.trackId)));
    const missing = plan.find((_, index) => states[index].kind !== "delegating");
    if (missing) throw new Error(`Track ${missing.trackId} is not delegated by this account`);
    const calls = plan.map((step) => api.tx.convictionVoting.undelegate(step.trackId));
    if (calls.length === 1) return calls[0];
    if (!api.tx.utility?.batchAll) throw new Error("This network cannot batch multiple undelegations");
    return api.tx.utility.batchAll(calls);
  });
}

if (import.meta.main) {
  console.assert(tokenAmountToPlanck("1.25", 10) === BigInt("12500000000"));
  console.assert(tokenAmountToPlanck("0.0000000001", 10) === BigInt(1));
  console.assert(convictionValue("6x") === "Locked6x");
  console.assert(convictionFromName("Locked3x") === "3x");
  console.assert(delegationCallArgs(32, "delegate", "2.5", 10, "2x")[3] === BigInt("25000000000"));
  let signedMethod = "";
  const signer = transactionSigner({ signPayload: async (payload) => { signedMethod = payload.method; return { id: 1, signature: "0x" }; } }, "polkadot-js", true);
  await signer.signPayload!({ method: "0x12", signedExtensions: ["AsPgas", "CheckNonce"] } as never);
  console.assert(signedMethod === "0x12000000");
  console.log("vote helpers ok");
}
