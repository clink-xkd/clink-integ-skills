This review focuses on integration risk.

Check signature handling with `X-Clink-SignType: SHA256`, raw-body HMAC SHA-256 with constant-time comparison,
idempotency, retry behavior, dead-letter recovery, out-of-order delivery, `order.created` and
`order.next_action`, `clink webhook endpoint ensure --events commerce` configuration for complete
charging integrations, `CLINK_WEBHOOK_SIGNING_KEY` sync, and restart or redeploy after secret
changes. The review should call out any risk if those parts are missing and reject a core-only
production design as incomplete.

