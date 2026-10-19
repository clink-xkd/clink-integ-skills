# clink-integ-skills

English | [简体中文](README-zh.md)

`clink-integ-skills` is a Codex-compatible skill for helping coding agents integrate ClinkBill payments. It covers two layers with two different mechanisms:

| Layer | What it does | Mechanism |
|---|---|---|
| Merchant integration | The merchant's own backend accepts payments: Secret Key, product catalog import, checkout and subscription sessions, webhook endpoints and signature verification, sandbox validation | The bundled offline `clink-integ-cli` plus the documented Clink REST API and JavaScript SDK |
| Agent payment capability | A merchant skill gives the end user's agent the ability to pay, refund, or set up a wallet | The Clink MCP server only |

The payment layer is MCP-only. There is no payment CLI to install, no process exit code to interpret, and no customer API key to hold: an agent runtime connects the `clink` MCP server and pays through its tools. `references/clink-mcp-payment-skill.md` is the contract for that layer.

Use the parent `agent-prompts` repository as the distribution package. This folder is the installable skill, and the parent repository also contains short prompts to give to agents. The agent-facing default prompt is in `agents/openai.yaml`, and longer Chinese prompt references are in `references/agent-prompt.zh-CN.md` and `references/universal-agent-prompt.zh-CN.md`.

## Agent Payment Capability: Clink MCP Only

The canonical protected resource is one MCP endpoint per environment, and it exposes the Catalog, UCP Commerce, Clink account/payment, and Skill Marketplace tool sets together:

| User-facing environment | MCP edition | Exact endpoint (also the OAuth resource and audience) |
|---|---|---|
| sandbox | uat | `https://uat-api.clinkbill.com/mcp` |
| production | production | `https://api.clinkbill.com/mcp` |

Sandbox is the UAT deployment: the MCP endpoint, the REST API base (`https://uat-api.clinkbill.com/api/`), and `CLINK_ENV=sandbox` all resolve to that one host, matching the official MCP integration guide.

- The Host configures exactly one `clink` MCP connection, using streamable HTTP with no API key or bearer token in configuration.
- The installed skill is named `clink-payment` and must be installed under its own `clink-payment/` directory.
- The authoritative operating ruleset is the server resource `clink://skill/rules`, or `get_skill_manifest` with `include_rules: true` when the Host cannot read MCP resources. Server rules supersede any locally installed skill text, so a server deploy updates behaviour without reinstalling the skill.
- Every Operation carries one `next_action`, whose `type` is a closed set: `PROVIDE_INPUT`, `CONFIRM`, `REDIRECT_USER`, `SETUP_REQUIRED`, `POLL_OPERATION`, `WAIT_OPERATION`, `CONTACT_SUPPORT`. Absence of `next_action` means the Operation is terminal.
- Paying is `prepare_payment` in `direct` or `session` mode followed by a user-approved `CONFIRM` and one `execute_payment`. Refunds follow `start_refund` → `CONFIRM` → `execute_refund`, then `get_refund`.
- `get_operation` is the only recovery path after a timeout or restart, and a timeout means the state is unknown rather than failed. One goal keeps exactly one in-flight Operation.

Local design aid for that layer:

```bash
node scripts/load_mcp_skill_context.mjs --print-path
```

It resolves in priority order `CLINK_MCP_RULES_PATH` (an exported snapshot of `clink://skill/rules`), then `CLINK_MCP_SKILL_PATH` (a local `clink-payment/SKILL.md`), then the vendored `references/clink-mcp-payment-skill.md`. It is a design aid, never the runtime authority.

## Current Merchant Integration Model

Normal integration no longer needs a Dashboard Console token after the Secret Key is configured.

In a local desktop environment, when no Secret Key has been provided and a browser is available, the agent may run:

```bash
node /absolute/path/to/clink-integ-skills/vendor/clink-integ-cli/clink-integ-cli --version
node /absolute/path/to/clink-integ-skills/vendor/clink-integ-cli/clink-integ-cli --help
```

The default CLI is an offline, self-contained Node.js bundle stored inside this skill at `vendor/clink-integ-cli/clink-integ-cli`. Do not install `clink-integ-cli` from GitHub or npm during normal skill execution.

The bundled CLI is browser-free. If this local desktop path needs `clink login`, Playwright must already be provisioned offline outside the bundle; otherwise skip `clink login` and use the browserless Secret Key path.

```bash
node /absolute/path/to/clink-integ-skills/vendor/clink-integ-cli/clink-integ-cli login
```

The human only completes Dashboard login in the opened browser. The CLI then finds or initializes the sandbox Secret Key and saves it to the CLI profile. If the merchant app runtime needs `CLINK_SECRET_KEY`, the agent can use `--show-secret` only in a controlled local secret-write step and write the value to an ignored `.env`, platform Secret, or secret manager.

In cloud, low-code, sandbox, or browserless environments, the user provides `CLINK_SECRET_KEY` once, then the agent configures the bundled CLI:

```bash
CLINK_INTEG_CLI=/absolute/path/to/clink-integ-skills/vendor/clink-integ-cli/clink-integ-cli
export CLINK_SECRET_KEY=sk_test_xxx
node "$CLINK_INTEG_CLI" auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox
node "$CLINK_INTEG_CLI" auth status --json
```

After either path, product catalog import, checkout/subscription calls, webhook endpoint management, doctor, smoke-test, and local webhook commands should run with Secret Key authentication and should not require Playwright or network package installation.

Authenticated `clink api request` input is restricted to a relative path below the configured API base. It cannot override the selected base origin or escape its base pathname with an absolute URL, scheme-relative URL, backslash, or parent path. On POSIX systems, CLI profiles and `.env` files containing Secret Keys or webhook signing secrets must be stored with mode `0600`.

The trusted local `clink checkout` commands retain their full operator-facing payload capability. Generated public checkout starters have a narrower trust boundary: callers select only a server-defined `priceKey` or `planKey`, while the server owns the amount, currency, product/price IDs, `merchantReferenceId`, return URLs, and payment settings. Replace the starter's example allowlist with a server-side catalog or order store before production; do not treat `merchantReferenceId` as an idempotency key.

Regenerate and verify the offline bundle only when updating the vendored CLI:

```bash
node scripts/build_cli_bundle.mjs --cli-root /absolute/path/to/clink-integ-cli
node scripts/verify_cli_bundle.mjs
```

Webhook endpoint management should be done through the Secret Key API path:

```bash
clink webhook endpoint ensure \
  --url https://example.com/api/clink/webhook \
  --events commerce \
  --save-secret \
  --sync-env-file .env.local \
  --json
```

Use `commerce` for a complete charging or subscription integration. A one-time checkout can use `checkout,disputes`; a subscription integration must use at least `checkout,subscriptions,disputes`; add `payment-methods` when saved payment methods must be synchronized, or keep `commerce`.

`core` is compatibility-only and suitable only for a minimal demo. Its exact six events are `session.complete`, `order.succeeded`, `order.failed`, `refund.succeeded`, `subscription.created`, and `invoice.paid`. It omits `order.created`, `order.next_action`, `subscription.cancelled`, `subscription.past_due`, `subscription.updated.*`, `invoice.open/void`, `dispute.*`, `refund.created`, `refund.failed`, and `session.expired`; existing `core` endpoints should migrate to `commerce` for complete charging coverage.

Endpoint ensure validates selected events against runtime `GET /webhook/events` and merges with an existing endpoint's events by default. Use `--allow-remove-events` only when replacing the event set and deleting existing events is explicitly intended. The versioned `commerce` preset remains a stable 31-event set; future Catalog events such as `payment_method.deleted` are available only through dynamic `all` or an explicit event selection until a later preset version changes that contract.

After `--save-secret`, the agent must sync the returned or rotated signing secret into the merchant runtime as `CLINK_WEBHOOK_SIGNING_KEY`, then restart or redeploy the app. A webhook URL change requires running `ensure` again and repeating the sync. API requests send `X-API-Key` and a fresh millisecond `X-Timestamp`; production accepts roughly +/-2 minutes while sandbox is currently more lenient.

The default local Merchant Webhook fixture uses an `event_` ID, `object: "event"`, integer Unix-millisecond `created`, an object-valued `data.object`, Invoice `items`, and no outer `livemode`. The flattened `--fixture-profile legacy` shape is deprecated and must be selected explicitly. `clink webhook fixture` and `clink webhook simulate` are local validation tools, not Clink server events and not proof of a real Clink sandbox Merchant Webhook UAT. Handlers must accept only integer second or millisecond `X-Clink-Timestamp` values within 300 seconds, verify the unmodified raw body before JSON parsing, reject malformed or unknown events with non-2xx responses, and use a durable Inbox keyed by `event.id` even inside that time window. Check `X-Clink-SignType: SHA256`, verify HMAC SHA-256 with a constant-time comparison over the raw body, subscribe to `order.created` and `order.next_action`, model multiple payment attempts per Session, and retain a dead-letter/outbox record after retry exhaustion.

## What The Skill Covers

- Secret Key setup for browserless, sandbox, cloud IDE, and low-code environments
- local desktop Secret Key bootstrap with `clink login` and `clink dashboard apikey ensure-secret --save --json`
- scanning the target project or website for paid products, prices, subscription plans, and billing intervals
- generating a deterministic `clink-catalog.json` with product image sources (`imageId`, `imageUrl`, or `imageFile`)
- validating, planning, and importing catalog data with `clink catalog validate`, `clink catalog plan`, and `clink catalog import`
- server-side checkout, payment, subscription, and refund route design (including `POST /refund`)
- webhook endpoint automation with `clink webhook endpoint ensure`
- raw-body webhook signature verification, `merchantReferenceId` + `sessionId` order matching, idempotency, retry safety, and out-of-order handling
- Elements embedded checkout guidance through `@clink-ai/clink-elements`
- agent payment capability through the Clink MCP server: `clink` connection setup, `clink://skill/rules`, the closed `next_action` set, purchase instructions, direct and session payment, refunds, and Operation recovery
- generic agent and OpenClaw merchant skill payment handoff design over the Clink MCP server
- review, validation, and developer-facing checklist generation

The agent discovers product data from the merchant project. The CLI validates, plans, imports, and manages Clink-side resources.

## Agent Prompt

Use this concise prompt when handing a project to an agent:

```text
Use $clink-integ-skills to integrate ClinkBill payments into this project with clink-integ-cli, Secret Key setup, product catalog import, checkout/subscription APIs, webhook endpoint automation, and sandbox validation. For any agent-side payment capability, connect the Clink MCP server and follow clink://skill/rules.
```

The skill itself tells the agent which references to read for standard integration, onboarding, validation, Elements, generic agent payment skills, and OpenClaw payment skills.

## Install

Install the official release into a Codex-compatible local skills directory:

```bash
mkdir -p ~/.codex/skills
git clone https://github.com/clinkbillcom/clink-integ-skills.git /tmp/clink-integ-skills
cp -R /tmp/clink-integ-skills ~/.codex/skills/clink-integ-skills
```

Or ask the agent:

```text
Install clink-integ-skills from: https://github.com/clinkbillcom/clink-integ-skills
```

No runtime dependency install is required for the skill itself.

## Key Files

| File | Purpose |
|---|---|
| `SKILL.md` | Main routing rules and hard constraints |
| `agents/openai.yaml` | Agent UI metadata and default prompt |
| `references/clink-integ-cli-integration.md` | Merchant-side Secret Key, catalog, checkout, webhook, and sandbox workflow |
| `references/standard-integration.md` | Standard Clink integration workflow |
| `references/clink-mcp-payment-skill.md` | The Clink MCP payment contract that this skill is built on |
| `references/agent-integration.md` | OpenClaw merchant skill integration over the Clink MCP server |
| `references/generic-agent-integration.md` | Generic (non-OpenClaw) agent runtime integration over the Clink MCP server |
| `references/new-user-onboarding.md` | New user onboarding and first sandbox checkout workflow |
| `references/agent-prompt.zh-CN.md` | Chinese agent prompt reference |
| `references/universal-agent-prompt.zh-CN.md` | Universal Chinese agent prompt reference |
| `references/review-checklist.md` | Review gates |
| `references/output-artifacts.md` | Expected implementation handoff artifacts |
| `lib/skill-runtime.mjs` | Runtime route and artifact generation logic |
| `lib/validators.mjs` | Contract and webhook design validators |

## Tooling

Run the checks and helpers from the repository root:

```bash
npm test
npm run test:structure
npm run test:runtime
npm run test:contracts
node scripts/run_skill_runtime.mjs --prompt "Integrate Clink checkout and webhooks" --json
node scripts/generate_guidance_artifacts.mjs --prompt "Design a Clink webhook integration"
node scripts/load_mcp_skill_context.mjs --print-path
```

For doc-dependent maintenance, use the built-in docs gate:

```bash
node scripts/load_official_docs.mjs --json
```

It uses the official Clink docs export at `https://docs.clinkbill.com/llms-full.txt`, refreshes stale cache automatically, and avoids guessing API behavior from memory.

## Compatibility

- Codex-style modular skills
- OpenClaw merchant skill flows over the Clink MCP server
- Generic agent runtime flows over the Clink MCP server

## License

MIT
