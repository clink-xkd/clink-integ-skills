# Clink MCP Agent Integration

## Scope

This module covers the agent-facing Clink MCP path: Wallet Service, UCP Checkout,
Browser Pay, OAuth/PKCE, and recovery of long-running Operations. It is separate from
merchant-side REST/CLI integration. A merchant backend still owns its products, orders,
fulfillment, and webhook reconciliation; the MCP connection authorizes an agent to act for
the user's wallet. The live `clink://skill/rules` resource is authoritative for current MCP
schemas; local guidance must not override it. Merchant webhooks still use raw-body HMAC and
constant-time signature comparison.

## Connection and OAuth

Use the selected environment's MCP resource:

```text
Sandbox:    https://uat-api.clinkbill.com/mcp
Production: https://api.clinkbill.com/mcp
```

The OAuth `resource` and token `audience` must exactly equal that MCP URL. MCP configuration
contains only the server address; never put an API key, access token, or refresh token in it.
Use Authorization Code with PKCE (S256), a cryptographically random `state`, and a stored
per-user `code_verifier`. Read Protected Resource Metadata and Authorization Server Metadata
before choosing authorization and token endpoints. CIMD, pre-registration, and DCR are valid
client registration methods; DCR is used only when metadata exposes `registration_endpoint`.
Register one client per host/deployment/tenant and reuse its `client_id`; authorize each user
separately and store tokens per user.

Request only the scopes needed by the flow. Common scopes are:

```text
wallet:read wallet:setup payment:execute instruction:read instruction:write
refund:read refund:write events:read events:consume offline_access
```

## Wallet and purchase authorization

Read current wallet state with `get_account_state` before presenting card choices. A card's
`agent_pay_support` flag is evidence for Browser Pay eligibility, not a promise that a merchant
will accept it. `set_default_card` changes the default only when the user asks. For explicit
spending authorization use `create_purchase_instruction`, then continue the returned Operation
through its current `next_action`.

The closed `next_action` set is `PROVIDE_INPUT`, `CONFIRM`, `REDIRECT_USER`, `SETUP_REQUIRED`,
`POLL_OPERATION`, `WAIT_OPERATION`, and `CONTACT_SUPPORT`. Branch on `type` only. A missing
`next_action` means the Operation is terminal; do not invent a `NONE` action. If a write times
out after returning an Operation ID, call `get_operation` for that same ID before deciding
whether anything happened.

## UCP Checkout

For UCP, discover products with `discover_catalog`, obtain exact product details with
`get_product`, and create checkout with `create_checkout`. A search result is not authorization
to buy. `create_checkout` prepares the checkout; it does not complete payment. Continue through
the live `CONFIRM` action with `update_checkout`, then call `complete_checkout` using the current
`operationId`, `actionId`, and `expectedRevision`. Do not submit a replacement amount or card to
`complete_checkout`.

Use the UCP order ID returned in `resources.ucp_order_id` with `get_order`, and wait for digital
delivery with `wait_for_digital_delivery` when required. UCP order IDs and Clink direct-payment
Order IDs are different records; do not use a UCP ID with direct-payment refund tools. UCP
Checkout has no general order-cancel or refund operation in this tool set.

## Browser Pay

`get_credential` issues a single-use credential for the exact merchant checkout facts: HTTPS
`merchantUrl`, final amount in minor units, uppercase ISO currency, and optional products,
shipping address, and selected `paymentInstrumentId`. The credential proves issuance only; it
does not prove that the merchant accepted the payment. Fill the credential into the merchant
checkout, observe the merchant result, then call `confirm_result` with `orderId`,
`paymentExecutionDetailId`, the issuing `operationId`, and outcome `SUCCEEDED`, `FAILED`,
`NOT_SUBMITTED`, or `UNKNOWN`.

After `SETUP_REQUIRED`, repeat `get_credential` with the same checkout facts and selected card;
do not replay a stale setup action. If a submitted result is unclear, report `UNKNOWN` and
resolve that same merchant transaction. Never start another payment because credential issuance,
result reporting, or a network request timed out. `confirm_result` is only for Browser Pay, not
UCP Checkout or direct payment tools.

## Ownership and fail-closed rules

- The user and merchant own the business decision, final amount, fulfillment, and observed
  merchant result.
- Clink MCP owns wallet authorization, Operations, credential issuance, and tool-level payment
  state.
- The agent owns presenting the current action, obtaining explicit confirmation, and resuming
  the same Operation or checkout after user action.

Keep one payment intent owner for the entire goal. A timeout or unknown result is not a failure
and is not permission to switch to a legacy CLI or start a second charge. Re-read the Operation,
resolve the existing Browser Pay report, or query the merchant transaction first.
