# Seller Messages – Schema Notes

The seller messages feature uses the same **conversations** and **messages** tables as the buyer portal. Seller dashboard uses **seller–buyer** threads only (no lender).

## Your schema (after migration)

**conversations:** `id`, `lender_id`, `seller_id`, `financing_request_id`, `user_id` (nullable after migration), `buyer_uuid` (added in migration), `is_active`, `last_message_at`, `last_message_preview`, `created_at`, `updated_at`. Constraint: at least one of `lender_id` or `seller_id` must be set.

**messages:** `sender_type` IN ('user', 'lender', 'seller'), `sender_id` text, etc.

Run the migration in `docs/conversations_seller_buyer_migration.sql` to add `buyer_uuid` and make `user_id` nullable so seller-initiated threads can be created before the buyer opens the conversation.

## Seller API (seller dashboard)

- **List:** filter by `seller_id = current seller`.
- **Create:** set `seller_id`, `buyer_uuid`, `user_id: null`, `last_message_at`, `last_message_preview`, `is_active`, `updated_at`.
- **Open by buyer:** find conversation where `seller_id = current seller` and `buyer_uuid = buyer_id` (from analytics).

## Buyer API (buyer portal)

- **List:** returns both lender conversations (via `financing_request_id`) and seller conversations (where `seller_id` is set and `buyer_uuid` or `user_id` matches the current user).
- **Get or create:** when `seller_id` is in the query, find or create a conversation with that seller and current buyer (`buyer_uuid`, `user_id`), return `openConversationId`.

## Auth

- Seller: `Authorization: Bearer <seller_uuid>` (from `seller_user` in localStorage).
- Buyer: `Authorization: Bearer <user_uuid>` (from auth).
