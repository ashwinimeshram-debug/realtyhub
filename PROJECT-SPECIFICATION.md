# Realty Hub — Detailed Project Specification

> **Project:** Realty Hub  
> **Type:** Real Estate Listing Platform  
> **Architecture:** Flask REST API (Backend) + Next.js 16 App Router (Frontend)  
> **Database:** PostgreSQL via SQLAlchemy 2.0  
> **Auth:** JWT + CSRF (HTTP-only cookies)  
> **Repository:** `C:\xampp\htdocs\realtyhub`

---

## 1. System Overview

Realty Hub is a full-stack real estate listing platform that allows property owners to submit listings, site visitors to browse/search/filter properties, and administrators to manage the entire lifecycle — including property CRUD, content management (hero slides, services, testimonials, FAQ), lead pipeline management, analytics, and site-wide settings.

The system supports:
- **Public users**: Browse properties, filter by location/type, submit property listings, contact via forms
- **Power users**: Manage leads, view reports
- **Admins**: Full CRUD access to all modules + site configuration + user management
- **Automatic description generation** via template-based title/overview/closing text composition
- **Multi-language dynamic field labels** (English, Marathi, Hindi)

---

## 2. Directory Structure

```
realtyhub/
├── backend/                      # Flask Python API
│   ├── app.py                    # App factory, blueprints, migrations, seed data
│   ├── config.py                 # Configuration (DB, upload limits, mail, rate limits)
│   ├── extensions.py             # db, mail, limiter instances
│   ├── requirements.txt          # Python dependencies
│   ├── .env                      # SECRET_KEY, JWT_SECRET_KEY
│   ├── models/                   # SQLAlchemy ORM models
│   │   ├── models.py             # 15 core models (Property, Lead, Admin, etc.)
│   │   ├── cms_models.py         # HeroSlide, Service, Advantage
│   │   ├── analytics_model.py    # PageVisit, SearchLog, BannerClick
│   │   ├── contactus.py          # Contactus model
│   │   ├── setting_model.py      # Key-value settings
│   │   └── testimonial_model.py  # Testimonial model
│   ├── routes/                   # Flask blueprints (14 route files)
│   │   ├── admin_routes.py       # Auth, property CRUD, users, reports (1553 lines)
│   │   ├── public_routes.py      # Public property listing, submit, FAQ, types
│   │   ├── cms_routes.py         # Hero slides, services, advantages, media
│   │   ├── gallery_routes.py     # About gallery + file system gallery
│   │   ├── leads_routes.py       # Lead pipeline, interactions, auto-assign
│   │   ├── settings_routes.py    # Key-value settings with caching
│   │   ├── analytics_routes.py   # Visit/search/banner tracking + admin dashboards
│   │   ├── contact_routes.py     # Contact form + admin contacts
│   │   ├── pages_routes.py       # Static page content management
│   │   ├── faq_routes.py         # FAQ CRUD
│   │   ├── team_routes.py        # Team member CRUD
│   │   ├── testimonial_routes.py # Testimonial CRUD
│   │   ├── types_routes.py       # Property types CRUD
│   │   └── __init__.py
│   └── utils/
│       └── helpers.py            # generate_listing_id(), paginate()
│
├── frontend/                     # Next.js 16 App Router frontend
│   ├── app/                      # App Router pages
│   │   ├── layout.tsx            # Root layout (nav, location chips, footer, providers)
│   │   ├── globals.css           # Tailwind + custom design system variables
│   │   ├── page.tsx              # Homepage (hero, featured, services, advantages, testimonials, FAQ)
│   │   ├── post/                 # Public property submission page
│   │   ├── properties/           # Public property listing with search/filter/sort
│   │   ├── property/[id]/        # Property detail page with contact form
│   │   ├── about/                # About page with team gallery
│   │   ├── contact/              # Contact page with form
│   │   ├── privacy-policy/       # Privacy policy (CMS-managed)
│   │   ├── terms/                # Terms of service (CMS-managed)
│   │   ├── reset-password/       # Password reset
│   │   ├── admin/                # Admin login page
│   │   ├── admin/layout.tsx      # Admin layout (sidebar, topbar, auth check, session timer)
│   │   └── admin/(dashboard)/    # Protected admin dashboard pages (28 page files)
│   ├── components/               # Shared React components
│   │   ├── admin/                # Admin-specific components
│   │   ├── post-property/        # Property submission form components
│   │   ├── Navbar.tsx, Footer.tsx, LocationChips.tsx
│   │   ├── PropertyCard.tsx, SearchBar.tsx, ImageSlider.tsx
│   │   ├── ImageUploader.tsx, SectionContent.tsx
│   │   ├── Toast.tsx, ConfirmModal.tsx, LayoutWrapper.tsx
│   ├── hooks/                    # React hooks
│   │   ├── useAuth.tsx           # Auth context + provider
│   │   ├── useConfirm.tsx        # Confirm dialog hook
│   │   └── useSettings.tsx       # Settings context + provider
│   ├── lib/
│   │   └── api.ts                # Axios instance, CSRF, property ID encoding
│   └── middleware.ts             # Admin route authentication guard
│
├── uploads/                      # File storage directory
├── .opencode/                    # AI coding assistant config
├── AGENTS.md                     # AI agent instructions
├── PROJECT-SPECIFICATION.md      # This document
├── FULL-STACK-AUDIT-REPORT.md    # Security & production audit (104 items)
├── opencode.json                 # OpenCode configuration
└── cookies.txt
```

---

## 3. Database Schema (25+ Tables)

### 3.1 Core Property Tables

#### `properties`
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK AI | |
| listing_id | VARCHAR(20) UNIQUE | Auto-generated `PROP-######` |
| title | VARCHAR(255) NOT NULL | |
| description | TEXT | Composed from templates + features |
| transaction_type | ENUM('sell','rent') | |
| property_type | VARCHAR(50) | FK to `property_types.value` |
| price | NUMERIC(12,2) | |
| location | VARCHAR(255) | |
| status | ENUM('pending','approved','rejected') | Default: pending |
| is_active | BOOLEAN | Visibility toggle |
| is_featured | BOOLEAN | Featured on homepage |
| is_verified | BOOLEAN | Verification badge |
| is_closed | BOOLEAN | Deal closed flag |
| overview_template_id | INT FK → description_templates | |
| closing_template_id | INT FK → description_templates | |
| title_template_id | INT FK → description_templates | |
| selected_chips | TEXT | JSON of selected feature chip labels |
| uploaded_by | INT FK → admins | |
| created_at | DATETIME | |
| updated_at | DATETIME | |
| closed_at | DATETIME | |

**Indexes:** status+is_active, is_featured, location, created_at, uploaded_by, price

#### `property_images`
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | |
| property_id | INT FK → properties (CASCADE) | |
| image_url | VARCHAR(500) | |
| order | INT | Display ordering |

#### `property_contacts`
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | |
| property_id | INT FK → properties (CASCADE) | |
| type | VARCHAR(20) | "owner" |
| name | VARCHAR(100) | |
| email | VARCHAR(150) | Nullable |
| mobile | VARCHAR(20) | Nullable |
| created_at | DATETIME | |

**Unique:** property_id + type

#### `property_type_fields`
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | |
| property_type_value | VARCHAR(50) | FK to property_types.value |
| field_key | VARCHAR(50) | |
| field_label | VARCHAR(100) | |
| field_label_mr | VARCHAR(100) | Marathi label |
| field_label_hi | VARCHAR(100) | Hindi label |
| field_type | ENUM('chip','select','unit_input') | |
| options | JSON | For select/chip types |
| unit_options | JSON | For unit_input type |
| placeholder | VARCHAR(255) | |
| sort_order | INT | |
| is_active | BOOLEAN | |
| is_required | BOOLEAN | |

**Unique:** property_type_value + field_key

#### `property_field_values`
| Column | Type |
|--------|------|
| id | INT PK |
| property_id | INT FK → properties (CASCADE) |
| field_key | VARCHAR(50) |
| field_value | VARCHAR(500) |

#### `property_types`
| Column | Type |
|--------|------|
| id | INT PK |
| name | VARCHAR(100) |
| value | VARCHAR(50) UNIQUE |
| category | ENUM('property','transaction') |
| is_active | BOOLEAN |
| sort_order | INT |

#### `description_templates`
| Column | Type |
|--------|------|
| id | INT PK |
| category | VARCHAR(50) | 'title', 'overview', 'closing' |
| property_type | VARCHAR(50) | Nullable = applies to all |
| template_text | TEXT | With `{variable}` placeholders |
| sort_order | INT |
| is_active | BOOLEAN |

#### `preset_features` / `property_features`
| Column | Type |
|--------|------|
| id (preset_features) | INT PK |
| label | VARCHAR(100) |
| sentence | TEXT | Full sentence for description |
| is_active | BOOLEAN |
| sort_order | INT |

| Column | Type |
|--------|------|
| id (property_features) | INT PK |
| property_id | INT FK → properties (CASCADE) |
| feature_id | INT FK → preset_features (CASCADE) |

**Unique:** property_id + feature_id

### 3.2 Auth & Users

#### `admins`
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | |
| user_id | VARCHAR(20) UNIQUE | Custom employee ID |
| username | VARCHAR(100) UNIQUE | Login identifier |
| email | VARCHAR(120) UNIQUE | |
| name | VARCHAR(120) | |
| password | VARCHAR(255) | bcrypt hashed |
| role | VARCHAR(20) | 'admin' or 'power_user' |
| phone | VARCHAR(20) | |
| whatsapp | VARCHAR(20) | |
| profile_image | VARCHAR(255) | |
| is_active | BOOLEAN | Account disable flag |
| reset_token | VARCHAR(255) | Password reset |
| reset_token_expiry | DATETIME | |
| created_at | DATETIME | |
| last_login | DATETIME | |

### 3.3 Lead Management

#### `leads`
| Column | Type |
|--------|------|
| id | INT PK |
| property_id | INT FK → properties (SET NULL) |
| name | VARCHAR(100) |
| email | VARCHAR(150) |
| mobile | VARCHAR(15) |
| source | VARCHAR(50) | Default: 'website' |
| status | INT FK → lead_statuses |
| assigned_to | INT FK → admins |
| stage | VARCHAR(20) | NEW / ACTIVE / WON / NOT_INTERESTED |
| lead_status | VARCHAR(20) | ACTIVE / ARCHIVED |
| rejection_reason | VARCHAR(100) |
| follow_up_at | DATETIME |
| archived_at | DATETIME |
| notes | TEXT |
| created_at / updated_at | DATETIME |

**Indexes:** property_id, source, status, created_at, stage, archived_at

#### `lead_statuses`
| Column | Type |
|--------|------|
| id | INT PK |
| name | VARCHAR(50) UNIQUE |
| color | VARCHAR(7) | Hex color |
| sort_order | INT |
| is_active | BOOLEAN |

#### `lead_history`
| Column | Type |
|--------|------|
| id | INT PK |
| lead_id | INT FK → leads (CASCADE) |
| status | INT FK → lead_statuses |
| type | VARCHAR(50) | Call / WhatsApp / Site Visit / Meeting / Email / System Note |
| remarks | TEXT |
| followup_date | DATETIME |
| created_by | INT FK → admins |
| created_at | DATETIME |

### 3.4 CMS Models

#### `hero_slides`
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | |
| image | VARCHAR(500) | Background image path |
| background_color | VARCHAR(7) | Fallback when no image |
| title | TEXT | |
| subtitle | TEXT | |
| button_text | VARCHAR(255) | |
| button_link | VARCHAR(500) | |
| sort_order | INT | |
| is_active | BOOLEAN | |
| overlay_opacity | INT | 0-100, default: 40 |
| content_vertical | VARCHAR(20) | top / middle / bottom |
| title_align | VARCHAR(20) | left / center / right |
| title_color | VARCHAR(7) | |
| title_font_size | VARCHAR(10) | px value |
| title_font_family | VARCHAR(255) | |
| title_font_style | VARCHAR(50) | normal / bold / italic / bold-italic |
| title_line_height | VARCHAR(10) | px value |
| subtitle_align | VARCHAR(20) | |
| subtitle_color | VARCHAR(7) | |
| subtitle_font_size | VARCHAR(10) | |
| subtitle_font_family | VARCHAR(255) | |
| subtitle_font_style | VARCHAR(50) | |
| subtitle_line_height | VARCHAR(10) | |
| button_align | VARCHAR(20) | |
| button_color | VARCHAR(7) | |
| button_bg_color | VARCHAR(7) | |
| button_font_family | VARCHAR(255) | |
| button_font_size | VARCHAR(10) | |
| button_font_style | VARCHAR(50) | |

#### `services` / `advantages`
| Column | Type |
|--------|------|
| id | INT PK |
| title | VARCHAR(255) |
| description | TEXT |
| image / icon_ref | VARCHAR(500) |
| is_active | BOOLEAN |
| sort_order | INT |

#### `testimonials`
| Column | Type |
|--------|------|
| id | INT PK |
| name | VARCHAR(100) |
| rating | INT |
| content | TEXT |
| is_active | BOOLEAN |
| sort_order | INT |

### 3.5 Other Tables

`page_visits`, `search_logs`, `banner_clicks` — Analytics tracking  
`settings` — Key-value site configuration  
`contactus` — Contact form submissions  
`faqs` — FAQ entries  
`team_members` — Team profiles with social links  
`about_gallery_images` — About page photo gallery  
`activity_log` — Admin action audit trail  
`password_reset_requests` — Public password reset submissions  
`property_audit_log` — Per-property action audit trail  

---

## 4. API Architecture

### 4.1 Blueprints Registered (in order)

| Blueprint | Prefix | File |
|-----------|--------|------|
| `public_bp` | `/api` | public_routes.py |
| `cms_bp` | `/api` | cms_routes.py |
| `pages_bp` | `/api` | pages_routes.py |
| `types_bp` | `/api` | types_routes.py |
| `team_bp` | `/api` | team_routes.py |
| `testimonial_bp` | `/api` | testimonial_routes.py |
| `faq_bp` | `/api` | faq_routes.py |
| `contact_bp` | `/api` | contact_routes.py |
| `leads_bp` | `/api` | leads_routes.py |
| `settings_bp` | `/api` | settings_routes.py |
| `admin_bp` | `/api/admin` | admin_routes.py |
| `gallery_bp` | `/api/admin` | gallery_routes.py |
| `analytics_bp` | `/api/admin` | analytics_routes.py |

### 4.2 Key API Endpoints

#### Public Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/properties` | List approved+active properties (filterable: location, type, transaction_type, search) |
| GET | `/api/property/<id>` | Property detail |
| POST | `/api/submit-property` | Submit property (multipart) |
| POST | `/api/property/<id>/contact` | Lead generation from property |
| GET | `/api/faq` | Public FAQ |
| GET | `/api/types` | Property/transaction types |
| GET | `/api/team` | Team members |
| GET | `/api/description-templates` | Filterable by property_type |
| GET | `/api/preset-features` | All preset features |
| GET | `/api/location-counts` | Property counts by location |
| GET | `/api/property-type-fields/<type>` | Dynamic form fields (lang param) |
| GET | `/api/pages/<slug>` | Static page content |
| GET | `/api/pages/<slug>/sections` | Page sections |
| GET | `/api/about-gallery` | About page gallery |
| GET | `/api/settings` | Public settings (whitelisted keys) |
| POST | `/api/contact` | Contact form |
| GET | `/api/hero` | Active hero slides |

#### Admin Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/login` | JWT login with rate limiting |
| POST | `/api/admin/logout` | Clear JWT cookies |
| GET | `/api/admin/check-auth` | Validate session, get user |
| GET/PUT | `/api/admin/profile` | Admin profile |
| PUT | `/api/admin/profile` | Update profile + password change |
| GET | `/api/admin/users` | List all admin users |
| POST | `/api/admin/users` | Create user |
| PUT | `/api/admin/users/<id>` | Update user |
| DELETE | `/api/admin/users/<id>` | Delete user |
| GET | `/api/admin/properties` | List all properties (paginated) |
| POST | `/api/admin/property` | Create property |
| GET | `/api/admin/property/<id>` | Get property detail |
| PUT | `/api/admin/property/<id>` | Update property |
| DELETE | `/api/admin/property/<id>` | Delete (only if is_closed) |
| POST | `/api/admin/property/<id>/close` | Close property |
| POST | `/api/admin/property/<id>/reopen` | Reopen property |
| POST | `/api/admin/property/<id>/approve` | Approve property |
| POST | `/api/admin/property/<id>/reject` | Reject property |
| POST | `/api/admin/toggle-visibility/<id>` | Toggle is_active |
| POST | `/api/admin/toggle-featured/<id>` | Toggle is_featured |
| POST | `/api/admin/toggle-verified/<id>` | Toggle is_verified |
| POST | `/api/admin/property-image` | Upload image |
| DELETE | `/api/admin/property-image/<id>` | Delete image |
| POST | `/api/admin/property/images/reorder` | Reorder images |
| GET | `/api/admin/description-templates` | List all |
| POST/PUT/DELETE | `/api/admin/description-templates[/<id>]` | CRUD |
| GET/POST/PUT/DELETE | `/api/admin/preset-features[/<id>]` | CRUD |
| GET/POST/PUT/DELETE | `/api/admin/hero[/<id>]` | Hero slides CRUD |
| POST | `/api/admin/hero/<id>/toggle` | Toggle hero slide active |
| POST | `/api/admin/hero/reorder` | Reorder hero slides |
| GET/POST/PUT/DELETE | `/api/admin/services[/<id>]` | Services CRUD |
| GET/POST/PUT/DELETE | `/api/admin/advantages[/<id>]` | Advantages CRUD |
| GET/POST/PUT/DELETE | `/api/admin/testimonials[/<id>]` | Testimonials CRUD |
| GET/POST/PUT/DELETE | `/api/admin/faq[/<id>]` | FAQ CRUD |
| GET/POST/PUT/DELETE | `/api/admin/leads[/<id>]` | Lead CRUD |
| POST | `/api/admin/lead/<id>/assign` | Auto-assign lead |
| POST | `/api/admin/lead/<id>/archive` | Archive lead |
| POST | `/api/admin/lead/<id>/reopen` | Reopen lead |
| POST | `/api/admin/lead/<id>/interaction` | Log interaction |
| GET | `/api/admin/lead/<id>/history` | Lead history |
| GET | `/api/admin/my-summary` | Dashboard summary stats |
| GET | `/api/admin/reports/properties` | Property reports |
| GET | `/api/admin/reports/leads` | Lead reports |
| GET/PUT | `/api/admin/settings` | Full settings CRUD |
| GET | `/api/admin/gallery/folders` | List folders/files |
| POST/PUT/DELETE | `/api/admin/gallery/folder[/<id>]` | Folder operations |
| PUT | `/api/admin/gallery/file` | Rename file + update DB refs |
| DELETE | `/api/admin/gallery/file/<id>` | Delete file |
| POST | `/api/admin/gallery/upload` | Upload file |
| GET/POST/PUT/DELETE | `/api/admin/about-gallery[/<id>]` | About gallery CRUD |
| GET | `/api/admin/analytics` | Dashboard analytics |
| GET | `/api/admin/analytics/traffic` | Traffic source data |
| GET | `/api/admin/analytics/searches` | Search insights |
| GET | `/api/admin/analytics/banners` | Banner performance |

### 4.3 Auth & Security

- **JWT** stored in HTTP-only cookies (`access_token_cookie`)
- **CSRF** via double-submit cookie pattern (`csrf_access_token`)
- **Rate limiting**:
  - Login: 5/minute per user, 20/minute global
  - Forgot password: 3/hour
  - Public property submission: 10/hour
  - General: 200/day, 50/hour per user
- **File validation**: Extension + magic byte signature verification
- **Supported uploads**: jpg, jpeg, png, gif, webp, avif, svg, ico, pdf, doc, docx
- **Roles**: `admin` (full access) and `power_user` (limited, primarily lead management)

### 4.4 Session Management

- Configurable session timeout (1-120 minutes, default: 30)
- Warning banner appears 2 minutes before timeout with live countdown
- Auto-logout on expiry
- Activity-based timer reset (mousedown, mousemove, keydown, scroll, touchstart, click)

---

## 5. Frontend Architecture

### 5.1 Tech Stack

- **Next.js 16.2.3** with App Router
- **React 19.2.5**
- **TypeScript 6.0.2**
- **Tailwind CSS 3.4.4**
- **Swiper 12.1.3** (homepage carousels)
- **Axios** (HTTP client)
- **DOMPurify** (HTML sanitization)
- **@dnd-kit** (drag-and-drop: hero slides, CMS sections, FAQ, gallery folders)

### 5.2 Design System (CSS Custom Properties)

Defined in `globals.css` (366 lines):

```css
--primary: #0f4cba          /* Primary brand blue */
--primary-hover: #1e40af    /* Darker hover state */
--secondary: #1e40af        /* Footer/header bg */
--bg-page: #f8fafc          /* Page background */
--text-dark: #1e293b        /* Primary text */
--text-muted: #94a3b8       /* Secondary text */
--shadow-sm, --shadow-md    /* Card shadows */
--radius: 0.75rem           /* Border radius */
```

Component classes: `.btn` (primary/secondary/ghost, sm/lg), `.card`, `.form-input`, `.chip`, `.chip-selected`, `.preset-chip`, `.lang-btn`, `.inline-unit-group`

### 5.3 Component Tree

```
Root Layout (layout.tsx)
├── SettingsProvider (useSettings)
├── ToastProvider
├── ConfirmProvider
├── Navbar (responsive, site name/logo from settings, search, mobile menu)
├── <main> {children}
│   ├── Homepage (page.tsx)
│   │   ├── HeroSection (Swiper, Ken Burns, banner click tracking)
│   │   ├── SectionHeader
│   │   ├── FeaturedSection (property cards in Swiper, pagination)
│   │   ├── ServicesSection (3-column grid)
│   │   ├── AdvantagesSection (4-column grid, SVG icons)
│   │   ├── TestimonialsSection (Swiper, star ratings, avatar initials)
│   │   └── FaqSection (accordion, animated expand/collapse)
│   ├── Properties (/properties) → PropertyCard[]
│   ├── Property Detail (/property/[id]) → ImageSlider, contact form
│   ├── Post Property (/post) → Dynamic form fields, ImageUploader, gallery picker
│   ├── About (/about) → Team gallery, content sections
│   ├── Contact (/contact) → Form with validation
│   │
│   └── Admin (/(dashboard)/)
│       ├── Dashboard → AdminDashboard (stats cards, quick actions)
│       ├── Properties → List (sortable, filterable, paginated)
│       ├── Properties/[id] → Edit (full form with dynamic fields, images, templates)
│       ├── Add-Property → Create form
│       ├── Contacts → List (employee/guest filter, sortable)
│       ├── Leads → Full pipeline (stages, interactions, archive)
│       ├── Users → CRUD table with modal form
│       ├── CMS → Section ordering (dnd-kit), visibility toggles
│       │   ├── Hero → Full slideshow editor (drag-reorder, split-screen, live preview, 30+ settings per slide)
│       │   ├── Services, Advantages, Testimonials, FAQ → CRUD with reorder
│       │   ├── Featured → Property selector
│       │   └── Footer → CMS fields
│       ├── Pages → About, Contact, Privacy, Terms (section-based content management)
│       ├── Gallery → File browser (grid/list), folder management, batch upload, thumb sizes
│       ├── Messages → Contact form submissions
│       ├── Settings → Site name, logo, brand colors, social links, session, hero animation
│       ├── Reports → Property/lead/agent stats
│       └── Analytics → Traffic, search, banner performance dashboards
├── LocationChips (all locations, 6-column even distribution, respects visibility toggle)
└── Footer (social links from settings, copyright, legal nav)
```

### 5.4 Key Frontend Features

#### Public Property Submission (`/post`)
- Dynamic form fields that change based on property type (flat/plot/house/commercial)
- Multi-language field labels (English, Marathi, Hindi) — `lang` query param
- Template-based title/overview/closing with `{variable}` interpolation
- Preset feature chips (amenities toggle)
- Mobile number validation: each number must be 10+ digits, multiple numbers comma-separated
- Email validation: basic format check
- File upload with preview
- Guest submission without login

#### Admin Hero CMS (`/admin/cms/hero`)
- Split-screen layout: thumbnail strip (left/drag-reordable) + live preview (right)
- Form disabled by default; enabled only via "+ New" or "Edit"
- Mobile view: defaults to preview panel; clicking "+ New" or "Edit" switches to form
- 30+ customizable properties per slide: image, background_color, title, subtitle, button (text/link), overlay_opacity, content_vertical (top/middle/bottom), individual align/color/font/size/style/line-height for each text element
- Ken Burns animation toggle
- Drag-and-drop reorder via @dnd-kit

#### Property Management
- **List**: sortable columns (id, title, status, owner_name, created_at), tab filters (All/Pending/Approved/Rejected/Closed), search, Show/Hide toggle (hidden for closed/rejected), featured toggle, verified toggle, pagination
- **Edit**: full form with dynamic fields, description templates, image upload/reorder, owner contact, preset features, status actions (approve/reject/close/reopen)

#### Lead Pipeline
- Kanban-style or list view with pipeline stages (NEW → ACTIVE → WON or NOT_INTERESTED)
- Auto-assignment to admin users
- Interaction logging (Call, WhatsApp, Site Visit, Meeting, Email, System Note)
- Follow-up scheduling
- Archive / Reopen
- Customizable lead statuses

#### Gallery System
- Dual-mode: grid view (with S/M/B/XL thumb sizes) and list view
- Folder creation, rename, delete
- Upload with drag-and-drop
- File rename that propagates across all DB references (hero slides, services, testimonials, about gallery, property images, team members, admin profiles)
- Batch image removal (compressor and crop tool UI removed but code kept)

#### Analytics (`/admin/analytics`)
- Page visit tracking (path, referrer, user-agent, timestamp)
- Search log tracking (query, result count)
- Banner click tracking (slide ID, position)
- Admin dashboards: traffic sources, search insights, banner performance

#### Location Chips
- **Footer** (LocationChips component): all unique DB locations in 6-column even-distribution grid with `truncate`, respects `section_locations_visible` setting
- **Homepage and Properties page**: capped at 14 locations, clickable to filter properties

#### Settings (`/admin/settings`)
- General: site_name, site_logo (gallery picker)
- Social: Facebook, Instagram, Twitter, YouTube, LinkedIn — URL inputs, rendered as SVG icons in footer
- Branding: primary, secondary colors, button text
- Styling: hero animation (kenburns/none)
- Session: timeout_minutes configurable
- Section visibility keys: hero, services, advantages, testimonials, featured, faq, locations
- Section order: JSON array stored in settings

---

## 6. Validation Rules

### 6.1 Mobile Number (all forms)
- Each number must have at least 10 digits (non-digits stripped)
- Multiple numbers allowed, separated by comma
- Helper text below field: "For multiple numbers, separate with comma"

### 6.2 Email (all forms)
- Must match pattern: `*@*.*`
- Basic format validation on submit

### 6.3 Property Submission
- Required: name, mobile (or email), title, location, transaction_type, property_type
- Dynamic type-specific fields validated if marked `is_required`
- Floor level cannot exceed total floors
- Price: optional, supports "Connect for Price", "crore"/"lakh"/"k" multipliers

### 6.4 Price Parsing (Backend)
- Regex extracts digits and optional crore/lakh/k multipliers
- "1.5 crore" → 15000000, "25 lakh" → 2500000, "50k" → 50000

### 6.5 File Upload (Backend)
- Extension whitelist: jpg, jpeg, png, gif, webp, avif, svg, ico, pdf, doc, docx
- Magic byte validation
- Max file size: 10MB per file, 50MB total
- Image optimization: webp/avif conversion config

---

## 7. CMS Content Management

### 7.1 Page Sections System

The admin `pages/` module provides section-based content management for static pages:
- **About page**: Hero, Mission, Vision, Team sections + TeamMember model
- **Contact page**: Hero Title, Hero Subtitle, Hero Card, Details Title, Address, Phone, Email, Website, Hours, Success Title, Success Text
- **Privacy page** / **Terms page**: Simple HTML content sections with save/save-all

Each section has: id, page_slug, label, content (text), content_html, sort_order, is_active

### 7.2 Homepage Section Ordering

Sections can be reordered via drag-and-drop and individually toggled visible/hidden:
1. Hero Section
2. Services
3. Advantages
4. Testimonials
5. Featured Properties
6. FAQ
7. Location Tags (Footer)

---

## 8. Lead Pipeline States

| Stage | Description |
|-------|-------------|
| NEW | New inquiry, unassigned |
| ACTIVE | Being worked on by assigned agent |
| WON | Successfully converted |
| NOT_INTERESTED | Lost/dead lead |

| Lead Status | Description |
|-------------|-------------|
| ACTIVE | In active pipeline |
| ARCHIVED | Moved to archive |

### Interaction Types
- Call
- WhatsApp
- Site Visit
- Meeting
- Email
- System Note

---

## 9. Known Production Considerations (from FULL-STACK-AUDIT-REPORT.md)

A 104-item security & production audit was performed. Key findings:
- **Hardcoded secret**: JWT_SECRET_KEY in .env, SECRET_KEY in config
- **No HTTPS enforcement** in development
- **CSRF protection** via double-submit cookie pattern (implemented)
- **XSS prevention**: DOMPurify on CMS content fields
- **SQL injection**: mitigated via SQLAlchemy ORM
- **Rate limiting**: implemented on auth/public endpoints
- **File upload validation**: extension + magic bytes

---

## 10. Frontend Environment Configuration

**`.env.example`**:
```
NEXT_PUBLIC_API_BASE=http://localhost:5000/api
ADMIN_EMAIL=admin@realtyhub.com
SITE_URL=http://localhost:3000
```

**`next.config.js`**:
- API rewrite: `/api/:path*` → `http://localhost:5000/api/:path*`
- Uploads proxy: `/uploads/:path*` → `http://localhost:5000/uploads/:path*`
- Security headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

---

## 11. Data Flow Examples

### 11.1 Public Property Submission
```
User fills /post form
  → Dynamic fields fetched from /api/property-type-fields/{type}?lang=en
  → Templates fetched from /api/description-templates?property_type={type}
  → Preset features from /api/preset-features
  → User selects overview/closing/title templates + toggles feature chips
  → form.description auto-composed from template interpolation + feature sentences
  → User can override description via textarea
  → FormData POST to /api/submit-property (multipart: all fields + images)
  → Backend validates, creates Property record, saves images to uploads/{listing_id}/
  → Creates PropertyContact (owner), PropertyValue (dynamic fields), PropertyFeature (features)
  → Returns listing_id, status: pending
  → Admin approves via /api/admin/property/{id}/approve
  → Property appears on public /properties page
```

### 11.2 Lead Generation Flow
```
Visitor on /property/{id} fills inquiry form
  → POST /api/property/{id}/contact { name, email, mobile }
  → Backend creates Lead (stage: NEW, source: 'property_page', property_id)
  → Auto-assigned to least-loaded admin via round-robin
  → Admin views lead in /admin/leads, updates stage, logs interactions
  → Follow-up scheduled, notifications (future)
```

### 11.3 Gallery File Rename
```
Admin renames file in /admin/gallery
  → PUT /api/admin/gallery/file { old_path, new_filename }
  → Backend renames physical file on disk
  → Searches all model tables for old path in relevant columns:
    HeroSlide.image, Service.image, Testimonial.image,
    AboutGalleryImage.image_url, PropertyImage.image_url,
    TeamMember.photo, Admin.profile_image
  → Updates all matching references to new path
  → Returns success
```

---

## 12. Backend Configuration

### config.py Key Settings
| Setting | Value |
|---------|-------|
| SECRET_KEY | Auto-generated if missing |
| JWT_SECRET_KEY | Auto-generated if missing |
| SQLALCHEMY_DATABASE_URI | postgresql+psycopg2://postgres@localhost:5432/realtyhub |
| UPLOAD_FOLDER | ../uploads |
| MAX_CONTENT_LENGTH | 50 * 1024 * 1024 (50MB) |
| MAX_FILE_SIZE | 10 * 1024 * 1024 (10MB) |
| JWT_TOKEN_LOCATION | cookies |
| JWT_COOKIE_CSRF_PROTECT | True |
| JWT_SESSION_TIME | 1800s (30 min) |
| RATELIMIT_ENABLED | True |

### requirements.txt Key Packages
Flask 3.1.3, SQLAlchemy 2.0.48, Flask-JWT-Extended 4.7.1, bcrypt 4.3.0,
psycopg2-binary 2.9.11, Flask-CORS 5.0.1, Flask-Limiter 4.1.1, Flask-Mail 0.10.0,
gunicorn 25.3.0, python-dotenv 1.2.2

---

## 13. TypeScript & Build

- **TypeScript**: Clean compilation (`npx tsc --noEmit` passes with 0 errors)
- **Lint**: `npm run lint` available
- **Build**: Standard Next.js production build via `npm run build`

---

## 14. Summary of Files

| Layer | Count | Details |
|-------|-------|---------|
| Backend Python files | 22 | app.py, config.py, extensions.py, 6 models, 14 routes, helpers |
| Frontend pages | 35+ | Root layout, 6 public pages, 28 admin dashboard pages |
| Frontend components | 15+ | Navbar, Footer, LocationChips, PropertyCard, admin components, etc. |
| Frontend hooks | 3 | useAuth, useConfirm, useSettings |
| Frontend config files | 8 | package.json, next.config.js, tailwind.config.js, tsconfig.json, etc. |
| Database tables | 25+ | Properties, images, contacts, leads, hero slides, services, etc. |
| API endpoints | 80+ | Public (15) + Admin (70+) |
