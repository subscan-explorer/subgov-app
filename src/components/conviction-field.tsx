"use client";

import { Field, Input, Select } from "@/components/ui";
import { CONVICTION_OPTIONS, type Conviction } from "@/lib/vote";

function periods(n: number) {
  if (n === 0) return "no lock after the vote ends";
  return `locked ${n} vote-locking period${n === 1 ? "" : "s"}`;
}

/** Amount + conviction with the lock each multiplier implies and the resulting voting power. */
export function ConvictionFields({
  amount,
  onAmount,
  conviction,
  onConviction,
  symbol,
  disabled,
}: {
  amount: string;
  onAmount: (value: string) => void;
  conviction: Conviction;
  onConviction: (value: Conviction) => void;
  symbol: string;
  disabled?: boolean;
}) {
  const option = CONVICTION_OPTIONS.find((item) => item.value === conviction) ?? CONVICTION_OPTIONS[1];
  const value = Number(amount);
  const power = amount.trim() && Number.isFinite(value) && value > 0 ? value * option.multiplier : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Amount (${symbol})`}>
          <Input name="amount" value={amount} inputMode="decimal" autoComplete="off" placeholder={`0 ${symbol}`} disabled={disabled} onChange={(event) => onAmount(event.target.value)} />
        </Field>
        <Field label="Conviction">
          <Select name="conviction" value={conviction} disabled={disabled} onChange={(event) => onConviction(event.target.value as Conviction)}>
            {CONVICTION_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.value} · {item.lockPeriods === 0 ? "no lock" : `${item.lockPeriods} lock period${item.lockPeriods === 1 ? "" : "s"}`}</option>
            ))}
          </Select>
        </Field>
      </div>
      <p className="rounded-2xl bg-panel-2 px-4 py-3 text-xs leading-5 text-mute" aria-live="polite">
        {power != null ? (
          <>Voting power <b className="num font-semibold text-paper">{power.toLocaleString("en-US", { maximumFractionDigits: 4 })} {symbol}</b> · {option.multiplier}× conviction, {periods(option.lockPeriods)}.</>
        ) : (
          <>Conviction multiplies voting power. Higher conviction keeps the balance {option.lockPeriods ? "locked for longer" : "unlocked"} after the vote ({periods(option.lockPeriods)}).</>
        )}
      </p>
    </div>
  );
}
