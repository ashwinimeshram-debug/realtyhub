# Full-Stack Production Audit Report — Nagpur Realty Hub

**Date:** July 28, 2026
**Scope:** Full codebase audit across Frontend, Backend, and Database layers
**Auditor:** Principal Engineer / Security Auditor / DBA

---

## Executive Summary

### Deployment Status: ⛔ CRITICAL BLOCKERS FOUND

**Do not deploy to production until the CRITICAL items in this report are resolved.**

The application has a solid foundation with good architecture choices (JWT cookie auth, bcrypt hashing, CSRF protection, rate limiting on sensitive endpoints, file upload validation, image preprocessing). However, several classes of issues present unacceptable risk:

- **3 CRITICAL IDOR vulnerabilities** in the leads system allow any authenticated user to read, reassign, and modify interactions on ANY lead.
- **A broken regex-based HTML sanitizer** (`SectionContent.tsx`) is trivially bypassable, leading to stored XSS across the entire public site.
- **No access control on property data** — power_users can modify/delete ANY property, not just their own.
- **Silent `except: pass` blocks throughout the backend** hide database failures, email failures, and data corruption.
- **Plaintext password reset tokens** stored in the database enable full account takeover if the DB is compromised.
- **No pagination on any list endpoint** — guaranteed OOM/timeout as data grows.
- **CSRF token stored in localStorage** defeats the purpose of CSRF protection if any XSS exists.

---

## Layer-by-Layer Findings

---

## 1. Frontend Audit

### 🔴 CRITICAL

#### F1. `SectionContent.tsx` — XSS via Bypassable Regex Sanitizer
- **Location:** `components/SectionContent.tsx:3-13`
- **Impact:** Any admin-stored content (hero titles, sections, FAQ answers) with injected unquoted event handlers executes in every visitor's browser. Full site compromise.
- **Fix:** Replace regex sanitizer with DOMPurify. Never block XSS with regex.

#### F2. Homepage (`page.tsx:149`) — `dangerouslySetInnerHTML` with Weak Regex
- **Location:** `app/page.tsx:143-149`
- **Impact:** Unquoted event handlers bypass the same broken regex pattern. Stored XSS on the homepage for all visitors.
- **Fix:** Use DOMPurify or `SectionContent` sanitizer here.

#### F3. Page Editor (`pages/[slug]/page.tsx:109`) — Zero Sanitization via `dangerouslySetInnerHTML`
- **Location:** `app/admin/(dashboard)/pages/[slug]/page.tsx:107-110`
- **Impact:** CSRF or API injection allows immediate script execution in an authenticated admin's session. Session hijacking.
- **Fix:** Sanitize with DOMPurify even in admin preview, or render inside an iframe with `sandbox`.

#### F4. `lib/api.ts` — CSRF Token Stored in `localStorage`
- **Location:** `lib/api.ts:16-31`
- **Impact:** Any XSS vulnerability anywhere in the app can exfiltrate the CSRF token and perform state-changing requests on behalf of the user. Defeats the entire purpose of CSRF protection.
- **Fix:** Move CSRF token to in-memory variable only (no persistence). Use `SameSite=Strict` cookies with double-submit cookie pattern instead.

### 🟠 HIGH

#### F5. `SectionContent.tsx` — Dangerous Elements Allowed by ALLOWED_TAGS
- **Location:** `components/SectionContent.tsx:3-6`
- **Impact:** `<marquee>`, `<video>`, `<audio>`, `<form action="javascript:...">`, `<meta http-equiv="refresh">`, and custom elements with event handlers can be injected.
- **Fix:** Use an allowlist-based sanitizer (DOMPurify) instead of a blocklist regex.

#### F6. `PermissionGuard.tsx` — Entirely Client-Side Authorization
- **Location:** `components/admin/PermissionGuard.tsx:17-23`
- **Impact:** Non-admin users see admin UI elements (edit/delete buttons). While API-level protection may still apply, the UI leaks feature existence and may enable CSRF-driven actions.
- **Fix:** Remove `PermissionGuard` and let the server decide which UI to render.

#### F7. `add-property/page.tsx:202` — Price Validation Inconsistencies
- **Location:** `app/admin/(dashboard)/add-property/page.tsx:202`
- **Impact:** `"0"` as price passes validation but may be semantically wrong. Type-safety gap if price is number type.
- **Fix:** Convert price to string explicitly before validation; add numeric range check.

#### F8. `SectionForm.tsx` — Format Buttons Enable Arbitrary HTML Injection
- **Location:** `components/admin/SectionForm.tsx:49,55`
- **Impact:** An admin who discovers the `<b>`/`<i>` inject pipeline can inject arbitrary HTML by typing directly in the textarea. Stored XSS if any admin account is compromised.
- **Fix:** Run SectionForm output through DOMPurify before saving; limit allowed tags to `<b>`, `<i>`, `<br>`, `<p>` only.

#### F9. `properties/[id]/page.tsx:121-152` — Stale Closure in Chained Effect
- **Location:** `app/admin/(dashboard)/properties/[id]/page.tsx:121-152`
- **Impact:** Effect reads `form.description` and `form.title` from closure but is missing them in dependency array. Template auto-detection may become incorrect when editing property fields.
- **Fix:** Add `form.description` and `form.title` to the dependency array, or use refs.

#### F10. `home page page.tsx:497-508` — Single Loading State for 8 API Calls
- **Location:** `app/page.tsx:497-508`
- **Impact:** If one API fails fast, `setLoading(false)` fires early when other data hasn't arrived. Sections appear empty while fetches are still in-flight.
- **Fix:** Track loading per-section or use a minimum loading threshold.

### 🟡 MEDIUM

#### F11. `add-property/page.tsx:111-119` — Missing Deps in Reset Effect
- **Location:** `app/admin/(dashboard)/add-property/page.tsx:111-119`
- **Impact:** When `propertyId` changes after creating a property, this effect may not re-run correctly, causing incorrect field reset.
- **Fix:** Add `dynamicFields`, `propertyId` to deps.

#### F12. `ImageUploader.tsx:133-155` — Stale Closure in Drag Handler
- **Location:** `components/ImageUploader.tsx:133-155`
- **Impact:** Dragging images after new uploads may use stale file lists, causing incorrect reorder or data loss.
- **Fix:** Use `useCallback` with full dependency array.

#### F13. `lib/api.ts:79-84` — Weak Property ID Obfuscation
- **Location:** `lib/api.ts:78-96`
- **Impact:** Base64 encoding with static salt is trivially reversible. This is not security — sequential IDs can be enumerated.
- **Fix:** Use real unpredictable UUID or hash for public URLs.

#### F14. `PageSectionsEditor.tsx:126-132` — Silent Save Failure
- **Location:** `components/admin/PageSectionsEditor.tsx:126-132`
- **Impact:** Section reorder/edit failures are invisible to the user. Data loss is silent.
- **Fix:** Show error toast in the catch block.

#### F15. `admin/loading.tsx` & Other Pages — Silent `.catch(() => {})` Everywhere
- **Location:** 15+ locations across all page files
- **Impact:** All API failures are silently discarded. Network issues, server errors, rate limiting all go unnoticed.
- **Fix:** At minimum log to console; show error toast for user-facing actions.

### 🔵 LOW

#### F16. `ChipCheckbox.tsx:13-16` — Recomputes `selectedSet` on Every Render
- **Location:** `components/post-property/ChipCheckbox.tsx:14-16`
- **Fix:** Memoize with `useMemo`.

#### F17. `GalleryPicker.tsx:39-47` — Unnecessary Re-fetch Every Modal Open
- **Location:** `components/admin/GalleryPicker.tsx:39-47`
- **Fix:** Cache files state with short TTL.

#### F18. `add-property/page.tsx:518` — Non-null Assertion on `find()`
- **Location:** `app/admin/(dashboard)/add-property/page.tsx:518`
- **Impact:** Potential runtime crash if template ID is stale.
- **Fix:** Add guard check.

#### F19. `property/[id]/page.tsx:25-28` — Fetches All Property IDs for Prev/Next
- **Location:** `app/property/[id]/page.tsx:25-28`
- **Impact:** Every property detail view downloads all property IDs.
- **Fix:** Fetch only adjacent IDs via dedicated endpoint.

#### F20. `ImageProcessingModal.tsx:89-96` — Potential Object URL Leak
- **Location:** `components/admin/ImageProcessingModal.tsx:94`
- **Impact:** Leaked object URLs on `src` prop change.
- **Fix:** Track `previewUrl` in a ref for cleanup.

---

## 2. Backend Audit

### 2a. `admin_routes.py` (1383 lines — Authentication, Property CRUD, Reports, User Management, Password Reset)

### 🔴 CRITICAL

#### B1. User Enumeration + Silent Email Failure on Password Reset
- **Lines:** 787–810
- **Impact:** Attacker can enumerate which emails are registered (status 404 vs 200). If `mail.send()` fails, the exception is silently swallowed yet "Reset link sent" is returned — misleading the user.
- **Fix:** Return the same generic message regardless. Log the email failure; don't catch silently.

#### B2. Unauthenticated Password-Reset Request Endpoint (Spam/DoS)
- **Lines:** 1114–1128
- **Impact:** No `@jwt_required()`, no CAPTCHA, only 5/hr rate limit. Bots can flood the database with arbitrary reset requests, filling the admin queue.
- **Fix:** Add `@jwt_required()` for authenticated users and/or add CAPTCHA.

#### B3. Power Users Can Modify/Delete ANY Property — No Ownership or Role Check
- **Lines:** 425–539 (`update_property`), 545–556 (`delete_property`), 562–648 (approve/reject/close/feature/verify), 684–730 (upload images)
- **Impact:** A malicious power_user can tamper with any property, impersonate other agents, or delete data they shouldn't have access to. Complete lack of access control for multi-role setups.
- **Fix:** Either enforce `_require_admin()` for destructive operations, or add an ownership check (`Property.uploaded_by == current_admin.id`) for power_user-level access.

#### B4. Broad Silent `try/except: pass` Swallows Critical Errors (Multiple Locations)
- **Lines:** 57-58, 78-79, 106-107, 383-384, 405-406, 458-459, 522-523, 743-744, 807-808
- **Impact:** Hides bugs, database failures, JSON parsing errors, file deletion errors, and email failures. Debugging production issues becomes nearly impossible. Silent data corruption.
- **Fix:** Remove bare `except: pass`. Log the exception with `logger.exception(...)`. Return 500 to client on unexpected failures.

#### B5. `_log_activity` and `_audit_property` Never Commit — Audit Entries Lost on Caller Failure
- **Lines:** 51–58, 61–79
- **Impact:** Both helpers call `db.session.add(...)` but never commit. If the caller's subsequent DB operation fails and rolls back, the audit log entry is silently discarded.
- **Fix:** Commit immediately in the helper for fire-and-forget audit entries, or ensure callers wrap operations in proper transactional blocks.

### 🟠 HIGH

#### B6. N+1 Query Explosion in Agent Performance Report
- **Lines:** 1290–1324
- **Impact:** 7 separate queries per agent. For 50 agents: ~351 database round-trips in a single HTTP request.
- **Fix:** Use `GROUP BY` / aggregate queries (single query with `func.count` grouped by `assigned_to` and status).

#### B7. No Pagination on Any List Endpoint
- **Lines:** 202, 876, 959, 1053, 1138, 660
- **Impact:** Every list endpoint loads the entire table into memory. As data grows, this causes OOM crashes or HTTP 503 timeouts. An attacker can DoS by calling these endpoints repeatedly.
- **Fix:** Add pagination with `?page=&per_page=` and `.paginate()` or `.limit()/.offset()`.

#### B8. Race Condition on Image `order` Assignment
- **Lines:** 529–530, 712–713
- **Impact:** Two concurrent uploads to the same property can read the same `last_image.order` and both assign the same order value. Corrupted image ordering.
- **Fix:** Use `func.max(PropertyImage.order)` or a subquery to compute the next order atomically.

#### B9. Feature Deletion Outside Transaction Boundary
- **Lines:** 451–459
- **Impact:** `PropertyFeature.query.filter_by(property_id=id).delete()` runs immediately. If the subsequent `db.session.add()` loop fails, features are already deleted but new ones aren't added — the exception is silently caught, leaving the property with zero features.
- **Fix:** Wrap delete + re-add in a sub-transaction or savepoint. Log the error instead of `pass`.

#### B10. `status`, `property_type`, `transaction_type` Accept Arbitrary Values
- **Lines:** 439–440, 482, 353–354
- **Impact:** An attacker can set `status` to any arbitrary string like `"deleted"`, breaking downstream logic.
- **Fix:** Validate against a whitelist of allowed values.

#### B11. Password Strength Validation Inconsistent Across Endpoints
- **Lines:** 777 (min 6), 822 (min 8), 975 (none), 1363 (min 8)
- **Impact:** Four different endpoints use three different minimum lengths. User-creation endpoint has NO password length validation.
- **Fix:** Centralize password policy (min 8 chars, complexity checks).

#### B12. File Saved to Disk Before DB Commit — Orphan Files on Rollback
- **Lines:** 413–415, 533–535, 697–701, 724–725
- **Impact:** If the DB commit fails, the file remains on disk with no database record. Disk space wasted over time.
- **Fix:** Save files after commit, or implement a cleanup task.

### 🟡 MEDIUM

#### B13. `/logout` Has No `@jwt_required()` — Token Not Invalidated
- **Lines:** 140–144
- **Impact:** A stolen JWT cookie cannot be invalidated server-side; logout is cosmetic only.
- **Fix:** Consider token blacklist or short expiry + refresh token rotation.

#### B14. CSRF Token Leaked in Login Response Body
- **Lines:** 102–107, 114
- **Impact:** The CSRF token is sent in the JSON response body, trivially accessible to any JS running on the page (or to an XSS attacker).
- **Fix:** Set CSRF token as an HTTP-only cookie, not in the response body.

#### B15. `_require_admin()` Returns `None` — Fragile Contract
- **Lines:** 945–950
- **Impact:** Calls `_require_admin()` but returns `None` instead of aborting. If a developer forgets to check the result, the next line raises `AttributeError`.
- **Fix:** Have `_require_admin()` abort with a 403 response directly, or make it a decorator.

#### B16. Top-Level JSON Arrays on Multiple Endpoints
- **Lines:** 258 (properties), 660 (contacts), 876 (templates), 959 (users), 1053 (features), 1138 (reset requests)
- **Impact:** JSON hijacking vulnerability in older browsers; inconsistent with other endpoints.
- **Fix:** Wrap in `{"properties": result}` etc.

#### B17. `reorder_images` Lacks Input Validation
- **Lines:** 752–759
- **Impact:** If called with `{}` or `null`, will `KeyError` (500) with potential stack trace leak.
- **Fix:** Validate input is a list with required keys; return 400 on invalid input.

#### B18. Login Rate Limiting Per-IP Only, Not Per-Username
- **Lines:** 85–86
- **Impact:** Attacker can rotate IPs (botnet, VPN) and brute-force a specific username without triggering the limit.
- **Fix:** Add per-username rate limiting.

#### B19. Email Sender Address Hardcoded
- **Line:** 804
- **Impact:** Cannot change without code modification.
- **Fix:** Move to `current_app.config["MAIL_SENDER"]`.

#### B20. `ilike` for Admin Lookup in Reset Password — Column Not Indexed
- **Lines:** 1366–1368
- **Impact:** `Admin.email.ilike(...) | Admin.username.ilike(...)` forces full-table scan.
- **Fix:** Lowercase on write, exact match on query.

### 🔵 LOW

#### B21. `_validate_file` Dereferences `file.filename` Without None Check
- **Line:** 29

#### B22. `created_at.strftime` Assumes `datetime` Type
- **Line:** 661

#### B23. Timestamp-Based Filenames Use 1-Second Granularity — Collision Risk
- **Lines:** 413, 533, 694, 723

#### B24. MySQL-Specific `date_format` Not Portable
- **Lines:** 1226, 1253, 1259, 1270

#### B25. Audit Log Query Runs Inline Inside `jsonify()` on Every Property GET
- **Lines:** 313–317

#### B26. Dynamic Imports Inside Functions (`ActivityLog`, `bleach`)
- **Lines:** 45, 53

#### B27. Inconsistent JSON Response Envelope
- **Various lines**

#### B28. `_require_admin` Queries DB Even Though JWT Identity Is Known
- **Lines:** 946–948

#### B29. `update_property` Can Bypass Dedicated Status/Feature/Verify Endpoints' Audit Logging
- **Lines:** 472–482

---

### 2b. Other Route Files

### 🔴 CRITICAL

#### B30. IDOR: Any Executive Can Read Any Lead
- **File:** `routes/leads_routes.py:171-177`
- **Impact:** Any authenticated user can read any lead's details by iterating IDs. No ownership check.
- **Fix:** For non-admin users, add `lead.assigned_to == current_admin.id` filter before returning data.

#### B31. IDOR: Any Authenticated User Can Reassign Any Lead
- **File:** `routes/leads_routes.py:203-219`
- **Impact:** Any JWT holder can change `assigned_to` of any lead. Executives can steal leads assigned to others.
- **Fix:** Restrict to `role == "admin"` only, or require current assignment confirmation.

#### B32. IDOR: Any User Can Add Interactions to Any Lead
- **File:** `routes/leads_routes.py:266-296`
- **Impact:** Any authenticated user can tamper with any lead's history.
- **Fix:** For non-admin users, check `lead.assigned_to == current_admin.id`.

### 🟠 HIGH

#### B33. Silent Data Loss on Field Values / Feature IDs Failure
- **File:** `routes/public_routes.py:103-128`
- **Impact:** If JSON parsing or DB insert for custom field values fails, the entire `try` block is swallowed with `pass`. User receives 201 but submitted data is silently lost.
- **Fix:** Log and return 400 on parse/validation failure.

#### B34. Public Endpoint Exposes ALL Settings
- **File:** `routes/settings_routes.py:29-31`
- **Impact:** `GET /settings` dumps every Setting row (key+value) to unauthenticated visitors. If any sensitive data ever gets stored as a setting, it's leaked publicly.
- **Fix:** Maintain an allowlist of publicly safe setting keys.

#### B35. No Role Check on Lead Status CRUD
- **File:** `routes/leads_routes.py:302-352`
- **Impact:** Any JWT user (including executives) can create, update, delete, and reorder lead statuses — system-wide configuration.
- **Fix:** Restrict status management to `role == "admin"`.

### 🟡 MEDIUM

#### B36. `int()` Cast on Template IDs Without Validation
- **File:** `routes/public_routes.py:66-68`
- **Impact:** Non-numeric values cause 500 error.
- **Fix:** Try/except or validate with `str.isdigit()`.

#### B37. Missing Pagination on Public `GET /properties`
- **File:** `routes/public_routes.py:176`
- **Impact:** Memory bloat, slow responses.
- **Fix:** Add pagination.

#### B38. No Rate Limiting on Public `POST /contact`
- **File:** `routes/contact_routes.py:11`
- **Impact:** Anyone can flood the contact form without restriction.
- **Fix:** Add `@limiter.limit("10/hour")`.

#### B39. Unbounded `days` Parameter in 3 Analytics Endpoints
- **File:** `routes/analytics_routes.py:185,237,299`
- **Impact:** `days=100000` causes heavy DB queries that could crash the DB.
- **Fix:** Clamp: `max(1, min(365, int(...)))`.

#### B40. No Validation on Admin Settings Update
- **File:** `routes/settings_routes.py:40-53`
- **Impact:** Any JWT user can write any key with any value, potentially corrupting application configuration.
- **Fix:** Define schema of known settings with expected types; reject unknown keys.

#### B41. No Role Check on Page Content Editing
- **File:** `routes/pages_routes.py:48-156`
- **Impact:** Any authenticated user (including executives) can modify page content, HTML sections, and team layout settings.
- **Fix:** Add `role == "admin"` check for all write operations.

#### B42. No Uniqueness Check on PropertyType.value
- **File:** `routes/types_routes.py:24-26`
- **Impact:** Duplicate type values break admin UI and logic.
- **Fix:** Check for existing value before insert.

#### B43. Wrong HTTP Status Code 201 for Tracking Endpoints
- **File:** `routes/analytics_routes.py:63,80,96`
- **Impact:** Tracking endpoints return `201 Created` for log writes where no new accessible resource is created.
- **Fix:** Return `200 OK` or `204 No Content`.

### 🔵 LOW

- **B44.** `public_routes.py:87-99` — File upload validates extension only, not content (magic bytes)
- **B45.** `public_routes.py:157-163` — Price filter silently ignores parse failures
- **B46.** `cms_routes.py:133-141` — Reorder silently skips missing IDs
- **B47.** `cms_routes.py:41-56` — No input length validation on CMS fields
- **B48.** `cms_routes.py:245-267` — Media listing lacks pagination
- **B49.** `contact_routes.py:17` — No max-length on `message` field
- **B50.** `testimonial_routes.py:32-33` — No HTML sanitization on testimonial content
- **B51.** `testimonial_routes.py:14` — Public endpoint leaks `is_active` field
- **B52.** `leads_routes.py:193-196` — Double `db.session.commit()`
- **B53.** `pages_routes.py:37-42` — Silent cache invalidation failure
- **B54.** `faq_routes.py:21-22` — No input-length validation on FAQ fields
- **B55.** `faq_routes.py:58-66` — Reorder silently skips missing IDs
- **B56.** `types_routes.py:25-26` — Missing explicit `is_active` default
- **B57.** `gallery_routes.py:23` — No URL validation on `image_url`
- **B58.** `gallery_routes.py:57-65` — Reorder silently skips missing IDs
- **B59.** `team_routes.py:59` — No validation on `social_links` JSON
- **B60.** `team_routes.py:85-93` — Reorder silently skips missing IDs

---

## 3. Database Audit

### 🟠 HIGH

#### D1. `PropertyFeature.feature_id` FK Without `ON DELETE CASCADE`
- **Location:** `models/models.py:269-270`
- **Impact:** Deleting a `PresetFeature` will fail if any property references it.
- **Fix:** Add `ondelete="CASCADE"`.

#### D2. Frontend Checks `p.status === "closed"` but Model Has No Such Status
- **Location:** `frontend/app/admin/(dashboard)/properties/page.tsx:63`
- **Impact:** The "Closed" filter tab ALWAYS shows 0 count and never finds properties. Closure is tracked via `is_closed` boolean, not status.
- **Fix:** Change filter to `p.is_closed === true`.

#### D3. Plaintext Password Reset Token Stored in DB
- **Location:** `models/models.py:90-91` (`Admin.reset_token`)
- **Impact:** Any attacker with SQL access can extract a valid reset token and change any admin's password. Full account takeover.
- **Fix:** Store `hash(token)` instead of the raw token.

### 🟡 MEDIUM

#### D4. Missing FOREIGN KEY Constraints on Critical Columns
- **Location:** `models/models.py` — `Lead.assigned_to` (line 106), `LeadHistory.created_by` (line 141), `LeadHistory.status` (line 137), `Property.overview_template_id` (21), `Property.closing_template_id` (22), `Property.title_template_id` (23)
- **Impact:** Orphaned references, data integrity violations.
- **Fix:** Add `db.ForeignKey(...)` constraints to all of these.

#### D5. `PropertyType.value` and `LeadStatus.name` — No UNIQUE Constraint
- **Location:** `models/models.py:130`
- **Impact:** Code relies on these as lookup keys but DB allows duplicates.
- **Fix:** Add `unique=True`.

#### D6. `PropertyTypeField.field_key` — No Unique on `(property_type_value, field_key)`
- **Location:** `models/models.py:161-162`
- **Impact:** Duplicate field keys per type break dynamic form rendering.
- **Fix:** Add `UniqueConstraint("property_type_value", "field_key")`.

#### D7. Missing Indexes on Frequently Queried Columns
- **Location:** `Contactus.is_read`, `Testimonial.is_active`, `AboutGalleryImage.is_active`
- **Impact:** Queries filtering by these will scan the full table as data grows.
- **Fix:** Add indexes on `contactus.is_read`, `testimonials.is_active`, `about_gallery_images.is_active`.

#### D8. `pool_recycle: 300` — Aggressive Connection Churn
- **Location:** `config.py:68`
- **Impact:** MySQL default `wait_timeout` is 8 hours. Recycling every 5 minutes creates unnecessary connection churn and may hit MySQL connection rate limits under load.
- **Fix:** Increase to `3600` (1 hour).

### 🔵 LOW

- **D9.** `models/models.py:11` — `HeroSlide.title`, `Service.title`, `Advantage.title` should be `nullable=False`
- **D10.** `models/models.py:51` — `PropertyImage.image_url` should be `nullable=False`
- **D11.** `models/models.py:12` — `Property.transaction_type` ENUM includes `"buy"` but it's deprecated and never seeded
- **D12.** `config.py` — No explicit `pool_size` or `max_overflow` (defaults are fine for low traffic but should be tuned for production: `pool_size=10`, `max_overflow=20`)

---

## 4. Cross-Layer Integration

### 🟠 HIGH

#### C1. Properties List Tab "Closed" Uses `status` Instead of `is_closed`
- **Location:** `frontend/app/admin/(dashboard)/properties/page.tsx:63` vs `backend/routes/admin_routes.py:199-258`
- **Impact:** The "Closed" tab and count in the properties list are always 0. Frontend checks `p.status === "closed"`, but backend never sets status to "closed" — it uses `is_closed` boolean. The field `is_closed` IS returned by the API.
- **Fix:** Change frontend to `p.is_closed === true`.

#### C2. No Session Validation on Page Load
- **Location:** `frontend/app/admin/(dashboard)/layout.tsx` — no `/admin/check-auth` call on mount
- **Impact:** If the JWT cookie expires, the frontend doesn't detect it until an API call fails. Users see stale dashboards.
- **Fix:** Call `/admin/check-auth` in the dashboard layout on mount.

### 🟡 MEDIUM

#### C3. Frontend Sends `per_page=200` but Backend Ignored It
- **Location:** `frontend/app/admin/(dashboard)/properties/page.tsx:19` — requests `?per_page=200`
- **Impact:** Backend `/admin/properties` doesn't accept `per_page` — always returns ALL properties. Parameter is silently ignored.
- **Fix:** Add pagination to backend OR remove `per_page` from frontend.

#### C4. Creator Contact Info Fields Auto-Filled but Backend Ignores Them
- **Location:** `frontend/app/admin/(dashboard)/add-property/page.tsx:225-229` vs `backend/routes/admin_routes.py:327-419`
- **Impact:** The form fields "Full Name", "Mobile Number", "Email Address" under "Contact Information" have no effect on the backend. They are sent but the backend always uses the logged-in admin's profile. Confusing UX.
- **Fix:** Either remove these fields from form data submission or allow backend to accept them.

#### C5. CSRF Token Never Cleared on Logout
- **Location:** `frontend/lib/api.ts:28-31`
- **Impact:** Stale CSRF token persists in localStorage indefinitely, even after logout.
- **Fix:** Call `setCsrfToken(null)` on logout.

#### C6. `POST /logout` Has No `@jwt_required()` — Any POST Can Log Out an Admin
- **Location:** `backend/routes/admin_routes.py:140-144`
- **Impact:** CSRF attack on the unprotected logout endpoint can sign out any admin.
- **Fix:** Add `@jwt_required(optional=True)` to at least verify session exists.

### 🔵 LOW

- **C7.** `backend/routes/admin_routes.py:359-361` — Template ID conversion relies on `data.get(...) or None` pattern (empty string is falsy). Fragile.
- **C8.** Price handling mismatch — frontend sends string with possible word multipliers ("crore", "lakh") that admin backend doesn't handle (public endpoint does).
- **C9.** Boolean handling in `update_property()` — sends `"false"` as string from FormData, which fails the `val in (True, "true", "1", 1)` check.

---

## Deployment Readiness Checklist

### Critical Security Fixes
- [ ] Replace `SectionContent.tsx` regex sanitizer with DOMPurify (F1)
- [ ] Sanitize all `dangerouslySetInnerHTML` usages (F2, F3)
- [ ] Move CSRF token from localStorage to in-memory (F4)
- [ ] Fix 3 CRITICAL IDORs in leads_routes.py (B30, B31, B32) — ownership checks on lead read/assign/update
- [ ] Add access control on property CRUD for power_users (B3) — enforce ownership check or admin-only
- [ ] Remove bare `except: pass` blocks and log errors (B4)
- [ ] Fix audit log helpers to commit properly (B5)
- [ ] Fix password reset user enumeration (B1)
- [ ] Add auth to password-reset-request endpoint or add CAPTCHA (B2)
- [ ] Store hashed password reset tokens, not plaintext (D3)

### Core Functional Verification
- [ ] Fix "Closed" tab filter in properties list (C1, D2)
- [ ] Add pagination to all list endpoints (B7)
- [ ] Fix missing init session timeout (C2)
- [ ] Fix stale closure in edit-property template detection (F10)

### Database & Environment Setup
- [ ] Add FK constraints on `Lead.assigned_to`, `LeadHistory.created_by`, `LeadHistory.status`, template IDs (D4)
- [ ] Add UNIQUE constraints on `PropertyType.value`, `LeadStatus.name`, `(property_type_value, field_key)` (D5, D6)
- [ ] Increase `pool_recycle` from 300 to 3600 (D8)
- [ ] Set explicit `pool_size=10`, `max_overflow=20` (D12)
- [ ] Add missing indexes for `contactus.is_read`, `testimonials.is_active`, `about_gallery_images.is_active` (D7)

### Final Pre-flight
- [ ] Remove all `.env` files from version control and add to `.gitignore`
- [ ] Ensure `JWT_COOKIE_SECURE=True` in production
- [ ] Run Alembic migrations (replace `_run_migrations()` raw SQL with proper migration system)
- [ ] Set `NEXT_PUBLIC_API_BASE_URL` to production URL in deployment environment
- [ ] Enable TypeScript `strict: true` in `tsconfig.json`
- [ ] Set `FLASK_ENV=production` in production environment
- [ ] Verify CORS origins is set to the actual production frontend URL

---

## Summary Statistics

| Layer | CRITICAL | HIGH | MEDIUM | LOW | Total |
|-------|----------|------|--------|-----|-------|
| Frontend | 4 | 6 | 5 | 6 | 21 |
| Backend (admin) | 5 | 7 | 8 | 9 | 29 |
| Backend (other) | 3 | 3 | 10 | 17 | 33 |
| Database | 0 | 3 | 5 | 4 | 12 |
| Cross-Layer | 0 | 2 | 4 | 3 | 9 |
| **TOTAL** | **12** | **21** | **32** | **39** | **104** |
