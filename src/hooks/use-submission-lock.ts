"use client";

import { useApp } from "@/components/app-state";
import { useEffect, useRef } from "react";

/** Remount a transaction form when its signer, real account or network changes. */
export function useWalletScope(genesisHash: string) {
  const { account, signerAccount, proxySigner, walletSource, walletConnectGenesisHash, readOnly } = useApp();
  return JSON.stringify([genesisHash, account, signerAccount, proxySigner, walletSource, walletConnectGenesisHash, readOnly]);
}

/** State updates alone do not prevent two submissions in the same React event batch. */
export function useSubmissionLock() {
  const state = useRef({ mounted: true, busy: false });
  useEffect(() => {
    const current = state.current;
    current.mounted = true;
    return () => { current.mounted = false; };
  }, []);
  return {
    begin: () => {
      if (!state.current.mounted || state.current.busy) return false;
      state.current.busy = true;
      return true;
    },
    active: () => state.current.mounted,
    end: () => { state.current.busy = false; },
  };
}
