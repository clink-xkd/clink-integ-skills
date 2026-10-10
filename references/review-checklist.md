# Review Checklist

Use this checklist after drafting a standard integration plan, a merchant skill for generic agent integration plan, a merchant skill for OpenClaw integration plan, or a doc-based answer.

This file is for final review and self-check. It is not the primary workflow document.

## Global Checks

- does the output stay aligned with the local Clink docs available in the current environment
- for OpenClaw agent review, did the review load and read the MCP payment contract through `node scripts/load_mcp_skill_context.mjs --print-path`
- for generic agent review, did the review load and read the MCP payment contract through `node scripts/load_mcp_skill_context.mjs --print-path`
- if the MCP payment contract context fell back to local files, does the output disclose that exact MCP tool behavior is not confirmed latest, and does it treat `clink://skill/rules` as the runtime authority
- are exact API claims backed by `api-reference/openapi.json`
- does the output avoid inventing undocumented behavior
- is the scenario routing correct

## Standard Integration Checks

- did the design identify the backend language or ask for it when needed
- did the design clarify registered vs non-registered product mode
- for registered product mode, does it explain where active `productId` and `priceId` come from
- when existing site products, prices, or subscriptions exist, does it use agent-discovered `clink-catalog.json` plus `clink catalog validate/plan/import` instead of manual ID copying
- does product discovery inspect running APIs/pricing DOM before source/configuration, and ask the user only after those sources are exhausted
- does the generated `clink-catalog.json` include one product image source per product: `imageId`, `imageUrl`, or `imageFile`
- does it avoid putting URL strings in `imageId`, using `imageUrl` for URLs and `imageFile` for local public/static assets
- for non-registered product mode, does it explain how merchant-defined line items are built into `priceDataList`
- for non-registered product mode, does it keep merchant-specific business inputs in the merchant order model
- does it preserve trusted local `clink checkout` full-payload operation while limiting generated public starters to a server-defined `priceKey` or `planKey`
- for generated public starters, are amount, currency, product/price IDs, `merchantReferenceId`, return URLs, and payment settings server-authoritative rather than accepted from the client
- for subscription purchases, does it explain whether the flow should create a new checkout session or route to customer portal
- does checkout map merchant `order_id` to `merchantReferenceId`
- does the design avoid treating `merchantReferenceId` as an idempotency key
- does the design keep `originalAmount` aligned with the merchant-defined checkout payload
- does a complete charging/subscription implementation use `clink webhook endpoint ensure --events commerce --save-secret --json`, with only scenario-safe narrower scopes (`checkout,disputes`; at least `checkout,subscriptions,disputes`; optional `payment-methods`)
- does review inspect the actual endpoint command, verify runtime Catalog validation and default merge semantics, and allow `--allow-remove-events` only for explicit replacement
- does stable `commerce` remain 31 events without silently adding a future `payment_method.deleted`
- if `core` appears for compatibility/minimal demo, is it beside its exact events (`session.complete`, `order.succeeded`, `order.failed`, `refund.succeeded`, `subscription.created`, `invoice.paid`), the omissions `order.created`, `order.next_action`, `subscription.cancelled`, `subscription.past_due`, `subscription.updated.*`, `invoice.open/void`, `dispute.*`, `refund.created`, `refund.failed`, `session.expired`, and a migration recommendation to `commerce`
- when Dashboard webhook visibility or manual fallback is mentioned, does the output identify `Merchant Dashboard > Developers > Webhooks` while keeping `clink webhook endpoint ensure` as the default path
- does webhook setup sync the returned or rotated signing secret into the merchant runtime as `CLINK_WEBHOOK_SIGNING_KEY`
- for local `.env` apps, does webhook setup use `clink webhook endpoint ensure --save-secret --sync-env-file <env-file>` or an equivalent automated env write
- does webhook setup restart or redeploy the service after syncing the signing secret
- does webhook setup explain that URL changes require rerunning endpoint ensure and resyncing the signing secret
- does the output avoid asking for `CLINK_WEBHOOK_SIGNING_KEY` as an initial user-provided secret
- for local desktop setup without an existing Secret Key, does it use the offline bundled CLI and attempt the human-assisted `clink login` path only when optional Playwright browser support is already provisioned offline, then run `clink dashboard apikey ensure-secret --save --json`
- for cloud, low-code, sandbox, or browserless setup, does it ask only for `CLINK_SECRET_KEY` and then use `clink auth secret set --api-key env:CLINK_SECRET_KEY --env sandbox`
- does it verify the CLI request domain with `clink env list` or `clink env show <name> --json` before write commands
- if a custom request domain is needed, does it use `clink env add <name> --api-base-url <url>` and then `--env <name>` or `CLINK_ENV` instead of scattering raw URLs through generated code
- are `--base-url` and `CLINK_BASE_URL` treated as documented one-off overrides, not as a way to bypass production validation
- does authenticated `clink api request` receive only a relative path below the configured base, with no absolute URL, scheme-relative URL, backslash, parent traversal, origin override, or base-path escape
- after `CLINK_SECRET_KEY` is configured, does it avoid requiring a Dashboard Console token for catalog import, checkout/subscription APIs, webhook endpoint management, doctor, smoke-test, or local webhook commands
- when a Secret Key is requested or configured, does the output tell the user to get it from `Merchant Dashboard > Developers > API Keys` by clicking `Initialize Key`, copying it once, and storing it securely
- does the output avoid asking the user to paste real webhook signing keys or Secret Keys into chat, generated source code, docs, logs, or public repositories
- on POSIX systems, are CLI profiles and `.env` files that contain secrets required to have mode `0600`, including after updating an existing broader-permission file
- does webhook coverage include subscription lifecycle events when the product mode is subscription-based
- does webhook coverage include `order.refunded` or equivalent refunded-state handling when that state exists in the merchant order model
- does webhook implementation include signature verification, idempotency, retry handling, and out-of-order tolerance
- does signature verification use the unmodified raw body before parsing or normalization
- does the handler accept only integer second or millisecond `X-Clink-Timestamp` values within a 300-second past-or-future window
- does canonical fixture guidance require `event_`, `object: "event"`, integer millisecond `created`, object-valued `data.object`, Invoice `items`, and no default outer `livemode`
- are malformed payloads and unknown event types rejected with non-2xx responses and retries deduplicated through a durable Inbox keyed by `event.id`, including inside the timestamp window
- is `--fixture-profile legacy` explicit and deprecated, and are fixture/simulate/local replay results identified as local inputs rather than Clink server events and kept distinct from real Clink sandbox Merchant Webhook UAT
- does webhook reconciliation match both `merchantReferenceId` and `sessionId` when both are available, and quarantine mismatches instead of relying on one field
- does the design avoid treating `successUrl` as the only confirmation signal
- does real-payment validation require local order paid/completed plus entitlement/fulfillment completion, not just webhook HTTP 200
- after a sandbox integration is ready for card-binding payment testing, does the final delivery remind the user about test card `4242424242424242`, any 3-digit CVC, and any future expiry date without presenting it as production guidance
- does the design clearly separate payment confirmation from merchant fulfillment when downstream delivery exists
- does refund handling use documented `POST /refund` with `refundMerchantOrderId` idempotency, `GET /refund/{id}`, and `refund.created`/`refund.succeeded`/`refund.failed` lifecycle events

## Elements Integration Checks

- does Elements guidance treat Elements as an embedded payment component, not a hosted checkout page
- does it avoid making modal checkout the default layout
- does it identify inline, modal, drawer, multi-step, or headless host UI as the selected layout when layout matters
- does it confirm the frontend framework or ask for it before framework-specific code
- does it confirm backend-created checkout session before `loadClinkElements`
- does it confirm the checkout session is intended for Elements rather than hosted checkout, including `uiMode: "elements"` and a `returnUrl` containing `{ELEMENTS_SESSION_ID}`
- does it keep order creation and checkout session creation on the server
- does it keep Secret Key and webhook signing key out of frontend code
- does it ensure Next.js or similar framework examples are browser-only where SDK DOM access is required
- does it use frontend-safe `publishKey`, `environment`, and `sessionId` for `loadClinkElements`
- does it create `paymentMethod` before `currencySelect`
- does it avoid creating duplicate element types from one SDK instance
- does it call `destroy()` during component teardown and when `sessionId` changes
- does it handle async initialization completing after component unmount
- does it map `submit-enabled` as "can submit", not "disabled", using `disabled = !enabled` for disabled UI
- does it handle `submit-visible` so host buttons do not conflict with built-in third-party payment buttons
- does it treat `amount-change` as the source for displayed amount, product, promotion, and tax UI
- does it treat `session-success` and `session-pending` as frontend UX signals only
- does it keep webhook-driven backend state as the authoritative payment confirmation
- does it handle known SDK errors and give the user a retry or session recreation path
- does it document whether SDK skeleton or host skeleton is used
- does it check host containers for stable sizing, scrolling, and mobile button placement
- does it inspect the merchant site's colors, design tokens, CSS variables, theme config, computed styles, and radius scale, then map them into Elements `presetOptions`

## New User Onboarding Checks

- does onboarding guidance load official docs before giving exact dashboard paths or setup steps
- does it default setup and first checkout guidance to `sandbox`
- does it explain invited-user verification, password setup, and MFA without asking for sensitive values
- does it tell the user to confirm merchant selection and merchant profile under `Settings > Merchant`
- does it explain team access through `Settings > Users` and avoid giving Developer access to roles that docs say do not have it
- does it include Secret Key retrieval through `Merchant Dashboard > Developers > API Keys` and `Initialize Key`
- does it include a scenario-safe CLI webhook endpoint ensure command (default `commerce`) and signing-secret sync instead of defaulting to manual Dashboard webhook setup
- does it distinguish registered product mode from non-registered product mode before first checkout setup
- does it explain that subscription recurring payments require pre-created products according to the checkout docs
- does it route the user to standard integration, generic agent integration, OpenClaw integration, or validation after onboarding
- does it avoid inventing KYB, KYC, production activation, payout, or merchant approval details beyond docs-confirmed facts

## Merchant Skill for OpenClaw Integration Checks

- does the design use the `clink-payment` skill and the `clink` MCP server for the OpenClaw payment skill path
- does the design align exact MCP tool names, `next_action` handling, return directives, and notification ownership with the loaded `clink-payment` MCP payment contract
- does the merchant skill call, handle, and resume according to the loaded `clink-payment` MCP contract without adding duplicate payment-layer behavior
- does the design clearly distinguish merchant skill from the Clink MCP payment layer
- does it define merchant server responsibilities
- does it include agent payment session creation/querying
- does it clarify whether the flow is session mode or direct mode
- does it define merchant integration metadata such as `server`, `confirm_tool`, and `confirm_args`
- does it include email verification handling via `customer.verify`
- does it define payment handoff ownership
- does it preserve the structured payment handoff contract instead of paraphrasing it
- does it separate payment-layer success from merchant-layer confirmation result
- does it call or describe merchant confirmation exactly once per payment result unless retry is explicitly required
- does it define merchant confirmation and task resume behavior

## Merchant Skill for Generic Agent Integration Checks

- does the design identify that the runtime is not OpenClaw when taking the merchant skill for generic agent path
- does it define merchant skill or merchant tool responsibilities before delegating to the generic agent runtime or adapter
- does the design use the `clink-payment` skill and the `clink` MCP server as the generic agent payment layer
- does the design read `clink://skill/rules` once per session before any workflow beyond pure Catalog reads, and treat the server rules as authoritative over any local skill text
- does the design align exact MCP tool names, `next_action` handling, refund behavior, and payment-method freshness rules with the loaded MCP payment contract
- does the merchant skill or adapter call, handle, and resume according to the loaded `clink-payment` MCP contract without assuming OpenClaw runtime behavior
- does it branch only on the closed `next_action` type set and handle `PROVIDE_INPUT`, `CONFIRM`, `REDIRECT_USER`, `SETUP_REQUIRED`, `POLL_OPERATION`, `WAIT_OPERATION`, and `CONTACT_SUPPORT`
- does it present the frozen `CONFIRM` summary verbatim before exactly one `execute_payment` call per intent
- does it require payment-method freshness through `get_account_state` instead of trusting a cached payment-method list
- does it route payment-method setup, replacement, default selection, and removal through `start_payment_method_action`, then re-read `get_account_state`
- does it use `prepare_payment` in direct or session mode, and never send an amount in session mode
- does it require `list_spendable_instructions` and an `ACTIVE` instruction before spending that needs pre-authorization
- does it use `get_operation` as the only recovery path after a timeout, restart, or missed notification
- does it treat an Operation-recovery timeout as unknown rather than failed and avoid retrying execution
- does it require an explicit refund request and the original order id, then follow `start_refund` → `CONFIRM` → `execute_refund` and read `get_refund` for the authoritative provider state
- does the design keep one payment, checkout, refund, or instruction goal on exactly one in-flight Operation, with no second prepare or execute while it is non-terminal
- does it prevent retrying execution after a timeout, transport failure, unknown result, or OAuth step-up, and recover the existing Operation instead
- does it define the agent runtime contract instead of assuming OpenClaw-specific session, memory, tool, or resume behavior
- does it clarify session mode, direct mode, or adapter mode
- does it support merchant `402 Payment Required` handoff when the merchant uses that protocol
- does a merchant-originated payment handoff include structured `payment_required` data, exact payment parameters, correlation data, and a retry or resume target
- does it define how the generic agent invokes the `clink` MCP server or the adapter around it
- does it prevent invented payment parameters and require explicit authorization before charge execution
- does it define the payment handoff contract and preserve it as structured data
- does it include merchant confirmation ownership and exactly-once or idempotent confirmation behavior
- does it define callback, polling, queue, or recovery behavior for asynchronous payment completion
- does it define task resume behavior after merchant confirmation
- does it separate merchant skill or tool, agent runtime, adapter, merchant server, the `clink` MCP server, webhook handler, notification sender, and recovery ownership
- does it include `customer.verify` handling when email verification is in scope

## Documentation Checks

- is the structure modular and easy to extend
- is the main `SKILL.md` concise
- are detailed workflows moved into reference modules
- are English and Chinese docs aligned when both are updated
- do validation-heavy answers point to generated artifacts or lint reports when that would help the developer more than prose

## Current API and MCP Checks

- do API examples send X-API-Key and a fresh millisecond X-Timestamp?
- does webhook verification check X-Clink-SignType: SHA256, HMAC SHA-256, and a constant-time comparison over the raw body?
- does the order model subscribe to order.created and order.next_action, keep one row per payment attempt, and separate Session lifecycle from payment status?
- does retry exhaustion persist a dead-letter/outbox record and trigger active reconciliation?
- when MCP is in scope, does the review cover Wallet, UCP Checkout, Browser Pay, OAuth/PKCE, purchase instructions, closed next_action handling, and same-Operation recovery?
