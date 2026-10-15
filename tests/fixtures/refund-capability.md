This response is routed to merchant standard integration for checkout, webhook, and refund planning.

Model refund as a refund lifecycle. Use the documented `POST /refund` with `orderId`,
`refundMerchantOrderId`, and `refundAmount`; reuse `refundMerchantOrderId` for idempotency.
Cover `GET /refund/{id}`, dashboard-issued refunds, `refund.created`, `refund.succeeded`, and
`refund.failed` webhook handling, insufficient balance, and eligibility behavior.

