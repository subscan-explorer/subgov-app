import type { ApiPromise } from "@polkadot/api";
import { measuredClockSeconds } from "./block-time";

/** Measure the same Relay/local block-number provider used by governanceBlockNumber. */
export async function readGovernanceBlockSeconds(api: ApiPromise): Promise<number | null> {
  const currentHash = await api.rpc.chain.getFinalizedHead();
  const current = await api.rpc.chain.getHeader(currentHash);
  const height = current.number.toNumber();
  if (height < 300) return null;
  const earlierHash = await api.rpc.chain.getBlockHash(height - 300);
  const [latest, earlier] = await Promise.all([api.at(currentHash), api.at(earlierHash)]);
  const sample = async (at: typeof latest, localBlock: number) => {
    const [timestamp, relayBlock] = await Promise.all([
      at.query.timestamp.now(),
      at.query.parachainSystem?.lastRelayChainBlockNumber?.(),
    ]);
    return { timestampMs: Number(timestamp.toString()), block: relayBlock ? Number(relayBlock.toString()) : localBlock };
  };
  const [now, before] = await Promise.all([sample(latest, height), sample(earlier, height - 300)]);
  return measuredClockSeconds(before, now);
}
