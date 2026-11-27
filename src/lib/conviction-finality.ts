type Receipt = { txHash: string; blockHash: string };

export type ConfirmationProgress = "Submitting to network" | "Broadcasting" | "In block · waiting for finality" | "Block retracted · waiting for inclusion" | "Finalized";

type Update = {
  status: string;
  readFinalizedReceipt?: () => Receipt;
};

const uncertain = "Check the chain before retrying.";

export function verifyConvictionReceipt({ readReceipt, dispatchError, hasSuccessEvent, lookupFailed }: {
  readReceipt: () => Receipt;
  dispatchError?: () => string;
  hasSuccessEvent: boolean;
  lookupFailed: boolean;
}): Receipt {
  if (dispatchError) throw new Error(dispatchError());
  if (lookupFailed || !hasSuccessEvent) throw new Error(`Finalized transaction result could not be verified. ${uncertain}`);
  return readReceipt();
}

export function waitForConvictionFinality(
  subscribe: (notify: (update: Update) => void, startConfirmation: () => void) => Promise<() => void>,
  onProgress?: (progress: ConfirmationProgress) => void,
  timeoutMs = 5 * 60_000,
): Promise<Receipt> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stopWatching = (stop: () => void) => {
      try {
        // Cleanup must not change the confirmation result.
        void Promise.resolve(stop()).catch(() => {});
      } catch {
        // The subscription may already be closed.
      }
    };
    const finish = (outcome: { receipt: Receipt } | { error: unknown }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (unsubscribe) stopWatching(unsubscribe);
      if ("receipt" in outcome) resolve(outcome.receipt);
      else reject(outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error)));
    };
    // The wallet may keep its approval prompt open past the confirmation deadline.
    // Begin watching the network deadline only once a signature can be submitted.
    const startConfirmation = () => {
      if (settled || timer !== undefined) return;
      timer = setTimeout(() => {
        finish({ error: new Error(`Transaction confirmation timed out. ${uncertain}`) });
      }, timeoutMs);
      onProgress?.("Submitting to network");
    };

    const notify = ({ status, readFinalizedReceipt }: Update) => {
      if (settled) return;
      try {
        if (status === "Finalized") {
          if (!readFinalizedReceipt) throw new Error(`Finalized transaction result could not be verified. ${uncertain}`);
          const receipt = readFinalizedReceipt();
          finish({ receipt });
          onProgress?.("Finalized");
        } else if (status === "Invalid" || status === "Dropped" || status === "Usurped" || status === "FinalityTimeout") {
          finish({ error: new Error(`Transaction ${status === "FinalityTimeout" ? "finality timed out" : status.toLowerCase()}. ${uncertain}`) });
        } else if (status === "InBlock") {
          onProgress?.("In block · waiting for finality");
        } else if (status === "Retracted") {
          onProgress?.("Block retracted · waiting for inclusion");
        } else if (status === "Broadcast") {
          onProgress?.("Broadcasting");
        }
      } catch (error) {
        finish({ error });
      }
    };

    try {
      void subscribe(notify, startConfirmation).then((stop) => {
        if (settled) stopWatching(stop);
        else unsubscribe = stop;
      }, (error: unknown) => finish({ error }));
    } catch (error) {
      finish({ error });
    }
  });
}
