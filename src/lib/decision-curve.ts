import type { DecisionCurve } from "@/lib/types";

const SCALE = 1_000_000_000;
const fraction = (value: unknown) => Number(value) / SCALE;
const label = (kind: string) => kind.replace(/([a-z\d])([A-Z])/g, "$1 $2");

export function parseDecisionCurve(value: unknown): DecisionCurve | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const [kind, raw] = Object.entries(value)[0] ?? [];
  if (!kind || !raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const params = raw as Record<string, unknown>;
  const values = Object.fromEntries(Object.entries(params).map(([key, item]) => [key, fraction(item)]));
  if (Object.values(values).some((item) => !Number.isFinite(item))) return undefined;

  if (kind === "LinearDecreasing") {
    return { kind, label: label(kind), length: values.length, floor: values.floor, ceil: values.ceil };
  }
  if (kind === "SteppedDecreasing") {
    return { kind, label: label(kind), begin: values.begin, end: values.end, step: values.step, period: values.period };
  }
  if (kind === "Reciprocal") {
    return { kind, label: label(kind), factor: values.factor, xOffset: values.x_offset, yOffset: values.y_offset };
  }
  return undefined;
}

export function decisionCurveThreshold(curve: DecisionCurve, progress: number) {
  const x = Math.min(1, Math.max(0, progress));
  let value: number;
  if (curve.kind === "LinearDecreasing") {
    value = curve.length > 0
      ? curve.ceil - (Math.min(x, curve.length) / curve.length) * (curve.ceil - curve.floor)
      : curve.floor;
  } else if (curve.kind === "SteppedDecreasing") {
    value = curve.period > 0
      ? Math.max(curve.end, curve.begin - Math.min(curve.begin, curve.step * Math.floor(x / curve.period)))
      : curve.end;
  } else {
    const denominator = x + curve.xOffset;
    value = denominator > 0 ? curve.factor / denominator + curve.yOffset : 1;
  }
  return Math.min(1, Math.max(0, value));
}
