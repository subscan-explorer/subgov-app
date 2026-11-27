"use client";

import { useApp } from "@/components/app-state";
import { TxDialog } from "@/components/tx-dialog";
import { formatPlanck } from "@/components/undelegate";
import { useChain } from "@/hooks/use-chain-href";
import { buildDepositRefund, readReferendumOutcomes } from "@/lib/account-chain";
import { refundableDeposit, type DepositKind } from "@/lib/account-voting";
import { getChainApi } from "@/lib/chain-api";
import { formatBaseUnits } from "@/lib/format";
import type { Referendum, Track } from "@/lib/types";
import { useEffect, useState } from "react";

type Json = { toJSON: () => unknown };

/** "Place decision deposit" for a Preparing referendum that has none yet (`referenda.placeDecisionDeposit`). */
export function PlaceDecisionDeposit({ referendum, track }: { referendum: Referendum; track?: Track }) {
  const chain = useChain();
  if (referendum.status !== "Preparing" || Number(referendum.decisionDeposit) > 0) return null;
  const amount = track?.decisionDeposit && track.decisionDeposit !== "0" ? `${formatBaseUnits(track.decisionDeposit, chain.decimals) ?? track.decisionDeposit} ${chain.symbol}` : "the track's decision deposit";
  return (
    <TxDialog
      chain={chain}
      title={`Place decision deposit · #${referendum.id}`}
      triggerLabel="Place decision deposit"
      variant="line"
      successText={`The decision deposit is placed. Referendum #${referendum.id} enters Deciding once its prepare period ends and a track slot is free.`}
      submitLabel="Sign & place deposit"
      build={async (api) => {
        const info = (await api.query.referenda.referendumInfoFor(referendum.id) as unknown as Json).toJSON() as { ongoing?: { decisionDeposit?: unknown } } | null;
        if (!info?.ongoing) throw new Error("This referendum is no longer ongoing");
        if (info.ongoing.decisionDeposit) throw new Error("A decision deposit is already placed");
        return api.tx.referenda.placeDecisionDeposit(referendum.id);
      }}
    >
      <p className="text-sm leading-6">
        Reserves {amount} from your account so referendum #{referendum.id} can start deciding. The deposit is refundable after the referendum ends, unless it is killed.
      </p>
    </TxDialog>
  );
}

/** Refund buttons for deposits still held by an ended referendum. Anyone may submit; funds go to the depositor. */
export function RefundReferendumDeposits({ referendum }: { referendum: Referendum }) {
  const chain = useChain();
  const { account } = useApp();
  const [deposits, setDeposits] = useState<{ kind: DepositKind; amount: bigint }[]>([]);
  const ended = !["Preparing", "Deciding", "Confirming"].includes(referendum.status);
  useEffect(() => {
    if (!ended || !account) return;
    let cancelled = false;
    getChainApi(chain.rpc, chain.genesisHash)
      .then((api) => readReferendumOutcomes(api, [referendum.id]))
      .then((outcomes) => {
        const outcome = outcomes.get(referendum.id);
        if (cancelled || !outcome) return;
        setDeposits((["submission", "decision"] as const).flatMap((kind) => {
          const deposit = refundableDeposit(outcome, kind);
          return deposit ? [{ kind, amount: deposit.amount }] : [];
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ended, account, chain.rpc, chain.genesisHash, referendum.id]);
  if (!deposits.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {deposits.map((item) => (
        <TxDialog
          key={item.kind}
          chain={chain}
          title={`Refund ${item.kind} deposit · #${referendum.id}`}
          triggerLabel={`Refund ${item.kind} deposit`}
          size="sm"
          successText={`${formatPlanck(item.amount, chain)} is returned to the depositor.`}
          submitLabel="Sign & refund"
          onDone={() => setDeposits((current) => current.filter((value) => value.kind !== item.kind))}
          build={(api) => buildDepositRefund(api, referendum.id, item.kind)}
        >
          <p className="text-sm leading-6">Returns the {formatPlanck(item.amount, chain)} {item.kind} deposit to the account that placed it. Anyone may submit this call.</p>
        </TxDialog>
      ))}
    </div>
  );
}
