# OpenCode System Instructions — Nagpur Realty Hub

## Response Style
- Keep responses concise and focused on code. Avoid unnecessary conversational filler.

## Plan Mode Instructions
- Ask clarifying questions before proposing large architectural changes.
- Do not make assumptions about database schemas, API contracts, or page layouts.

## Build & Edit Mode Instructions
- You may edit small, single-file changes directly.
- For large full-stack features spanning both `frontend/` and `backend/`, break down tasks systematically.

## Validation & Code Quality
- **Frontend Checks (`/frontend`):** Run `npm run lint` or `npx tsc --noEmit` only when completing major React/TypeScript features (do not run `npm run build` after every minor change).
- **Backend Checks (`/backend`):** Ensure Python syntax is valid and SQLAlchemy ORM models use 2.0 type declarations (`Mapped[]`, `mapped_column()`).
- Always ensure Flask API endpoints and Next.js fetch functions match data contracts.

