# Merchant Skill for OpenClaw Integration

## Definition

Merchant skill for OpenClaw integration means the merchant's own OpenClaw agent or merchant skill integrates with the Clink MCP server to gain OpenClaw-native payment and payment handoff capability.

The core scope of this path includes:

- OpenClaw merchant skill integration
- merchant backend webhook support for email verification via `customer.verify`
- merchant confirmation after payment handoff
- task resume after merchant confirmation succeeds

This is different from standard integration.

The merchant side does not rebuild the full payment infrastructure itself. Instead:

- the Clink MCP server handles payment infrastructure and payment execution
- the merchant side handles its own business preparation, confirmation, and task recovery

This path is specifically for OpenClaw. For merchant skill for generic agent integration, use `references/generic-agent-integration.md`.

The payment-layer contract is not restated here. `references/clink-mcp-payment-skill.md` is the canonical local contract for the Clink MCP payment layer: environments and exact endpoints, the connection and installation contract, the `next_action` contract, tool routing, refunds, and the money-safety guardrails. The server rules supersede both that module and this one.

## Environment And Connection

- one `clink` MCP connection per environment, streamable HTTP, OAuth
- sandbox -> `https://api.clinkbill.dev/mcp`
- internal UAT -> `https://uat-api.clinkbill.com/mcp`
- production -> `https://api.clinkbill.com/mcp`
- the MCP payment skill is named `clink-payment`
- `openclaw-payment-skills` is the legacy CLI distribution; the MCP skill and that legacy package may be co-installed, but a single goal must bind to exactly one execution owner (`legacy_cli` or `mcp`) and keep that binding until the goal is terminal

Before the first Clink call in a goal, verify the effective `clink` connection URL against the environment resolved for that goal. Never silently switch environments and never create a second `clink` entry.

## Main Responsibilities

Before generating code or reviewing an implementation for this path, run `node scripts/load_mcp_skill_context.mjs --print-path` and read the printed context, then read `references/clink-mcp-payment-skill.md`. Treat this module as integration guidance, and treat the server-authoritative `clink://skill/rules` resource — or `get_skill_manifest` with `include_rules: true` when the Host cannot read MCP resources — as the current source for exact tool names, merchant integration metadata, notification routing, `next_action` handling, and ownership boundaries. The latest available Clink MCP payment context is a design aid; the server rules win when the two disagree.

### Merchant Skill / Agent

The merchant skill should:

- detect when payment or recharge is needed
- prepare payment-related business context
- call the Clink MCP payment tools, starting from `prepare_payment`
- consume the payment handoff
- pass the payment handoff into the merchant confirmation path exactly as required by the merchant integration contract
- resume the original task after merchant confirmation succeeds

### Merchant Server

The merchant server should:

- create the agent payment session or payment order intent
- query the payment session when needed
- handle `customer.verify` webhook events for email verification
- run merchant confirmation logic after payment handoff
- support task recovery after payment success
- provide the merchant integration identity or server contract used to route confirmation correctly

### Clink MCP Payment Skill

The `clink-payment` skill and the `clink` MCP server should handle:

- payment infrastructure
- wallet and payment method setup
- payment execution
- payment-layer notifications
- payment handoff output

Do not re-implement payment-layer rules inside the merchant skill. When a live `next_action` and a local document disagree about what to do next, the live `next_action` wins.

## Integration Modes

Merchant skill for OpenClaw integration should usually describe which of these modes applies:

### Session Mode

Use this mode when the merchant server creates a payment session first and returns a `sessionId` to the merchant skill.

Expected behavior:

- merchant server creates the payment session before payment execution
- the merchant skill calls `prepare_payment` with `mode: "session"` and the opaque `sessionId`
- only the opaque merchant `sessionId` is frozen; do not send an amount, and do not restate merchant, amount, or currency as though Clink MCP verified them
- amount, currency, and merchant validation are already bound to that session on the merchant side

### Direct Mode

Use this mode when the merchant skill or merchant server provides merchant payment inputs directly.

Expected behavior:

- the merchant skill calls `prepare_payment` with `mode: "direct"` and merchant payment inputs such as merchant id, minor-unit amount, and currency
- merchant defaults must come from merchant configuration or current-turn user input
- do not invent amount or merchant identity from memory

Both modes follow the same `prepare_payment` -> `CONFIRM` -> `execute_payment` path, and execute accepts only the frozen confirmation's `operationId`, `actionId`, and `expectedRevision`.

## Backend Capability Requirements

The merchant server should be designed around these backend capabilities:

- `POST /order/payment-session`
- `GET /order/payment-session/{sessionId}`
- `WEBHOOK customer.verify`

Do not describe this path as a plain checkout redirect flow.

## Merchant Payment Handoff Contract

The merchant skill should pass explicit merchant integration metadata into the payment handoff so the payment layer knows how to route post-payment confirmation.

A robust merchant skill for OpenClaw integration should usually define:

- merchant integration identity such as `server`
- merchant confirmation entry such as `confirm_tool`
- merchant confirmation parameters such as `confirm_args`

When payment succeeds, the payment handoff should be treated as a structured merchant confirmation input, not as an informal chat message.

The handoff payload often needs fields such as:

- `order_id`
- optional `session_id`
- notify target or channel context
- any other merchant confirmation fields required by the merchant integration

Do not strip, rewrite, or paraphrase the payment handoff before merchant confirmation unless the merchant contract explicitly allows it.

## Core Flow

1. merchant agent detects a payment requirement
2. merchant side creates payment session or payment intent
3. merchant side calls `prepare_payment` with prepared context and merchant integration metadata
4. the Clink MCP payment layer executes the payment flow through the frozen confirmation
5. the Clink MCP payment layer emits the payment handoff
6. merchant side confirms the business result through the merchant confirmation path
7. merchant side resumes the original pending task

## Recovery Rules

After payment handoff:

- call the merchant confirmation path exactly once for the same payment result unless the merchant contract explicitly requires retry
- let the merchant confirmation path decide merchant-layer success or failure
- resume the original task only after merchant confirmation succeeds

For the payment layer:

- `get_operation` is the only recovery path after a timeout, restart, or missed notification; it is read-only and never moves money
- a payment-layer timeout means the state is unknown, not failed; tell the user plainly what is known and unknown
- never retry an execute call to check whether it worked, and never resume the same goal through the other execution stack
- the legacy `openclaw-payment-skills` CLI stack and the Clink MCP stack may be co-installed but must never be mixed for one goal

In some implementations, a later payment webhook wake may carry only order/session identifiers. The merchant integration should define how that wake maps back to the pending task and confirmation path.

## Ownership Rules

This path should clearly separate ownership between:

- merchant skill
- merchant server
- the `clink-payment` skill and the `clink` MCP server
- webhook handler
- notification sender
- recovery logic

Avoid overlapping responsibility for:

- payment success signaling
- merchant confirmation
- notification sending
- task recovery

Payment-layer success belongs to the Clink MCP payment layer.

Merchant-layer success or failure belongs to the merchant confirmation path.

Do not send duplicate merchant success/failure notifications if the confirmation path already owns and emits them.

## Output Expectations

A good merchant skill for OpenClaw integration output should usually include:

- merchant skill responsibilities
- merchant server responsibilities
- the resolved environment, its exact MCP endpoint, and the `clink` connection name
- session mode vs direct mode selection, and the exact `prepare_payment` mode value
- the goal-scoped execution-owner rule (`legacy_cli` or `mcp`) and how the Host enforces it
- where `clink://skill/rules` is read and why local text is never authoritative
- developer-ready artifacts such as handoff contract skeleton, confirmation checklist, and recovery notes
- payment handoff contract
- merchant integration metadata such as `server`, `confirm_tool`, and `confirm_args`
- email verification handling via `customer.verify`
- recovery, `get_operation`, and resume logic
