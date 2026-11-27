export type SubscanSource = "pubfi" | "subscan" | "cluster";

export const SUBSCAN_UPSTREAMS = [
  "polkadot",
  "kusama",
  "assethub-polkadot",
  "assethub-kusama",
  "assethub-paseo",
  "statemint",
  "collectives-polkadot",
  "coretime-polkadot",
  "coretime-kusama",
  "people-polkadot",
  "people-kusama",
] as const;

export type SubscanUpstream = (typeof SUBSCAN_UPSTREAMS)[number] | "paseo";
export type SubscanNetwork = "polkadot" | "kusama" | "paseo" | "statemint" | "assethub-polkadot" | "assethub-kusama" | "assethub-paseo";

/** Current governance lives on Asset Hub; Council-era tips remain on the relay chain. */
export function governanceUpstream(network: SubscanNetwork, path?: string) {
  if (path?.replace(/^\//, "") === "scan/treasury/tips" && (network === "polkadot" || network === "kusama")) return network;
  if (network === "polkadot" || network === "kusama" || network === "paseo") return `assethub-${network}` as const;
  return network;
}

type Environment = Record<string, string | undefined>;

const PUBFI_BASE = "https://api.pubfi.ai/v1/gateway/subscan";

export class SubscanConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscanConfigError";
  }
}

export function subscanSource(env: Environment): SubscanSource {
  const source = env.SUBSCAN_API_SOURCE;
  if (source === "pubfi" || source === "subscan" || source === "cluster") return source;
  if (source) throw new SubscanConfigError(`Unsupported SUBSCAN_API_SOURCE: ${source}`);
  return "subscan";
}

function clusterBaseUrls(raw: string | undefined) {
  if (!raw) throw new SubscanConfigError("SUBSCAN_CLUSTER_BASE_URLS is not configured");

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new SubscanConfigError("SUBSCAN_CLUSTER_BASE_URLS must be valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SubscanConfigError("SUBSCAN_CLUSTER_BASE_URLS must be a JSON object");
  }

  const urls = value as Record<string, unknown>;
  for (const upstream of SUBSCAN_UPSTREAMS) {
    const base = urls[upstream];
    if (typeof base !== "string" || !base) {
      throw new SubscanConfigError(`SUBSCAN_CLUSTER_BASE_URLS is missing ${upstream}`);
    }
    try {
      const url = new URL(base);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    } catch {
      throw new SubscanConfigError(`SUBSCAN_CLUSTER_BASE_URLS has an invalid URL for ${upstream}`);
    }
  }
  return urls as Record<(typeof SUBSCAN_UPSTREAMS)[number], string>;
}

export function resolveSubscanRequest(
  source: SubscanSource,
  network: SubscanUpstream,
  path: string,
  env: Environment,
) {
  const upstream = network === "paseo" ? "assethub-paseo" : network;
  let base: string;

  if (source === "cluster") {
    base = clusterBaseUrls(env.SUBSCAN_CLUSTER_BASE_URLS)[upstream];
  } else if (source === "pubfi") {
    base = `${PUBFI_BASE}/${upstream}`;
  } else {
    base = `https://${upstream}.api.subscan.io`;
  }

  return {
    url: `${base.replace(/\/+$/, "")}/api/${path.replace(/^\//, "")}`,
    headers: subscanAuthHeaders(source, env),
  };
}

export function subscanAuthHeaders(source: SubscanSource, env: Environment): Record<string, string> {
  if (source === "cluster") return {};
  if (source === "pubfi") {
    if (!env.PUBFI_API_KEY) throw new SubscanConfigError("PUBFI_API_KEY is not configured");
    return { Authorization: `Bearer ${env.PUBFI_API_KEY}` };
  }
  if (!env.SUBSCAN_API_KEY) throw new SubscanConfigError("SUBSCAN_API_KEY is not configured");
  return { "X-API-Key": env.SUBSCAN_API_KEY };
}
