This response is routed to merchant standard integration for checkout and webhook validation.

Based on current local docs, the public refund create API is confirmed as `POST /refund` with
`orderId`, `refundMerchantOrderId`, and `refundAmount`; `GET /refund/{id}` retrieves it. Do not
invent fields beyond the documented contract.

