import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const graph = JSON.parse(execFileSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["list", "--prod", "--depth", "Infinity", "--json"], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }));
const packages = new Map();
function collect(entry) {
  if (entry.path && entry.path !== root && existsSync(path.join(entry.path, "package.json"))) {
    const metadata = JSON.parse(readFileSync(path.join(entry.path, "package.json"), "utf8"));
    packages.set(`${metadata.name}@${metadata.version}`, { directory: entry.path, metadata });
  }
  for (const children of [entry.dependencies, entry.optionalDependencies]) {
    for (const child of Object.values(children ?? {})) collect(child);
  }
}
graph.forEach(collect);

const read = (file) => readFileSync(path.join(root, file), "utf8");
const nextLicense = () => read("node_modules/next/license.md");
const fallback = (name) => {
  if (name.startsWith("@polkadot-onboard/")) return read("licenses/third-party/polkadot-onboard.txt");
  if (name.startsWith("@walletconnect/modal")) return read("licenses/third-party/walletconnect-modal.txt");
  if (name === "@lit-labs/ssr-dom-shim") return read("licenses/third-party/lit.txt");
  if (name === "@next/env" || name.startsWith("@next/swc-")) return nextLicense();
  if (name === "client-only") return read("node_modules/react/LICENSE");
  // These packages declare MIT but publish no separate license file. Their
  // available authorship/readme notices are included alongside the MIT terms.
  if (["encode-utf8", "uint8arrays"].includes(name)) return read("licenses/third-party/mit-terms.txt");
  return null;
};

const sections = ["SubGov third-party dependency notices", "Original SubGov code: Apache-2.0. Font: public/fonts/OFL.txt."];
for (const [id, { directory, metadata }] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
  const entries = readdirSync(directory, { withFileTypes: true });
  const notices = entries.filter((entry) => entry.isFile() && /^(licen[sc]e|copying|notice|copyright)([._-].*)?$/i.test(entry.name));
  const texts = notices.map((entry) => `${entry.name}\n\n${readFileSync(path.join(directory, entry.name), "utf8")}`);
  if (!texts.length) {
    const upstreamLicense = fallback(metadata.name);
    if (upstreamLicense) texts.push(upstreamLicense);
    const readme = entries.find((entry) => entry.isFile() && /^readme(\.md|\.txt)?$/i.test(entry.name));
    if (readme) {
      const content = readFileSync(path.join(directory, readme.name), "utf8");
      // Some published packages include the full license only in their README.
      if (!upstreamLicense && !/Permission is hereby granted|Redistribution and use/i.test(content)) {
        throw new Error(`No complete license text for ${id}; review the new dependency before distribution.`);
      }
      texts.push(`${readme.name}\n\n${content}`);
    } else if (!upstreamLicense) {
      throw new Error(`No license text for ${id}; review the new dependency before distribution.`);
    }
  }
  sections.push([
    "=".repeat(72), id, `Declared license: ${JSON.stringify(metadata.license ?? metadata.licenses)}`,
    `Source: ${JSON.stringify(metadata.repository ?? metadata.homepage ?? `https://www.npmjs.com/package/${metadata.name}/v/${metadata.version}`)}`,
    ...(metadata.author ? [`Author: ${JSON.stringify(metadata.author)}`] : []), ...texts,
  ].join("\n\n"));
}
writeFileSync(path.join(root, "public/third-party-licenses.txt"), `${sections.join("\n\n")}\n`);
console.log(`Generated third-party notices for ${packages.size} installed production packages.`);
