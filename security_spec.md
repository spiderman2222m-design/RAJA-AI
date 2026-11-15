# APNA RAJA AI — Firestore Security Specification

## 1. Data Invariants
1. A `UserProfile` at `/users/{userId}` can only be read by its owner (`request.auth.uid == userId`) or an Admin (`isAdmin()`). On creation, `role` MUST be `'user'`, `plan` MUST be `'free'`, `isBlocked` MUST be `false`, and `uid` MUST match `request.auth.uid`.
2. Non-admin users cannot elevate `role`, modify `isBlocked`, or change `plan` without an atomic batch write creating a corresponding `PaymentRecord` at `/payments/{paymentId}` (`existsAfter`).
3. Every `Conversation` at `/conversations/{conversationId}` must have `userId == request.auth.uid` on create, `userId` is immutable on update, and `list` queries are strictly filtered by `resource.data.userId == request.auth.uid || isAdmin()`.
4. Every `Message` at `/conversations/{conversationId}/messages/{messageId}` must verify via `get()` that the parent `/conversations/{conversationId}` exists and belongs to `request.auth.uid`.
5. Every `Creation` at `/creations/{creationId}` belongs strictly to `userId == request.auth.uid` and cannot exceed string length limits.
6. Every `PaymentRecord` at `/payments/{paymentId}` is immutable once created (`allow update, delete: if false` for non-admins) and requires `status == 'verified'` and valid `signature` length.
7. `AppSettings` at `/app_settings/{settingId}` is readable by verified signed-in users and writable strictly by `isAdmin()`.
8. `AdminRecord` at `/admins/{adminUid}` is readable/writable strictly by `isAdmin()`, with bootstrapped owner `spiderman2222m@gmail.com` (`email_verified == true`).

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read on `/users/{uid}`**: `request.auth == null` -> Denied.
2. **Self-Admin Escalation on `/users/{uid}` create**: `{ ..., role: 'admin', plan: 'free' }` by regular user -> Denied.
3. **Self-Plan Escalation on `/users/{uid}` create**: `{ ..., role: 'user', plan: 'premium_yearly' }` -> Denied.
4. **Shadow Update on `/users/{uid}`**: Updating `displayName` + injecting `{ isVerified: true }` -> Denied by `affectedKeys().hasOnly()`.
5. **Unverified Email Spoofing**: `request.auth.token.email == 'spiderman2222m@gmail.com'` with `email_verified == false` -> Denied by `isVerified()`.
6. **Cross-User PII Read**: User B calls `get(/users/UserA)` -> Denied.
7. **Orphaned Message Injection**: User B creates `/conversations/convA/messages/msg1` where `convA` belongs to User A -> Denied by parent `get()`.
8. **Client-Side Timestamp Forgery**: Creating a conversation with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> Denied.
9. **ID Poisoning**: Creating `/conversations/abc...200chars` -> Denied by `isValidId()`.
10. **Immutable Owner Tampering**: Updating `conversation.userId` to another UID -> Denied.
11. **Plan Upgrade Without Atomic Payment**: User updates `plan: 'premium_monthly'` without creating `/payments/$(lastPaymentId)` in same batch -> Denied by `existsAfter()`.
12. **Non-Admin Modifying App Settings**: Regular user updates `/app_settings/global` -> Denied by `isAdmin()`.
