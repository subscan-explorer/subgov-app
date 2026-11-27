import "server-only";
import { unstable_cache } from "next/cache";
import { governanceChains } from "./chains";
import { getChainApi } from "./chain-api";
import { readGovernanceBlockSeconds } from "./governance-clock";
import type { SubscanNetwork } from "./subscan-request";

/** OpenGov periods use Relay blocks after migration, not Asset Hub's faster production clock. */
const cachedGovernanceBlockSeconds = unstable_cache(async (network: SubscanNetwork): Promise<number | null> => {
  const id = network === "statemint" ? "polkadot" : network.replace(/^assethub-/, "");
  const chain = governanceChains[id as keyof typeof governanceChains];
  if (!chain) return null;
  try {
    return await readGovernanceBlockSeconds(await getChainApi(chain.rpc, chain.genesisHash));
  } catch {
    // Show block counts when the actual clock cannot be measured; never substitute the local clock.
    return null;
  }
}, ["governance-block-clock"], { revalidate: 300 });

/** A cold/unavailable RPC must not hold the whole page open while metadata loads. */
export async function liveGovernanceBlockSeconds(network: SubscanNetwork): Promise<number | null> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      cachedGovernanceBlockSeconds(network),
      new Promise<null>((resolve) => { timeout = setTimeout(() => resolve(null), 4_000); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
