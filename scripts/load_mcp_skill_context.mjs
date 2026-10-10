import fs from "fs";
import path from "path";
import process from "process";
import { fileURLToPath } from "url";

/**
 * Loads the Clink MCP payment context this skill designs against.
 *
 * The runtime authority for Clink payments is the MCP server's `clink://skill/rules` resource, which
 * a deploy can change without reinstalling any skill. That resource is only reachable through an
 * authenticated MCP connection, so this script loads the best local representation available and
 * never pretends to be the authority:
 *
 *   1. `CLINK_MCP_RULES_PATH` — an operator-exported snapshot of `clink://skill/rules`.
 *   2. `CLINK_MCP_SKILL_PATH` — a local copy of the Host-installed `clink-payment/SKILL.md`.
 *   3. the vendored `references/clink-mcp-payment-skill.md` contract fallback.
 *
 * The previous CLI loader downloaded `agentic-payment-skills` and `openclaw-payment-skills` zips
 * from GitHub codeload. Those are the legacy CLI payment stacks and are no longer a dependency.
 */

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cacheRoot = path.join(skillRoot, ".cache", "mcp-skill-context");
const contextPath = path.join(cacheRoot, "mcp-payment-context.md");
const metaPath = path.join(cacheRoot, "mcp-payment-context.meta.json");
const vendoredContractPath = path.join(skillRoot, "references", "clink-mcp-payment-skill.md");

const CONTRACT_SKILL_NAME = "clink-payment";
const SUPPORTED_EDITIONS = {
  sandbox: { edition: "test", endpoint: "https://api.clinkbill.dev/mcp" },
  uat: { edition: "uat", endpoint: "https://uat-api.clinkbill.com/mcp" },
  production: { edition: "production", endpoint: "https://api.clinkbill.com/mcp" },
};

function parseArgs(argv) {
  const values = new Set(argv.slice(2));
  return {
    json: values.has("--json"),
    printPath: values.has("--print-path"),
    statusOnly: values.has("--status"),
    force: values.has("--force"),
    edition: readOption(argv.slice(2), "--edition"),
  };
}

function readOption(values, name) {
  const index = values.indexOf(name);
  if (index === -1) return null;
  const value = values[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  return value;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readMaybe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseSkillName(contents) {
  const frontmatter = contents.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatter) return null;
  const name = frontmatter[1].match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
  return name ? name[1].trim() : null;
}

function resolveEdition(requested) {
  if (!requested) return { id: "sandbox", ...SUPPORTED_EDITIONS.sandbox, explicit: false };
  const key = String(requested).trim().toLowerCase();
  const match = SUPPORTED_EDITIONS[key];
  if (!match) {
    throw new Error(
      `Unknown --edition ${requested}. Use one of: ${Object.keys(SUPPORTED_EDITIONS).join(", ")}`
    );
  }
  return { id: key, ...match, explicit: true };
}

function loadSnapshotSource({ id, label, filePath, validateSkillName }) {
  if (!filePath) return null;
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`);
  }

  const contents = fs.readFileSync(filePath, "utf8");
  if (validateSkillName) {
    const name = parseSkillName(contents);
    if (name !== CONTRACT_SKILL_NAME) {
      throw new Error(
        `${label} SKILL.md name is ${name || "missing"}, expected ${CONTRACT_SKILL_NAME}: ${filePath}`
      );
    }
  }

  return {
    id,
    label,
    source: id,
    path: filePath,
    latest: false,
    warning:
      id === "clink-rules-snapshot"
        ? "Operator-provided snapshot of clink://skill/rules. Confirm it against the live resource before treating it as current."
        : "Local copy of the installed clink-payment SKILL.md. Confirm it against the live resource before treating it as current.",
    contents,
  };
}

function loadVendoredContract() {
  const contents = readMaybe(vendoredContractPath);
  if (contents === null) {
    throw new Error(`vendored Clink MCP payment contract is missing: ${vendoredContractPath}`);
  }
  return {
    id: "vendored-contract",
    label: "references/clink-mcp-payment-skill.md",
    source: "vendored-contract",
    path: vendoredContractPath,
    latest: false,
    warning:
      "Vendored design contract. It is not the runtime authority: read clink://skill/rules (or get_skill_manifest with include_rules: true) over the live MCP connection before any payment workflow.",
    contents,
  };
}

function selectSource() {
  const rulesPath = process.env.CLINK_MCP_RULES_PATH;
  const skillPath = process.env.CLINK_MCP_SKILL_PATH;

  const snapshot =
    loadSnapshotSource({
      id: "clink-rules-snapshot",
      label: "clink://skill/rules snapshot",
      filePath: rulesPath,
      validateSkillName: false,
    }) ||
    loadSnapshotSource({
      id: "clink-payment-skill",
      label: "clink-payment SKILL.md",
      filePath: skillPath,
      validateSkillName: true,
    });

  return snapshot || loadVendoredContract();
}

function buildContextFile(result, edition) {
  ensureDir(cacheRoot);
  const lines = [
    "# Clink MCP Payment Context",
    "",
    `Generated at: ${new Date().toISOString()}`,
    `Resolved environment: ${edition.id} (${edition.edition} edition, ${edition.endpoint})`,
    "",
    "Use this file when designing or reviewing a merchant skill that gives an agent runtime the",
    "Clink payment capability. It is a local design aid: the authoritative operating ruleset is the",
    "live MCP resource `clink://skill/rules` (or `get_skill_manifest` with `include_rules: true`),",
    "and the server rules supersede any local text, including this file.",
    "",
    "## Source",
    "",
    `- source: ${result.source}`,
    `- path: ${result.path}`,
    `- latestRemoteContext: ${result.latest ? "true" : "false"}`,
    `- warning: ${result.warning}`,
    "",
    "## Contents",
    "",
    result.contents.trimEnd(),
    "",
  ];

  fs.writeFileSync(contextPath, lines.join("\n"), "utf8");
  return contextPath;
}

function writeMetadata(result, edition) {
  ensureDir(cacheRoot);
  const metadata = {
    id: result.id,
    label: result.label,
    source: result.source,
    path: result.path,
    latest: result.latest,
    warning: result.warning,
    edition: edition.id,
    mcpEdition: edition.edition,
    mcpEndpoint: edition.endpoint,
    editionExplicit: edition.explicit,
    rulesResourceUri: "clink://skill/rules",
    loadedAt: new Date().toISOString(),
    contextPath,
  };
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf8");
  return metadata;
}

function getStatus(edition) {
  const meta = readMaybe(metaPath);
  return {
    cacheRoot,
    contextPath,
    metaPath,
    exists: Boolean(meta),
    meta: meta ? JSON.parse(meta) : null,
    edition: edition.id,
    mcpEdition: edition.edition,
    mcpEndpoint: edition.endpoint,
    rulesResourceUri: "clink://skill/rules",
  };
}

function main() {
  const args = parseArgs(process.argv);
  const edition = resolveEdition(args.edition);

  if (args.statusOnly) {
    console.log(JSON.stringify(getStatus(edition), null, 2));
    return;
  }

  const result = selectSource();
  const contextFile = buildContextFile(result, edition);
  const metadata = writeMetadata(result, edition);

  if (args.printPath) {
    console.log(contextFile);
    return;
  }

  if (args.json) {
    console.log(JSON.stringify({ ...metadata, contents: result.contents }, null, 2));
    return;
  }

  console.log(`Clink MCP payment context path: ${contextFile}`);
  console.log(`${metadata.label}: ${metadata.source}`);
  console.log(`environment: ${metadata.edition} (${metadata.mcpEdition} edition, ${metadata.mcpEndpoint})`);
  console.log(`authoritative rules resource: ${metadata.rulesResourceUri}`);
  console.log(`warning: ${metadata.warning}`);
  console.log("");
  console.log(fs.readFileSync(contextFile, "utf8"));
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
