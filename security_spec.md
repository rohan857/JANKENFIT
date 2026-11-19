# JANKENFIT Firestore Security Specification

## 1. Data Invariants

1. **Strict Owner Isolation (PII Protection):** Document `/users/{userId}/wellness/state` contains personal email and health metrics. Only `request.auth.uid == userId` may `get`, `create`, `update`, or `delete` it. No cross-user read or `list` queries are permitted.
2. **Fixed Document Identity:** Only document ID `state` is permitted under `/users/{userId}/wellness/{docId}`, and path `userId` must satisfy `isValidId(userId)`.
3. **Owner UID Binding:** `incoming().uid` must strictly equal `userId` and `request.auth.uid` on creation, and `uid` is immutable on update (`incoming().uid == existing().uid`).
4. **No Shadow Fields:** Top-level keys are strictly allowlisted via `hasAll` + `hasOnly` on create and `affectedKeys().hasOnly(...)` on update.
5. **Bounded Collections & Strings (Denial-of-Wallet Guard):** Every string has an explicit `.size()` ceiling, and every array (`vitalsHistory`, `nutritionLogs`, `workoutSessions`, `dailyHistory`, `tasks`, `wellnessLogs`, `dietAdherenceIds`) enforces strict `.size() <= MAX` limits.
6. **Temporal Integrity:** `createdAt == request.time` on create and immutable on update; `updatedAt == request.time` on both create and update.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)

1. **Unauthenticated Read:** `GET /users/userA/wellness/state` with `auth = null`.
2. **Cross-User PII Read:** `GET /users/userA/wellness/state` authenticated as `userB`.
3. **Collection Enumeration (`list`):** `LIST /users/userA/wellness` authenticated as `userA` or `userB`.
4. **Cross-User Write / Identity Spoofing:** `CREATE /users/userA/wellness/state` as `userB` with `uid: "userA"`.
5. **Body UID Mismatch:** `CREATE /users/userA/wellness/state` as `userA` with `uid: "userB"`.
6. **Invalid Document ID Injection:** `CREATE /users/userA/wellness/evilDoc` as `userA`.
7. **Shadow / Ghost Field Injection:** `CREATE` or `UPDATE` including extra field `isAdmin: true`.
8. **Immutable Field Tampering (`uid`):** `UPDATE` changing `uid` from `"userA"` to `"userB"`.
9. **Immutable Timestamp Tampering (`createdAt`):** `UPDATE` modifying `createdAt`.
10. **Forged Client Timestamp (`updatedAt`):** `CREATE` or `UPDATE` supplying an arbitrary client date instead of `request.time`.
11. **Array Exhaustion (Denial-of-Wallet):** `UPDATE` submitting `vitalsHistory` with > 50 items or `dietAdherenceIds` with > 10 items.
12. **Oversized String Poisoning:** `UPDATE` submitting `profile.name` with length > 100 or `activeDateKey` failing `YYYY-MM-DD` regex.
