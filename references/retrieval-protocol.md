# Retrieval Protocol

## Purpose

This module defines how `clink-integ-skills` should retrieve facts while the skill is being developed or maintained.

## Source Of Truth

The official maintainer source is:

- `https://docs.clinkbill.com/llms-full.txt`

Download and cache that document to the fixed local path:

- `.cache/official-docs/llms-full.txt`

This cache path is for skill authors and maintainers. It is not a runtime requirement for merchants using the skill.

When the current task needs official docs, run this before reading the cache:

- `node scripts/load_official_docs.mjs`

This command:

- downloads the official docs if they are missing
- checks the last download time before every use
- automatically refreshes the cache when it is older than 7 days
- keeps using the existing cache when it is still within 7 days
- falls back to stale cache only when refresh fails and a previous cache exists

Do not read or cite `.cache/official-docs/llms-full.txt` before this freshness check step for doc-dependent tasks.

## Payment Skill Context Sources

For merchant skill for generic agent integration and merchant skill for OpenClaw integration, the Clink MCP payment contract is the source context.

Before generating code, generating integration guidance, or reviewing a merchant skill integration that depends on the Clink MCP payment layer, run the context loader.

For OpenClaw agent review and for generic agent review, run:

- `node scripts/load_mcp_skill_context.mjs --print-path`

Then read the generated context file printed by the command before checking the merchant skill implementation.

This command:

- resolves the MCP payment contract context in priority order: `CLINK_MCP_RULES_PATH` (a local snapshot of the MCP `clink://skill/rules` resource), then `CLINK_MCP_SKILL_PATH` (a local `clink-payment/SKILL.md` copy), then the vendored `references/clink-mcp-payment-skill.md` fallback
- writes the resolved context file under `.cache/mcp-skill-context/`
- records source, resolution priority, and fallback status in metadata files under `.cache/mcp-skill-context/`
- never runs `git pull` in sibling working trees and never mutates local payment skill worktrees

Environment overrides:

- `CLINK_MCP_RULES_PATH`
- `CLINK_MCP_SKILL_PATH`

When the Host has the `clink` MCP connection, the authoritative payment rules are the `clink://skill/rules` resource, or `get_skill_manifest` with `include_rules: true` when the Host cannot read MCP resources. Those server rules supersede any locally installed skill text, so this local context is a design aid, not the runtime authority.

If the command reports a fallback warning, state that the MCP payment contract context is not confirmed latest before relying on exact tool names, `next_action` handling, message-routing directives, or ownership rules.

Review the merchant skill against the loaded MCP payment contract for correctness and completeness. For OpenClaw, verify the merchant skill integrates with its OpenClaw runtime contracts. For generic agent integration, verify the merchant skill or adapter integrates with the `clink-payment` skill and the `clink` MCP server contracts.

If the user explicitly asks to refresh or update the docs, run:

- `node scripts/refresh_official_docs.mjs --force`

If you only need the current cache status, run:

- `node scripts/refresh_official_docs.mjs --status`

## MCP Agent Retrieval

When UCP, Wallet, Browser Pay, MCP OAuth, or Operation recovery is in scope, refresh official docs first and read the smallest relevant sections for `api-reference/mcp/commerce`, `api-reference/mcp/wallet`, `api-reference/mcp/browser_pay`, `api-reference/mcp/operations`, `guides/agent/mcp_integration`, and `guides/agent/browser_pay`. The live `clink://skill/rules` resource returned by the connected MCP server is authoritative for current tool schemas and safety rules; this repository must not be treated as a replacement snapshot. Keep OAuth `resource` and token `audience` equal to the selected environment MCP endpoint.

## Default Sources

- `llms-full.txt`
- sections in `llms-full.txt` that correspond to quickstart, integration, API reference, and webhook behavior

## Standard Integration Retrieval

For standard integration, read the smallest useful set first:

1. quickstart content in `llms-full.txt`
2. integration content in `llms-full.txt`
3. checkout session content in `llms-full.txt`
4. refund content in `llms-full.txt`
5. API reference content in `llms-full.txt`

When webhook implementation is involved, also inspect the related webhook docs and webhook schemas.

## Agent Integration Retrieval

For merchant skill for OpenClaw integration, read:

1. the MCP payment contract context from `node scripts/load_mcp_skill_context.mjs --print-path`
1. overview and integration content in `llms-full.txt`
2. API reference content in `llms-full.txt`
3. local docs and schemas related to:
   - `POST /order/payment-session`
   - `GET /order/payment-session/{sessionId}`
   - `WEBHOOK customer.verify`

For merchant skill for generic agent integration, read:

1. the MCP payment contract context from `node scripts/load_mcp_skill_context.mjs --print-path`
1. overview and integration content in `llms-full.txt`
2. API reference content in `llms-full.txt`
3. local docs and schemas related to:
   - `POST /order/payment-session`
   - `GET /order/payment-session/{sessionId}`
   - `WEBHOOK customer.verify`
4. the local merchant skill for generic agent integration module for runtime-contract, callback, adapter, and resume requirements

## Precision Rules

- for every task that needs official docs, run the freshness check command before reading cached docs
- refresh the cached official docs before use if the cache is older than 7 days
- if the user explicitly asks to refresh docs, force-refresh before continuing
- use the freshest cached `llms-full.txt` before naming exact endpoints, fields, schemas, or webhook events
- use the freshest available MCP payment contract context before naming exact MCP tools, `next_action` types, handoff ownership rules, notification directives, or review findings about the `clink-payment` skill and the `clink` MCP server
- do not infer a public API exists unless local docs support it
- if local docs are incomplete, state that clearly

## Bilingual Rule

If the user wants Chinese or bilingual output, also inspect:

- the relevant Chinese or bilingual sections available in the official docs cache
