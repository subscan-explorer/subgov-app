import { governanceRequest, SubscanError, type SubscanNetwork } from "@/lib/pubfi";

type Envelope<T> = { code?: number; message?: string; data?: T };

export type Optional<T> = { available: true; data: T } | { available: false; reason: "pending" | "error"; message: string };

/**
 * Requests a Subscan endpoint that the subgov parity work asked the backend for and that may not be deployed yet.
 * A 404 / unknown-path answer is reported as `pending` so pages can say the feature waits on the backend instead of
 * failing; any other failure is `error`.
 */
export async function optionalGovernance<T>(
  network: SubscanNetwork,
  path: string,
  body: Record<string, unknown> = {},
  /** Treat a non-zero response code as "not deployed yet" (for extensions of an existing endpoint). */
  opts: { pendingOnCodeError?: boolean } = {},
): Promise<Optional<T>> {
  try {
    const response = await governanceRequest<Envelope<T>>(network, path, body);
    if (response.code !== undefined && response.code !== 0) {
      const message = response.message ?? "Subscan request failed";
      return { available: false, reason: opts.pendingOnCodeError || /not ?found|404|unknown|invalid (api|path)|no route/i.test(message) ? "pending" : "error", message };
    }
    if (response.data == null) return { available: false, reason: "pending", message: "Subscan returned no data" };
    return { available: true, data: response.data };
  } catch (error) {
    const status = error instanceof SubscanError ? error.status : 0;
    const message = error instanceof Error ? error.message : "Subscan request failed";
    return { available: false, reason: status === 404 || status === 405 ? "pending" : "error", message };
  }
}

export { addressOf, listOf, ratioPercent } from "@/lib/payload";
