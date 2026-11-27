"use client";

import { useApp } from "@/components/app-state";
import { useChain } from "@/hooks/use-chain-href";
import { discussionKeyType, discussionRequest, discussionSpace } from "@/lib/discussion";
import { stringToHex } from "@polkadot/util";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const challengeMutation = `
  mutation AuthChallenge($input: AuthChallengeInput!) {
    authChallenge(input: $input) { id message expiresAt }
  }
`;

const verifyMutation = `
  mutation VerifyAuthChallenge($input: VerifyAuthChallengeInput!) {
    verifyAuthChallenge(input: $input) {
      token
      identity { displayAddress }
    }
  }
`;

type Session = { token: string; address: string };

function readSession(key: string): Session | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null") as Session | null;
    return value?.token && value.address ? value : null;
  } catch {
    return null;
  }
}

/** Signed DeGov session for the connected account, used by referendum comments and replies. */
export function useDiscussionSession() {
  const chain = useChain();
  // Off-chain signatures always come from the wallet account, never a proxied one.
  const { signerAccount: account, accountType, signer, walletSource, readOnly } = useApp();
  const [session, setSession] = useState<(Session & { key: string }) | null>(null);
  const sessionKey = useMemo(() => account ? `subgov:discussion:${discussionSpace}:${chain.genesisHash}:${account}` : null, [account, chain.genesisHash]);
  const keyType = discussionKeyType(accountType, "sr25519");
  const canSign = Boolean(!readOnly && account && signer?.signRaw && keyType && walletSource !== "wallet-connect");
  const active = useRef({ sessionKey, canSign });
  active.current = { sessionKey, canSign };
  const token = canSign && session?.key === sessionKey && session?.address === account ? session.token : null;

  useEffect(() => {
    const saved = sessionKey ? readSession(sessionKey) : null;
    setSession(saved && sessionKey ? { ...saved, key: sessionKey } : null);
  }, [sessionKey]);

  const authenticate = useCallback(async () => {
    const assertActive = () => {
      if (!canSign || !active.current.canSign || active.current.sessionKey !== sessionKey) throw new Error("Connect a signing wallet for this account before changing discussion content.");
    };
    assertActive();
    if (walletSource === "wallet-connect") throw new Error("Use Talisman or Polkadot.js browser extension to sign comments.");
    if (!account || !signer?.signRaw) throw new Error("Connect a wallet that supports message signing.");
    const challenge = await discussionRequest<{ authChallenge: { id: string; message: string } }>(challengeMutation, {
      input: { space: discussionSpace, method: "SUBSTRATE_SIGN_RAW", address: account, chainRef: chain.genesisHash, cryptoType: keyType.toUpperCase() },
    });
    assertActive();
    const signed = await signer.signRaw({ address: account, data: stringToHex(challenge.authChallenge.message), type: "bytes" });
    assertActive();
    const verified = await discussionRequest<{ verifyAuthChallenge: { token: string } }>(verifyMutation, {
      input: { challengeId: challenge.authChallenge.id, signature: signed.signature },
    });
    const next = { token: verified.verifyAuthChallenge.token, address: account };
    assertActive();
    if (sessionKey) setSession({ ...next, key: sessionKey });
    if (sessionKey) sessionStorage.setItem(sessionKey, JSON.stringify(next));
    return next.token;
  }, [account, canSign, chain.genesisHash, keyType, sessionKey, signer, walletSource]);

  const clear = useCallback(() => {
    setSession(null);
    if (sessionKey) sessionStorage.removeItem(sessionKey);
  }, [sessionKey]);

  /** Runs a signed mutation, signing in first if needed and dropping a stale session on an auth error. */
  const signed = useCallback(async <T,>(query: string, variables: Record<string, unknown>) => {
    if (!canSign || !active.current.canSign || active.current.sessionKey !== sessionKey) throw new Error("Connect a signing wallet for this account before changing discussion content.");
    const authToken = token ?? await authenticate();
    if (!active.current.canSign || active.current.sessionKey !== sessionKey) throw new Error("The connected account changed. Try again.");
    try {
      return await discussionRequest<T>(query, variables, { token: authToken });
    } catch (cause) {
      if (cause instanceof Error && /authenticat|unauthori[sz]ed|token/i.test(cause.message)) clear();
      throw cause;
    }
  }, [authenticate, canSign, clear, sessionKey, token]);

  return { account, walletSource, canSign, token, authenticate, signed, clear };
}

export function readableDiscussionError(cause: unknown) {
  const message = typeof cause === "string" ? cause : cause instanceof Error ? cause.message : "Discussion is unavailable";
  const known: Record<string, string> = {
    discussion_space_not_found: "Discussion is not configured for SubGov yet.",
    origin_not_allowed: "This SubGov address is not allowed to sign in to discussion.",
    invalid_signature: "The wallet signature could not be verified. Try signing again.",
    comment_rate_limited: "Too many comments were posted. Try again in a minute.",
    "Failed to fetch": "The discussion service could not be reached. Try again in a moment.",
    "Load failed": "The discussion service could not be reached. Try again in a moment.",
  };
  return known[message] ?? message.replaceAll("_", " ");
}
