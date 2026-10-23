# RealtyHub - PHP MVC + MySQL Migration Specification

Source system: `C:\xampp\htdocs\realtyhub`
Source stack: Flask (Python) REST API + Next.js 16 (React 19) + PostgreSQL (SQLAlchemy 2.0)
Target stack: PHP MVC + MySQL

This document is a functional and technical inventory of everything the current
application does, including the business rules that must be preserved in the PHP
rewrite. It is written to be used as the implementation checklist and the
acceptance checklist for the migration.

---

## 1. System Snapshot

| Area | Current implementation |
|---|---|
| Backend | Flask app factory, 19 blueprints, SQLAlchemy 2.0 ORM |
| Frontend | Next.js App Router, React 19, Tailwind, axios, Swiper, DOMParser/DOMPurify |
| Database | PostgreSQL, 43 tables, Alembic-style migrations in `backend/migrations/versions` |
| Auth (staff) | JWT access token in HTTP-only cookie + CSRF cookie/header |
| Auth (owners) | Separate owner JWT cookies (`owner_access_token`, `owner_csrf_token`) + `X-Owner-CSRF-TOKEN` |
| Media | Local storage with Supabase Storage option; image preprocessing variants |
| Payments | Mock / Razorpay / Stripe, provider selected in settings |
| Messaging | SMTP email + WhatsApp (log / Meta Cloud API / Twilio) |
| Integrations | AI copy generation (OpenAI, Anthropic, Gemini, local fallback), Facebook Lead Ads webhook |
| Background jobs | HTTP cron endpoints protected by a cron key |
| Public tracking | Page visits, search logs, banner clicks |

### Main folders (current)

- `backend/app.py` - app factory, blueprint registration, token guards, migrations, seeding
- `backend/config.py` - config, PostgreSQL retry, upload limits, `VALID_PAGES`
- `backend/models/` - ORM models
- `backend/routes/` - 19 blueprints
- `backend/utils/` - business logic and integrations
- `frontend/app/` - all Next.js routes
- `uploads/` - local media
- `backups/` - DB dumps

---

## 2. Actors and Access Model

### 2.1 Visitor (anonymous)

- Browse and search approved, active, paid/waived, unexpired listings.
- View listing detail, neighboring listings, FAQ, types, team, CMS pages.
- Submit the contact/enquiry form (creates a lead) after consent.
- Save a search (guest email supported).
- Track visits, searches and banner clicks.
- Unsubscribe from saved-search alerts.
- Cannot submit a property without an owner account.

### 2.2 Owner (property poster)

- Register, verify email, login/logout, forgot/reset password.
- Create a listing (owner/agent/broker), edit own listing, upload/reorder images.
- Select preset features and dynamic property-type fields.
- See listing state: `payment_pending | pending | active | grace | expired | rejected | closed`.
- Pay for listing validity, renewal, featured boost, or combo.
- Apply coupons at checkout.
- View transactions.
- View leads for own listings; lead contact details may be locked until paid/live.
- Manage lead stage/interactions/follow-ups/not-interested/reopen.
- Save searches; receive alerts.
- Export own data (CSV/ZIP) and delete account (DPDP).

### 2.3 Admin / Staff

- Login, logout, profile, change password, forgot password via admin-managed reset request.
- Roles and permissions (RBAC); system roles cannot be deleted.
- Properties: list, create, edit, delete, approve, reject, close, reopen, feature, verify, toggle visibility.
- Upload/delete/reorder images; view property contacts; property navigation.
- Leads: list, detail, create, assign, bulk auto-assign, interactions, stage, not-interested, reopen, archived, stats, follow-ups, executives, create from contact.
- Lead statuses CRUD and reorder.
- Owners: list, edit, delete.
- Users (staff): list, create, edit, delete, reset password.
- Coupons CRUD; payment transactions; manual mark-paid; waive; grant days; feature.
- Password reset requests: list, unread count, delete, complete.
- CMS: hero slides, services, advantages, FAQ, testimonials, team, about gallery, pages, sections, team layout.
- Gallery: media browser, folder/file upload, rename, crop, delete.
- Analytics dashboards: summary, traffic, detailed traffic, search insights, banner performance.
- Settings read/write.
- Facebook settings/pages/events.
- AI provider config/test/model listing.
- Reports.
- Saved searches oversight.
- Activity log and property audit log.

### 2.4 Cron

- Protected by a shared cron key (header/param); `GET/POST /health` is public.
- Lead reminders, saved-search alerts, listing expiry, listing reminders, retention cleanup.

---

## 3. Functional Modules

## 3.1 Public Website

### 3.1.1 Listing browse and search

`GET /properties`

Supported query parameters and behavior:

| Parameter | Behavior |
|---|---|
| `q` / `keyword` | `LIKE %q%` on title, location, description. On PostgreSQL also trigram fuzzy match. |
| `location` | `LIKE %location%` |
| `type` | exact `transaction_type` (`sell` / `rent`) |
| `category` | exact `property_type` |
| `min_price`, `max_price` | numeric range on `price`; invalid value returns 400 |
| `featured=true` | only `is_featured = true` |
| `near=lat,lng` | bounding box radius filter, ordered by distance |
| `radius_km` | radius for `near`, default 5 km |
| `sort` | `newest` (default), `price_low`, `price_high`, `featured`, `relevance` |
| `page`, `per_page` | pagination, default 20 on public list |

Visibility predicate (single source of truth):

```
status = 'approved'
AND is_active = 1
AND is_closed = 0
AND payment_status IN ('paid', 'waived')
AND (expires_at IS NULL OR expires_at > now - grace_days)
AND (owner_id IS NULL OR owner.is_active = 1)
```

Response item fields: `id, listing_id, title, price, price_text, location,
is_featured, is_verified, property_type, transaction_type, listed_by,
rera_details, latitude, longitude, images[], created_at`.

### 3.1.2 Listing detail

`GET /property/<id>`

- Must satisfy the same public visibility predicate.
- Returns full property data, images ordered by `order`, features, dynamic field
  values, owner/contact details, description templates output, neighbors.
- Contact details may be hidden until the lead is accepted/paid per rules.

### 3.1.3 Neighbors

`GET /property/<id>/neighbors` - other visible listings near the property.

### 3.1.4 Enquiry / connect form

`POST /property/<id>/contact`

- Rate-limited.
- Requires consent; creates `ConsentRecord` with purpose `enquiry`/`contact`.
- Creates a `Lead` with source `website`, optional timeframe, preferred location,
  budget, notes.
- Sends acknowledgement email to visitor and notification to owner/admin.
- Returns the created lead id.

### 3.1.5 Public submit property

`POST /submit-property` (owner session required)

- Toggle: `allow_public_post` setting (default true).
- Owner must be logged in, active and email-verified.
- Uses multipart form: `title, transaction_type, property_type, location,
  price, price_text, description, latitude, longitude, listed_by, rera_details,
  overview_template_id, closing_template_id, title_template_id, mobile, images[],
  field_values (JSON), feature_ids (JSON)`.
- Required: title, transaction_type, property_type, location.
- `price_text` defaults to `*`; text "connect for price"/"price on request"
  forces `price = NULL`.
- New listing starts `status=pending`, `is_active=false`, `payment_status=unpaid`.
- Listing id is generated after insert as `PROP-000123`.
- Owner contact row (`property_contacts.type = owner`) is created.
- If `require_listing_payment` is false: listing is immediately waived/published
  for the configured duration and a confirmation email is sent.
- If payment is required: listing stays hidden and a payment-required email is sent.
- Images: validated extension/type, per-file and total limit (50 MB default),
  processed/re-encoded, stored under the listing folder, rollback deletes files.
- Dynamic fields and preset features are saved.
- Public posting is rate-limited to 10/hour.

### 3.1.6 Other public endpoints

- `GET /faq`
- `GET /types`
- `GET /property-type-fields/<type_value>`
- `GET /team`
- `GET /pages/<slug>`, `GET /pages/<slug>/sections`
- `GET /pages/about/team-layout`
- `GET /about-gallery`
- `GET /description-templates`
- `GET /location-counts`
- `GET /sitemap-data`
- `GET /preset-features`
- `GET /testimonials`
- `GET /settings` (public whitelist only)
- `POST /contact` (general contact form, rate-limited, consent required)
- `POST /saved-searches`, `GET /saved-searches`, `DELETE /saved-searches/<id>`,
  `POST|GET /saved-searches/unsubscribe`

---

## 3.2 Owner Portal

Base prefix is the owner blueprint (all owner routes).

### 3.2.1 Authentication

| Endpoint | Logic |
|---|---|
| `POST /register` | name, email, mobile, password; unique email; bcrypt/argon2 hash; email verification token with expiry; verification email; consent record |
| `GET /verify/<token>` | verify token and expiry; set `is_verified`; clear token |
| `POST /resend-verification` | rate-limited; regenerates token |
| `POST /login` | verify active + password; set owner JWT cookies; update `last_login` |
| `POST /logout` | clear cookies; revoke token jti |
| `POST /forgot-password` | always generic response; create hashed single-use reset token + expiry; email link |
| `POST /reset-password/<token>` | validate hashed token + expiry; update password; invalidate token |
| `GET /check-auth` | return current owner identity |

### 3.2.2 Listings

| Endpoint | Logic |
|---|---|
| `GET /properties` | paginated owner listings; state computed per listing |
| `GET /properties/<id>` | ownership check; full detail, images, fields, features, state, transactions |
| `PUT /properties/<id>` | ownership check; update content; may re-run moderation; image/feature/field updates |
| `POST /properties/<id>/gallery-images` | upload additional images |
| `POST /properties/<id>/reorder-images` | reorder by image ids |
| `POST /preset-features` | create a custom preset feature |
| `POST /properties/<id>/close` | set `is_closed`, `closed_at` |
| `POST /properties/<id>/reopen` | clear closed state |
| `GET /plans` | current plans, currency, featured capacity, grace, reminder days |
| `POST /properties/<id>/checkout` | create pending transaction for listing/featured/combo; validate coupon server-side; return provider order |
| `POST /properties/<id>/renew` | renew listing validity |
| `POST /properties/<id>/feature` | buy featured boost; enforce capacity |
| `POST /coupons/validate` | validate coupon against purpose/base amount |
| `GET /transactions` | owner transaction history |

### 3.2.3 Owner leads

- `GET /leads`, `GET /leads/archived`, `GET /leads/followups`
- `GET /leads/<id>` - ownership scoped; contact details locked when listing is
  unpaid/expired and the lead arrived after expiry.
- `PATCH /leads/<id>/stage`
- `POST /leads/<id>/interactions`
- `POST /leads/<id>/not-interested`
- `POST /leads/<id>/reopen`
- Owner lead scope only includes leads for properties owned by the authenticated
  owner. This must be enforced in SQL, not only in application filters.

### 3.2.4 Owner account

- `GET /data-export` - CSV/ZIP of profile, listings, leads, transactions.
- `POST /delete-account` - deactivate/anonymize owner, deactivate listings.

---

## 3.3 Admin Panel

All admin routes require staff JWT. Mutating routes additionally require RBAC
permission and, in the rewrite, CSRF protection.

### 3.3.1 Auth and profile

- `POST /login` - username/email + password; reject inactive; update last login.
- `GET /check-auth`, `POST /logout`, `GET /my-summary`.
- `POST /change-password`.
- `POST /forgot-password` - creates a password reset request for admin handling.
- `POST /reset-password/<token>`.
- `GET /profile`, `PUT /profile`.

### 3.3.2 Properties

- `GET /properties` - filters, search, pagination, state.
- `GET /property/<id>` - full detail + audit log + contacts.
- `POST /property` - admin create; supports immediate publish/waive.
- `PUT /property/<id>` - edit, image/feature/field updates.
- `DELETE /property/<id>` - delete property, images, related rows.
- `POST /approve/<id>` - set approved and publish/activate according to payment rule.
- `POST /reject/<id>` - set rejected; email owner.
- `POST /close/<id>`, `POST /reopen/<id>`.
- `POST /feature/<id>` - toggle featured or grant featured days.
- `POST /verify/<id>` - toggle verified badge.
- `POST /toggle-visibility/<id>`.
- `GET /property/<id>/contacts`.
- `GET /property-nav/<id>` - previous/next in filtered list.
- `POST /upload-image/<property_id>`, `POST /upload-images/<property_id>`.
- `POST /property/<property_id>/gallery-images`.
- `DELETE /delete-image/<image_id>`.
- `POST /reorder-images`.
- Every mutating action writes `PropertyAuditLog` and `ActivityLog`.

### 3.3.3 Owners, users, roles

- `GET /owners`, `PUT /owners/<id>`, `DELETE /owners/<id>`.
- `GET /users`, `POST /users`, `PUT /users/<id>`, `DELETE /users/<id>`.
- `GET /roles`, `POST /roles`, `PUT /roles/<rid>`, `DELETE /roles/<rid>`.
- `GET /permissions` - full permission catalog.
- `POST /reset-user-password`.
- System roles and the last super-admin must be protected from deletion.

### 3.3.4 Password reset requests

- `POST /password-reset-request` (public/staff-facing request).
- `GET /password-reset-requests`, `GET /password-reset-requests/unread-count`.
- `DELETE /password-reset-requests/<id>`.
- `POST /password-reset-requests/<id>/complete`.

### 3.3.5 Descriptions, types, features

- `GET|POST /description-templates`, `PUT|DELETE /description-templates/<id>`.
- `GET|POST /admin/types`, `PUT|DELETE /admin/types/<id>`.
- `GET|POST /preset-features`, `PUT|DELETE /preset-features/<id>`.
- FAQ, testimonials, team, property types.

### 3.3.6 Reports and payments

- `GET /reports` - aggregate listings/leads/owners/payments by period.
- `GET /payments/transactions`.
- `POST /payments/transactions/<id>/mark-paid` - manual payment; applies entitlement.
- `POST /payments/properties/<id>/waive`.
- `POST /payments/properties/<id>/grant-days`.
- `POST /payments/properties/<id>/feature`.
- `GET /coupons`, `POST /coupons`, `PUT /coupons/<id>`, `DELETE /coupons/<id>`.
- `GET /saved-searches`.

---

## 3.4 Leads CRM

### 3.4.1 Lead model

Fields: `id, property_id, name, email, mobile, source, status (FK lead_statuses),
assigned_to (FK admins), stage, lead_status, rejection_reason, follow_up_at,
archived_at, notes, timeframe, preferred_location, budget, first_response_at,
sla_due_at, sla_reminded_at, created_at, updated_at`.

- `stage` values: `NEW`, then configurable pipeline stages such as contacted,
  qualified, visit, negotiation, won/lost. `not-interested` archives the lead.
- `lead_status`: `ACTIVE` / `ARCHIVED` (closed).
- `source`: `website`, `facebook`, per-page `source_label`, `contact`, `manual`.
- Owner-posted leads are flagged/scoped separately from internal listings.

### 3.4.2 Lead endpoints

- `GET /admin/leads` - filters: search, stage, status, assigned, source, date,
  property; pagination.
- `GET /admin/leads/<id>` - history + transfers.
- `POST /admin/leads` - manual creation; optional property.
- `POST /admin/leads/<id>/assign` - reassign; writes `LeadTransfer`.
- `POST /admin/leads/auto-assign` - assign unassigned leads to the executive
  with the lowest active lead count (least-loaded).
- `POST /admin/leads/<id>/interactions` - add history entry (call, note, visit).
- `PATCH /admin/leads/<id>/stage` - stage transition; may archive.
- `POST /admin/leads/<id>/not-interested` - archive with reason.
- `POST /admin/leads/<id>/reopen`.
- `GET /admin/leads/archived`.
- `GET /admin/leads/stats` - counts by stage/status/source/assignee.
- `GET /admin/leads/followups` - due/overdue follow-ups.
- `GET /admin/leads/executives` - assignable staff with workloads.
- `POST /admin/leads/from-contact/<contact_id>` - convert a contact message to a lead.
- Lead statuses CRUD + reorder.

### 3.4.3 SLA

- Business hours: Monday-Saturday, 10:00-19:00 Asia/Kolkata.
- First-response SLA in business minutes (configurable).
- `sla_due_at` computed at lead creation.
- `first_response_at` set on first interaction/assignment action.
- Overdue leads receive a reminder email to the assignee (cron), once per lead
  (`sla_reminded_at`).

### 3.4.4 Lead detail locking (owner side)

Owner sees lead name/mobile/email only when:

- the listing is live (payment `paid`/`waived` and not expired), OR
- the lead was created before `expires_at`, OR
- the listing is closed by the owner.

Otherwise contact details are masked until the owner pays/renews.

### 3.4.5 Lead dependencies

- `LeadHistory` stores status/type/remarks/follow-up/created_by.
- `LeadTransfer` snapshots admin names and supports `SET NULL`.
- Deleting an admin must not delete lead history.

---

## 3.5 Listing Lifecycle and Payments

### 3.5.1 Defaults (settings-overridable)

| Setting | Default |
|---|---|
| `require_listing_payment` | `false` (free-listing promotion) |
| `listing_sell_price` | 999 |
| `listing_sell_days` | 90 |
| `listing_rent_price` | 499 |
| `listing_rent_days` | 30 |
| `featured_price` | 299 |
| `featured_days` | 30 |
| `featured_bundle_discount_percent` | 30 |
| `section_featured_count` | 20 |
| `listing_grace_days` | 7 |
| `listing_expiry_reminder_days` | `15,7,3,1` |
| `payment_currency` | `INR` |

### 3.5.2 Plans

- `plan_for(transaction_type)`: sell/rent price + duration.
- `featured_plan()`: featured price + duration.
- `combo_plan()`: listing plan + featured plan, discount applied only to the
  featured portion; returns amount, savings, discount percent.
- `plans_payload()`: plans plus currency, payment-required flag, grace days,
  featured capacity/used/available, reminder days.

### 3.5.3 Property lifecycle fields

`payment_status` (`unpaid | paid | waived`), `published_at`, `expires_at`,
`last_renewed_at`, `renewal_count`, `featured_until`, `closed_at`.

### 3.5.4 State computation

```
closed           -> is_closed
payment_pending  -> payment_status = unpaid
rejected         -> status = rejected
pending          -> status = pending
expired          -> status = expired
grace            -> expires_at <= now
active           -> otherwise
```

### 3.5.5 Transitions

- `publish_listing(prop, days)` - set paid/published/expires.
- `waive_listing(prop, days)` - comp/free publish.
- `renew_listing(prop, days)` - extend from max(now, expires_at).
- `add_featured_days(prop, days)` - extend `featured_until`.
- `apply_paid_transaction(txn)` - set transaction paid, apply entitlement,
  redeem coupon, send receipt, notify owner.
- `expire_due_listings()` - mark expired, deactivate, notify owner, add reminder
  ledger rows.
- `send_expiry_reminders()` - send at configured day stages, idempotent via
  `listing_reminders` unique `(property_id, kind, stage_days)`.

### 3.5.6 Featured capacity

- Capacity from `section_featured_count` (default 20).
- Count only effectively featured, publicly visible, not expired listings.
- `FeaturedSlotsFullError` prevents buying a featured boost when full.
- `is_effectively_featured` checks `is_featured` and `featured_until`.

### 3.5.7 Transactions

`listing_transactions` fields: `property_id, owner_id, purpose
(listing|featured|combo), transaction_type, amount, currency, duration_days,
featured_days, discount_percent, coupon_id, coupon_code, coupon_discount,
provider, provider_order_id, provider_payment_id, status
(pending|paid|failed|cancelled), method (online|manual|waived), notes,
created_at, paid_at`.

Rules:

- Server recomputes price; never trust client amount.
- `provider_order_id` unique; webhooks idempotent.
- Only pending transactions can be completed.
- Manual admin mark-paid applies the same entitlement path as a gateway payment.
- Waived transaction amount may be zero; still records entitlement.

### 3.5.8 Payment providers

- Settings: `payment_provider`, `payment_key_id`, `payment_key_secret`,
  `payment_webhook_secret`, `payment_currency`.
- Providers: `mock`, `razorpay`, `stripe`.
- `amount_to_minor()` converts rupees to paise/cents.
- Webhook: `POST /webhook/<provider>` verifies signature, extracts order/payment
  id, completes transaction.
- `POST /mock/complete` only when mock provider is active.
- `GET /verify` returns transaction/payment status.

---

## 3.6 Coupons

Fields: `code, description, discount_type (percent|fixed), value, max_discount,
min_amount, applies_to (listing|featured|combo|all), valid_from, valid_until,
usage_limit, per_user_limit, used_count, is_active`.

Validation order:

1. Code exists and active.
2. Within validity window.
3. Purpose matches `applies_to` (or `all`).
4. Base amount >= `min_amount`.
5. `used_count < usage_limit`.
6. Per-owner redemptions < `per_user_limit`.
7. Discount > 0, never exceeds base.
8. Percent discount capped by `max_discount`.

Redemption:

- Created only after successful payment, one row per transaction/coupon/owner.
- Increments `used_count`.
- Idempotent: existing redemption for transaction prevents double count.

---

## 3.7 Saved Searches and Alerts

Fields: `owner_id (nullable), email, phone, name, params (JSON string), notify,
is_active, unsubscribe_token, last_notified_at, created_at, updated_at`.

- Guest save supported (email-based).
- `params` stores the search query dict.
- Cron `POST /search/alerts`:
  - Iterate active + notify searches.
  - Skip if notified recently (cooldown).
  - Run stored filters against publicly visible properties created since last
    notification.
  - Send alert email with listing cards and unsubscribe link.
  - Update `last_notified_at`.
- Unsubscribe via token sets `is_active=false`/`notify=false`.
- Admin can view saved searches.

---

## 3.8 CMS and Page Content

### 3.8.1 Hero slides

Fields include image, title, subtitle, button text/link, overlay opacity, title
and subtitle color/alignment/font family/size/style/line-height, background
color, button colors/alignment/font, content vertical alignment, order, active.
Public returns active ordered slides; admin CRUD/toggle/reorder.

### 3.8.2 Services and advantages

- Service: title, description, image, active, sort order.
- Advantage: title, description, icon, active.
- Public GET; admin create/update/delete/toggle/reorder.

### 3.8.3 FAQ

Fields: question, answer, order, active. Public active list; admin CRUD, toggle,
reorder.

### 3.8.4 Testimonials

Fields: name, location, description, image, active. Public active list; admin
CRUD/toggle.

### 3.8.5 Team

Fields: name, role, photo, bio, email, social links JSON, is_leader, active,
sort order. Public GET; admin CRUD/reorder.

### 3.8.6 About gallery

Fields: image_url, caption, sort order, active, featured. Public GET; admin CRUD
and reorder.

### 3.8.7 Editable pages

- Stored as settings keys: `page_<slug>` = JSON `{title, content}` and
  `page_<slug>_sections` = JSON array, plus `page_about_team_layout`.
- `VALID_PAGES` is the allowlist (terms, privacy, about, contact, etc.).
- Content sanitized server-side with allowlist: `b, i, u, em, strong, a, br,
  p, ul, ol, li`; links allow `href, target, rel`.
- Admin list/get/update page and replace sections; team layout carousel/grid.

---

## 3.9 Gallery and Media

- Local storage root (default `uploads/`), optional Supabase storage.
- Operations: upload, delete, rename, list, create folder, delete folder.
- Admin gallery browser with folders, image crop, rename, delete.
- Image preprocessing: open, validate, resize/compress, generate variants
  (`thumb`, `medium`, etc.), write file.
- Path helpers: `is_image_path`, `variant_path`, `variant_paths`.
- Allowed image extensions validated by MIME and extension.
- Max request size 50 MB (config).
- Deleting a property should delete/retain files according to policy; current
  code deletes property image rows and attempts file deletion.

---

## 3.10 Analytics

### Tracking (public, rate-limited)

- `POST /analytics/visit` - page_url, referrer, UTM source/medium/campaign,
  visitor IP.
- `POST /analytics/search` - location, property_type, transaction_type,
  min/max price, IP.
- `POST /analytics/banner-click` - slide id/title, button link, page URL, IP.

### Admin dashboards

- `GET /admin/analytics` - summary counts and time series for a period.
- `GET /admin/analytics/traffic` - referrer classification
  (direct/search/social/referral/paid).
- `GET /admin/analytics/traffic/detailed`.
- `GET /admin/analytics/search-insights` - top locations/types/price bands.
- `GET /admin/analytics/banner-performance` - impressions/clicks/CTR.

`period` query param defaults to 30 days.

---

## 3.11 AI Listing Copy

- `POST /ai/generate-listing` - takes listing attributes, returns title and
  description.
- Providers: OpenAI, Anthropic, Gemini; selection via settings/env; model
  configurable per provider.
- Provider key resolved from settings first, then environment.
- If AI disabled or call fails, deterministic local composer builds copy from
  property fields and selected chips/features.
- `POST /ai/test` - test provider connection.
- `POST /ai/models` - list models for provider/key.
- Admin AI settings page for provider/key/model/enabled.

---

## 3.12 Facebook Lead Ads

- Webhook verify: `GET /meta/webhook` compares `hub.verify_token` with settings
  token and echoes `hub.challenge`.
- Receive: `POST /meta/webhook`.
  - Validate payload; each entry/change with `leadgen_id`.
  - Insert `MetaLeadEvent` with unique `leadgen_id` for idempotency.
  - Resolve page token (encrypted at rest) via `MetaPage.page_id`.
  - Fetch lead fields from Graph API.
  - Map name/email/phone and custom fields.
  - Create `Lead` with source = page `source_label` or `facebook`.
  - Notify admins/assignee.
  - Update event status and `last_lead_at`.
- Admin:
  - `GET|PUT /admin/facebook/settings` - verify token, app id/secret, enabled.
  - `GET|POST /admin/facebook/pages`.
  - `PUT|DELETE /admin/facebook/pages/<id>`.
  - `POST /admin/facebook/pages/<id>/test`.
  - `GET /admin/facebook/events`.
- Page access tokens encrypted via `secrets_crypto`; masked in API responses.
- Graph API version/base URL configurable.

---

## 3.13 Email and WhatsApp

### Email (`utils/mailer.py`)

Templates:

- Owner verification
- Connect acknowledgement to visitor
- Connect notification to owner
- New lead to admin/assignee
- Saved-search alert
- Lead SLA reminder
- Submission received / confirmed / rejected
- Listing payment required
- Listing published
- Payment receipt
- Expiry reminder / listing expired
- Contact-us admin notification
- Password reset (owner/admin)
- Password reset request (admin request flow)

Behavior:

- SMTP settings from settings table, fallback to environment.
- Async send through a background thread; `block` option for critical mail.
- Plain-text alternative generated from HTML.
- Site name and frontend base URL configurable.
- Failures are logged, never break the API request.

### WhatsApp (`utils/messaging.py`)

- Providers: `log`, `meta`, `twilio`; selected in settings.
- Phone normalization with default country code `91`.
- `notify()` sends email and WhatsApp in one call, each optional.
- Async helper for WhatsApp.

---

## 3.14 Settings

- Table `settings` (`skey` unique, `svalue` text).
- Cached in process with TTL; invalidated on write.
- Public endpoint returns a whitelist/prefix-filtered subset.
- Helpers: `is_setting_enabled(key)`, `get_setting_int(key)`.
- Admin GET returns all; admin PUT upserts.
- Secrets returned masked (never plaintext).

Known settings groups:

- General: site name, contact email/phone, address, social links, logo, footer.
- Listing: payment required, prices/durations, featured, bundle discount,
  capacity, grace, reminder days, currency, allow public post.
- Payments: provider, key id/secret, webhook secret, currency.
- Mail: host, port, username, password, TLS/SSL, from.
- WhatsApp: provider, token, phone number id, Twilio sid/token/from.
- AI: enabled, provider, keys, models.
- Meta: app id/secret, verify token, enabled, graph version.
- Pages: `page_<slug>`, `page_<slug>_sections`, `page_about_team_layout`.
- DPDP: consent version, retention days.

---

## 3.15 RBAC

`permissions` table: `code`, `label`, `module`, `description`.
`roles` table: `name`, `slug`, `description`, `is_system`, `sort_order`.
`role_permissions` join with unique `(role_id, permission_id)`.

Permission catalog includes modules:

- Properties: `properties.view`, `properties.create`, `properties.edit`,
  `properties.delete`, `properties.approve`, `properties.manage_own`.
- Leads: `leads.view`, `leads.update`, `leads.assign`, `leads.export`,
  `leads.delete`, `leads.auto_assign`.
- Owners, users, roles, coupons, payments, CMS, gallery, analytics, settings,
  pages, reports, facebook, ai.

Rules:

- `admin.role = 'admin'` is the super-admin fallback.
- `role_id` links to a role; permissions are unioned.
- `require_permission(code)` returns 403 when missing.
- System roles cannot be deleted; cannot remove the last super-admin.
- Seeded at startup.

---

## 3.16 Cron and Retention

All cron routes require the cron key except health.

| Endpoint | Job |
|---|---|
| `GET/POST /health` | Health check, DB connectivity, config summary |
| `POST /leads/reminders` | Overdue lead follow-ups and SLA reminders |
| `POST /search/alerts` | Saved-search alert emails |
| `POST /listings/expire` | Expire listings and notify owners |
| `POST /listings/reminders` | Expiry reminders at configured day stages |
| `POST /retention/cleanup` | Delete old analytics/consent/token/event rows per retention policy |

Cron responses include counts and errors; jobs must be idempotent.

---

## 4. Database Schema (MySQL Target)

Conversion rules:

- PostgreSQL `SERIAL/INTEGER` -> `BIGINT UNSIGNED AUTO_INCREMENT` (or `INT`).
- `NUMERIC(p,s)` -> `DECIMAL(p,s)`.
- `BOOLEAN` -> `TINYINT(1)`.
- `JSON` -> `JSON`.
- `TEXT` -> `TEXT` / `MEDIUMTEXT`.
- `TIMESTAMP/DATETIME` -> `DATETIME` stored in UTC.
- `CITEXT`/case-insensitive fields -> `VARCHAR` with `utf8mb4_unicode_ci`.
- PostgreSQL trigram GIN indexes -> MySQL `FULLTEXT` where possible; otherwise
  `LIKE` with prefix indexes.
- Partial/functional indexes -> plain composite indexes or generated columns.
- All FKs: explicit `ON DELETE` behavior matching the source.
- Charset: `utf8mb4`, collation `utf8mb4_unicode_ci`.
- Store money as `DECIMAL(12,2)`; never `FLOAT`.
- Store password hashes in `VARCHAR(255)`.
- Store reset/verification tokens as hashes (`VARCHAR(64)` hex) + expiry.

### 4.1 Table List (43)

1. `properties`
2. `property_images`
3. `property_contacts`
4. `admins`
5. `roles`
6. `permissions`
7. `role_permissions`
8. `owners`
9. `saved_searches`
10. `token_blocklist`
11. `consent_records`
12. `leads`
13. `lead_statuses`
14. `lead_history`
15. `lead_transfers`
16. `faqs`
17. `property_types`
18. `about_gallery_images`
19. `team_members`
20. `property_type_fields`
21. `property_field_values`
22. `description_templates`
23. `preset_features`
24. `property_features`
25. `activity_log`
26. `password_reset_requests`
27. `property_audit_log`
28. `listing_transactions`
29. `coupons`
30. `coupon_redemptions`
31. `listing_reminders`
32. `rate_limit_counters`
33. `meta_pages`
34. `meta_lead_events`
35. `hero_slides`
36. `services`
37. `advantages`
38. `settings`
39. `page_visits`
40. `search_logs`
41. `banner_clicks`
42. `contactus`
43. `testimonials`

### 4.2 Key Tables and Columns

#### properties

```
id BIGINT UNSIGNED PK AI
listing_id VARCHAR(20) UNIQUE
title VARCHAR(255) NOT NULL
description TEXT NULL
transaction_type VARCHAR(20) NULL
property_type VARCHAR(50) NOT NULL DEFAULT 'flat'
listed_by VARCHAR(20) DEFAULT 'owner'
rera_details VARCHAR(255) NULL
price DECIMAL(12,2) NULL
price_text VARCHAR(50) DEFAULT '*'
location VARCHAR(255) NOT NULL
latitude DECIMAL(9,6) NULL
longitude DECIMAL(9,6) NULL
status VARCHAR(20) DEFAULT 'pending'
is_active TINYINT(1) DEFAULT 0
is_featured TINYINT(1) DEFAULT 0
is_verified TINYINT(1) DEFAULT 0
is_closed TINYINT(1) DEFAULT 0
overview_template_id BIGINT NULL FK description_templates
closing_template_id BIGINT NULL FK description_templates
title_template_id BIGINT NULL FK description_templates
selected_chips TEXT NULL
uploaded_by BIGINT NULL FK admins
owner_id BIGINT NULL FK owners
created_at DATETIME
updated_at DATETIME
closed_at DATETIME NULL
published_at DATETIME NULL
expires_at DATETIME NULL
last_renewed_at DATETIME NULL
renewal_count INT DEFAULT 0
featured_until DATETIME NULL
payment_status VARCHAR(20) DEFAULT 'unpaid'
```

Indexes: `(status, is_active)`, `is_featured`, `location`, `created_at`,
`uploaded_by`, `price`, `(latitude, longitude)`, `expires_at`,
`featured_until`, `payment_status`, `owner_id`, FULLTEXT `(title, location,
description)`.

#### owners

```
id, name VARCHAR(120), email VARCHAR(150) UNIQUE, mobile VARCHAR(20),
password VARCHAR(255), is_verified TINYINT(1), verification_token VARCHAR(255),
verification_expiry DATETIME, is_active TINYINT(1), created_at, last_login,
reset_token VARCHAR(255), reset_token_expiry DATETIME
```

#### admins

```
id, user_id VARCHAR(20) UNIQUE NULL, username VARCHAR(100) UNIQUE,
email VARCHAR(120) UNIQUE, name VARCHAR(120), password VARCHAR(255),
role VARCHAR(20) DEFAULT 'admin', phone, whatsapp, profile_image,
is_active TINYINT(1), reset_token, reset_token_expiry, role_id FK roles,
created_at, last_login
```

#### leads

```
id, property_id FK properties ON DELETE SET NULL, name VARCHAR(100),
email VARCHAR(150), mobile VARCHAR(15), source VARCHAR(50) DEFAULT 'website',
status BIGINT FK lead_statuses NULL, assigned_to BIGINT FK admins NULL,
stage VARCHAR(20) DEFAULT 'NEW', lead_status VARCHAR(20) DEFAULT 'ACTIVE',
rejection_reason VARCHAR(100), follow_up_at DATETIME, archived_at DATETIME,
notes TEXT, timeframe VARCHAR(50), preferred_location VARCHAR(150),
budget VARCHAR(50), first_response_at DATETIME, sla_due_at DATETIME,
sla_reminded_at DATETIME, created_at, updated_at
```

#### listing_transactions

```
id, property_id FK properties ON DELETE CASCADE, owner_id FK owners ON DELETE SET NULL,
purpose VARCHAR(20) DEFAULT 'listing', transaction_type VARCHAR(20),
amount DECIMAL(10,2) NOT NULL DEFAULT 0, currency VARCHAR(8) DEFAULT 'INR',
duration_days INT NOT NULL DEFAULT 0, featured_days INT DEFAULT 0,
discount_percent DECIMAL(5,2) DEFAULT 0, coupon_id FK coupons ON DELETE SET NULL,
coupon_code VARCHAR(50), coupon_discount DECIMAL(10,2) DEFAULT 0,
provider VARCHAR(20) DEFAULT 'mock', provider_order_id VARCHAR(120) UNIQUE,
provider_payment_id VARCHAR(120), status VARCHAR(20) DEFAULT 'pending',
method VARCHAR(20) DEFAULT 'online', notes VARCHAR(255), created_at, paid_at
```

#### coupons

```
id, code VARCHAR(50) UNIQUE, description VARCHAR(255),
discount_type VARCHAR(10) DEFAULT 'percent', value DECIMAL(10,2) NOT NULL DEFAULT 0,
max_discount DECIMAL(10,2) NULL, min_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
applies_to VARCHAR(15) NOT NULL DEFAULT 'all', valid_from DATETIME,
valid_until DATETIME, usage_limit INT NULL, per_user_limit INT NULL,
used_count INT NOT NULL DEFAULT 0, is_active TINYINT(1) NOT NULL DEFAULT 1,
created_at, updated_at
```

#### settings

```
id, skey VARCHAR(100) UNIQUE NOT NULL, svalue TEXT, created_at, updated_at
```

#### saved_searches

```
id, owner_id FK owners ON DELETE CASCADE NULL, email VARCHAR(150),
phone VARCHAR(20), name VARCHAR(120), params TEXT NOT NULL DEFAULT '{}',
notify TINYINT(1) DEFAULT 1, is_active TINYINT(1) DEFAULT 1,
unsubscribe_token VARCHAR(64) UNIQUE, last_notified_at DATETIME,
created_at, updated_at
```

#### meta_pages / meta_lead_events

```
meta_pages: id, page_id VARCHAR(64) UNIQUE, page_name VARCHAR(255),
access_token TEXT (encrypted), source_label VARCHAR(50) DEFAULT 'facebook',
is_active TINYINT(1), last_lead_at DATETIME, created_at, updated_at

meta_lead_events: id, leadgen_id VARCHAR(128) UNIQUE, page_id VARCHAR(64),
form_id VARCHAR(64), status VARCHAR(20) DEFAULT 'pending', detail VARCHAR(255),
lead_id FK leads ON DELETE SET NULL, created_at
```

### 4.3 Data Migration Notes

- Preserve `properties.id` and `listing_id`.
- Preserve `owners.id`, `admins.id`, `leads.id`.
- Re-hash legacy passwords lazily on first login if the source uses a different
  algorithm.
- Convert booleans explicitly.
- Normalize all timestamps to UTC.
- Rebuild FULLTEXT indexes after import.
- Import in FK order: roles/permissions, admins, owners, property types/fields,
  templates, properties, images/contacts/features/values, leads/statuses/history,
  transactions/coupons, CMS, analytics.
- Verify counts per table after import.

---

## 5. PHP MVC Architecture Proposal

### 5.1 Option A - Custom PHP MVC (no framework)

```
/app
  /Controllers
    /Public
    /Owner
    /Admin
    /Cron
  /Models
  /Services
    AuthService.php
    ListingLifecycleService.php
    PaymentService.php
    CouponService.php
    LeadService.php
    SlaService.php
    MailService.php
    WhatsAppService.php
    AiService.php
    MetaService.php
    AnalyticsService.php
    MediaService.php
    SettingsService.php
  /Middleware
    AuthMiddleware.php
    OwnerAuthMiddleware.php
    RbacMiddleware.php
    CsrfMiddleware.php
    RateLimitMiddleware.php
    CronKeyMiddleware.php
  /Repositories
  /Validators
  /Views
    /layouts
    /public
    /owner
    /admin
/config
/public
  index.php
  /assets
/routes
  web.php
  api.php
  cron.php
/storage
  /uploads
  /logs
  /cache
/database
  /migrations
  /seeds
```

### 5.2 Option B - Laravel

- Controllers mirror the modules above.
- Eloquent models mirror the 43 tables.
- Policies for property/lead ownership.
- Gates for RBAC permissions.
- Form Requests for validation.
- Jobs/Console commands for cron.
- Blade views if fully server-rendered, or API resources if keeping Next.js.
- `spatie/laravel-permission` optionally replaces the custom RBAC tables, but
  keeping the existing table names reduces data-migration work.

### 5.3 Auth Decision

Current system uses JWT cookies with separate admin/owner namespaces and a
blocklist. PHP rewrite options:

- Preferred: PHP native sessions with regenerated session ids, `HttpOnly`,
  `Secure`, `SameSite=Lax`, CSRF token in session.
- If stateless API is required: signed JWT or opaque session tokens stored
  hashed in DB, with refresh/rotation and revocation.

Either way, do not store CSRF tokens in `localStorage`. Send the CSRF token via
a readable cookie or response body and require it in a header.

### 5.4 Request Flow

```
public/index.php
  -> bootstrap (env, db, session, error handler)
  -> router
  -> middleware (auth, rbac, csrf, rate limit)
  -> controller
  -> service/repository
  -> model (PDO prepared statements)
  -> view or JSON response
```

---

## 6. Business Rules Checklist

### Visibility and publishing

- [ ] Public list/detail/sitemap/location counts/alerts share one visibility predicate.
- [ ] Unpaid listings are hidden from public and locked for owner lead details.
- [ ] Free-listing bypass publishes immediately with an expiry date.
- [ ] Grace period keeps expired listings visible for N days.
- [ ] Closing a listing hides it publicly but keeps owner lead access.
- [ ] Owner deactivation hides their listings.

### Pricing and payments

- [ ] Sell/rent/featured/combo prices come from settings.
- [ ] Combo discount applies only to the featured portion.
- [ ] Client never controls the final amount.
- [ ] Coupon validation and redemption are server-side and idempotent.
- [ ] Payment webhooks verify signatures and are idempotent.
- [ ] Manual mark-paid and waive use the same entitlement path.
- [ ] Featured purchase respects capacity.
- [ ] Renewal extends from the later of now/current expiry.
- [ ] Receipt and published emails are sent once.

### Leads

- [ ] Status transitions only along allowed graph.
- [ ] Assignment writes transfer history.
- [ ] Auto-assign picks the least-loaded executive.
- [ ] SLA due date uses business hours in Asia/Kolkata.
- [ ] First response is recorded once.
- [ ] Overdue reminder is sent once per lead.
- [ ] Owner scope is SQL-enforced (no IDOR).
- [ ] Archived/not-interested leads are excluded from active lists.

### Auth and security

- [ ] Owner registration requires email verification before posting.
- [ ] Reset tokens are hashed, single-use, expiring.
- [ ] Admin and owner sessions are separated.
- [ ] RBAC enforced on every mutating admin endpoint.
- [ ] CSRF enforced on cookie-authenticated mutations.
- [ ] Rate limits on login, register, forgot-password, contact, submit, tracking.
- [ ] Uploads validated by MIME + extension + size, image re-encoded.
- [ ] All HTML content sanitized server-side (HTMLPurifier or equivalent).
- [ ] Secrets encrypted at rest and masked in responses.
- [ ] Errors logged; no silent `except: pass`.
- [ ] Pagination caps enforced.

### DPDP / privacy

- [ ] Consent recorded with purpose, version, IP, user agent.
- [ ] Owner data export and account deletion.
- [ ] Retention cleanup for analytics, consent, tokens, webhook events.

---

## 7. Security Issues to Fix in the Rewrite

Identified in `FULL-STACK-AUDIT-REPORT.md` and code review:

1. IDOR in lead endpoints - enforce ownership/assignment in SQL.
2. Bypassable regex HTML sanitizer in `SectionContent.tsx` - sanitize on the
   server and use a proven library.
3. Missing property ownership checks on owner mutations.
4. Silent exception swallowing - replace with structured logging and safe errors.
5. Plaintext password reset tokens - hash them, expire them, single-use.
6. CSRF token stored in `localStorage` - use session-bound CSRF.
7. No pagination on several admin lists - add limits and caps.
8. Weak upload validation - verify MIME magic bytes, re-encode images, randomize
   names, block path traversal.
9. Unencrypted integration tokens - encrypt Facebook/WhatsApp/payment secrets.
10. Overly broad CORS - restrict to the real frontend origin.
11. Missing authorization on some admin read endpoints - require RBAC even for reads.
12. Rate-limit storage per process - use shared DB/Redis storage.

---

## 8. Frontend Route Map

### 8.1 Public

```
/                                  homepage
/about                             about
/properties                        listings
/properties/[location]             location filtered listings
/property/[id]                     detail
/post                              post property
/how-it-works
/contact
/terms
/privacy-policy
/login
/register
/verify-email
/verify-email/[token]
/reset-password/[token]
/owner-reset-password/[token]
/my-account
/checkout/[id]
/search-alerts/unsubscribe
/sitemap.xml, /robots.txt, /manifest
```

### 8.2 Admin

```
/admin
/admin/dashboard
/admin/properties
/admin/properties/[id]
/admin/add-property
/admin/leads
/admin/owners
/admin/users
/admin/roles
/admin/coupons
/admin/payments
/admin/messages
/admin/contacts
/admin/pages
/admin/pages/[slug]
/admin/pages/about|contact|terms|privacy
/admin/cms
/admin/cms/hero
/admin/cms/services
/admin/cms/advantages
/admin/cms/faq
/admin/cms/featured
/admin/cms/footer
/admin/cms/testimonials
/admin/cms/new
/admin/templates
/admin/gallery
/admin/analytics
/admin/reports
/admin/facebook
/admin/saved-searches
/admin/settings
/admin/profile
```

---

## 9. Migration Plan

### Phase 0 - Freeze and inventory

- Freeze feature work on the Flask app.
- Export the Postgres schema and row counts.
- Produce MySQL DDL for all 43 tables.
- Capture settings values and secrets inventory.

### Phase 1 - Foundation

- Scaffold PHP MVC structure, config, DB layer, error handling, logging.
- Implement sessions/CSRF/rate limiting.
- Implement settings service and cache.
- Implement RBAC middleware and seed roles/permissions.
- Implement media service and upload pipeline.

### Phase 2 - Public site

- Property visibility predicate and search/filter/sort/pagination.
- Property detail, neighbors, sitemap, location counts.
- Contact/enquiry form with consent and lead creation.
- CMS public endpoints and page rendering.
- Analytics tracking endpoints.

### Phase 3 - Owner portal

- Register/verify/login/reset/logout.
- Owner listings CRUD, images, features, dynamic fields.
- Plans, checkout, renew, feature, coupons, transactions.
- Owner leads and lead detail locking.
- Saved searches and account export/delete.

### Phase 4 - Admin panel

- Auth/profile/password reset requests.
- Properties moderation and audit log.
- Users, owners, roles/permissions.
- Leads CRM, statuses, assignment, SLA.
- CMS, gallery, analytics dashboards, reports, settings.
- Coupons and payment administration.

### Phase 5 - Integrations and jobs

- Payment providers and webhooks.
- Email templates.
- WhatsApp providers.
- AI copy generation with local fallback.
- Facebook Lead Ads webhook and admin UI.
- Cron jobs and idempotency ledgers.

### Phase 6 - Data migration

- Import in FK order.
- Verify counts and checksums.
- Rebuild indexes and FULLTEXT.
- Re-hash or migrate password formats.
- Migrate media files and rewrite paths.

### Phase 7 - Cutover

- Run both systems in parallel behind a proxy.
- Rehearse rollback.
- Switch DNS/traffic.
- Monitor error rates, payment webhooks, cron, email delivery.
- Keep the legacy DB read-only for a retention window.

### Phase 8 - Verification

- Endpoint contract tests.
- Permission matrix tests.
- Payment/coupon/lifecycle tests.
- Lead scope/IDOR tests.
- Upload security tests.
- Cron idempotency tests.
- Email template snapshots.

---

## 10. Acceptance Criteria

The migration is complete when:

1. Every public, owner, admin, cron and webhook endpoint listed above exists and
   returns the same data contracts.
2. The visibility predicate produces identical results on the imported dataset.
3. Owners can register, verify, post, pay, renew, feature and manage leads.
4. Admins can moderate listings, manage leads, CMS, coupons, payments and users
   under RBAC.
5. Payment webhooks and cron jobs are idempotent.
6. All security issues in Section 7 are resolved.
7. Data counts and media references match the source.
8. Scheduled jobs run without duplicate emails.
9. No CSRF, IDOR, upload or XSS regression.
10. The legacy app can be retired.

---

## 11. Open Decisions

1. **Framework**: custom PHP MVC vs Laravel. Recommend Laravel unless there is a
   hosting constraint.
2. **Frontend**: keep the Next.js app and expose a PHP REST API, or rebuild the
   UI as server-rendered PHP views/Blade. The target phrase "PHP MVC" suggests
   full server-rendered PHP; confirm before starting.
3. **Auth transport**: PHP sessions vs JWT cookies.
4. **Media**: local disk vs S3-compatible storage vs keeping Supabase.
5. **Search**: MySQL FULLTEXT vs external search (Meilisearch/Elasticsearch).
6. **Payments**: keep all three providers or launch with Razorpay only.
7. **AI**: keep all three providers or ship with one plus local fallback.
8. **Legacy data**: migrate production data or start clean and re-import only
   listings/owners.
9. **Password migration**: lazy re-hash on login vs forced reset.
10. **Multilingual labels**: English/Marathi/Hindi labels currently live in the
    frontend; decide whether to move them to PHP translation files or keep them
    in the UI layer.
