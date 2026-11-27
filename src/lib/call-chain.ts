import type { ApiPromise } from "@polkadot/api";
import { governanceBlockNumber, sameAccount } from "./account-chain";
import { getChainApi } from "./chain-api";
import { callTree, parseBoundedCall, type CallLike, type CallNode } from "./call-tree";
import { liveReferendumFields, type LiveReferendumFields } from "./referendum-live";

type Json = { toJSON: () => unknown };
type Chain = { rpc: string; genesisHash: `0x${string}` };

/** Recheck the deposit ticket before signing; indexed author data can outlive a refund. */
export async function buildUnnotePreimage(api: ApiPromise, hash: string, address: string) {
  for (const query of [api.query.preimage?.requestStatusFor, api.query.preimage?.statusFor]) {
    if (!query) continue;
    const status = (await query(hash) as unknown as Json).toJSON() as {
      unrequested?: { ticket?: [string, unknown]; deposit?: [string, unknown] };
      requested?: { maybeTicket?: [string, unknown] | null; deposit?: [string, unknown] | null };
    } | null;
    if (!status) continue;
    const ticket = status.unrequested?.ticket ?? status.unrequested?.deposit ?? status.requested?.maybeTicket ?? status.requested?.deposit;
    if (!ticket) throw new Error("This preimage has no refundable deposit.");
    if (!sameAccount(ticket[0], address)) throw new Error("The preimage deposit does not belong to this account.");
    return api.tx.preimage.unnotePreimage(hash);
  }
  throw new Error("This preimage has no refundable deposit.");
}

export type DecodedProposal =
  | { status: "decoded"; hash?: string; len?: number; tree: CallNode }
  | { status: "missing"; hash?: string; reason: string };

/** Preimage length from `preimage.requestStatusFor` / `statusFor` when only the hash is known. */
async function preimageLength(api: ApiPromise, hash: string): Promise<number | null> {
  for (const query of [api.query.preimage?.requestStatusFor, api.query.preimage?.statusFor]) {
    if (!query) continue;
    const json = (await query(hash) as unknown as Json).toJSON() as Record<string, { len?: number; maybeLen?: number }> | null;
    const status = json ? Object.values(json)[0] : null;
    const len = status?.len ?? status?.maybeLen;
    if (len != null) return Number(len);
  }
  return null;
}

export async function decodeCallBytes(api: ApiPromise, bytes: string | Uint8Array): Promise<CallNode> {
  const call = api.createType("Call", bytes) as unknown as CallLike;
  return callTree(call);
}

/** Decodes a preimage by hash (and length, when known) from `preimage.preimageFor`. */
export async function decodePreimage({ rpc, genesisHash, hash, len }: Chain & { hash: string; len?: number }): Promise<DecodedProposal> {
  const api = await getChainApi(rpc, genesisHash);
  if (!api.query.preimage?.preimageFor) return { status: "missing", hash, reason: "This network has no preimage pallet" };
  const length = len ?? await preimageLength(api, hash);
  if (length == null) return { status: "missing", hash, reason: "The preimage is not stored on-chain (never noted, or already unnoted)" };
  const bytes = await api.query.preimage.preimageFor([hash, length]) as unknown as { isSome: boolean; unwrap: () => Uint8Array };
  if (!bytes.isSome) return { status: "missing", hash, reason: "The preimage is not stored on-chain (never noted, or already unnoted)" };
  try {
    return { status: "decoded", hash, len: length, tree: await decodeCallBytes(api, bytes.unwrap()) };
  } catch {
    // Preimages migrated from the relay chain, or noted for an older runtime, do not decode against today's metadata.
    return { status: "missing", hash, reason: "The preimage is stored but does not decode with the current runtime (it may target the relay chain or an older runtime)" };
  }
}

export type OnChainReferendum = {
  fields: LiveReferendumFields | null;
  proposal: DecodedProposal | null;
  enactment: { kind: "after" | "at"; block: number } | null;
  submitted: number | null;
  deciding: { since: number; confirming: number | null } | null;
  now: number;
};

/** Live `referenda.referendumInfoFor` plus the decoded proposal. `fallbackHash` covers ended referenda. */
export async function readReferendumOnChain({ rpc, genesisHash, id, fallbackHash, decimals, decodeProposal = true }: Chain & { id: number; fallbackHash?: string; decimals: number; decodeProposal?: boolean }): Promise<OnChainReferendum> {
  const api = await getChainApi(rpc, genesisHash);
  const snapshot = await api.at(await api.rpc.chain.getFinalizedHead());
  const [info, now] = await Promise.all([
    snapshot.query.referenda.referendumInfoFor(id) as unknown as Promise<Json>,
    governanceBlockNumber(snapshot),
  ]);
  const json = info.toJSON() as { ongoing?: Record<string, unknown> } | null;
  const ongoing = json?.ongoing;
  let proposal: DecodedProposal | null = null;
  try {
    if (decodeProposal && ongoing) {
      const bounded = parseBoundedCall(ongoing.proposal);
      if (bounded?.inline) {
        proposal = await decodeCallBytes(api, bounded.inline)
          .then((tree): DecodedProposal => ({ status: "decoded", tree }))
          .catch((): DecodedProposal => ({ status: "missing", reason: "The inline call does not decode with the current runtime" }));
      }
      else if (bounded?.hash) proposal = await decodePreimage({ rpc, genesisHash, hash: bounded.hash, len: bounded.len });
    } else if (decodeProposal && fallbackHash) {
      proposal = await decodePreimage({ rpc, genesisHash, hash: fallbackHash });
    }
  } catch {
    // A preimage/metadata RPC failure must not discard the finalized state and decision clock.
    proposal = { status: "missing", reason: "The proposal call could not be read from the chain" };
  }
  const enactment = ongoing?.enactment as { after?: number; at?: number } | undefined;
  const deciding = ongoing?.deciding as { since?: number; confirming?: number | null } | null | undefined;
  return {
    fields: liveReferendumFields(json, decimals),
    proposal,
    enactment: enactment?.after != null ? { kind: "after", block: Number(enactment.after) } : enactment?.at != null ? { kind: "at", block: Number(enactment.at) } : null,
    submitted: ongoing?.submitted != null ? Number(ongoing.submitted) : null,
    deciding: deciding?.since != null ? { since: Number(deciding.since), confirming: deciding.confirming != null ? Number(deciding.confirming) : null } : null,
    now,
  };
}
