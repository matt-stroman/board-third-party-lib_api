# Initial Data Schema Plan (Historical Context Only)

## Table of Contents

- [Status and Usage](#status-and-usage)
- [Source of Truth (Current State)](#source-of-truth-current-state)
- [Planning Scope (What This Initial Plan Covered)](#planning-scope-what-this-initial-plan-covered)
- [Initial Domain and Schema Plan](#initial-domain-and-schema-plan)
- [Key Modeling Decisions Captured Here](#key-modeling-decisions-captured-here)
- [Initial Relationships (Conceptual)](#initial-relationships-conceptual)
- [Wave Alignment](#wave-alignment)
- [Future Agent Guidance](#future-agent-guidance)

## Status and Usage

**This document is an initial planning snapshot only. It is not a maintained schema specification and should not be treated as the current source of truth.**

It exists to preserve important design intent from early API-first and schema planning discussions so future agents/developers have context for why certain entities/relationships were proposed.

Important current-state note:

- this historical plan predates the move to Keycloak-backed authentication
- Keycloak now owns credentials, email verification, external identity providers, and platform role assignment
- the current backend schema direction should not be expected to include `user_password_credentials`, `user_email_addresses`, or `user_external_identities` as primary auth tables

Use this document for:

- historical planning context
- design rationale
- early domain vocabulary

Do **not** use this document as the authoritative definition of current tables/columns/constraints.

## Source of Truth (Current State)

Current authoritative sources should be treated as:

- API contract: [`api/postman/specs/board-third-party-library-api.v1.openapi.yaml`](../postman/specs/board-third-party-library-api.v1.openapi.yaml)
- Backend schema implementation plan (high-level implementation sequencing): [`backend/planning/mvp-schema-implementation-plan.md`](../../backend/planning/mvp-schema-implementation-plan.md)
- Developer-facing data ownership guide: [`backend/docs/auth-data-ownership.md`](../../backend/docs/auth-data-ownership.md)
- Implemented backend code/migrations (when present): backend EF Core model + migrations in the `backend` submodule

## Planning Scope (What This Initial Plan Covered)

This initial plan focused on:

- an API-first foundation
- identity + roles setup early (to avoid painful refactors)
- developer content metadata and versioning
- Board-specific media requirements
- free-content / external APK hosting first
- deferring payment/commerce until later

It intentionally deferred detailed payment/order/entitlement implementation while preserving room for it later.

## Initial Domain and Schema Plan

The initial design split the domain into these areas:

### Identity / Auth / Roles

Planned core entities:

- `users` (platform identity root; developers and players are both users)
- `roles` (platform/global roles, e.g. `player`, `developer`, `admin`, `moderator`)
- `user_roles` (many-to-many global role assignments)
- `user_password_credentials` (email/password auth, separate from `users`)
- `user_external_identities` (OAuth/OIDC links such as GitHub / Steam / Epic)
- `user_board_profiles` (optional Board profile linkage; non-authoritative)

Email management planning (important):

- email should be easy to change and not be the identity key
- `users.id` remains the stable identity key
- preferred model discussed: `user_email_addresses` (one-to-many, primary/verified status) rather than a single immutable `users.email`

### Studios (Developer Teams)

Planned entities:

- `studios`
- `studio_memberships`

Notes:

- org membership role was planned as a simpler scoped role for MVP (e.g. `owner`, `admin`, `editor`)
- global platform roles and studio-scoped roles were intentionally kept separate

### Titles / Catalog Metadata (Versioned)

Planned entities:

- `titles` (stable identity record for a game/app)
- `title_metadata_versions` (versioned player-facing metadata snapshots)
- `title_media_assets` (Board-style media slots)

Key catalog metadata called out in planning:

- `display_name`, descriptions
- `num_players` (display + structured min/max)
- `genre` (initially display string; taxonomy deferred)
- `ages` (display + structured minimum age)

### Releases / Download Artifacts

Planned entities:

- `title_releases`
- `release_artifacts`

Initial focus:

- free titles / external APK links
- `apk` artifacts first
- versioned releases tied to title metadata snapshots where useful

### External Integrations (Scaffolded Early, Implemented Later)

Planned entities:

- `integration_connections` (org-level provider config)
- `title_integration_bindings` (link a title to integration config)

Rationale:

- support adapter-based design for external hosting/publishing/payment providers
- use provider-specific config payloads without overfitting the MVP schema

### Deferred (Planned for Later)

Intentionally deferred from initial implementation scope:

- payments / checkout / orders
- entitlements
- download/install orchestration on Board
- advanced moderation/admin tooling

The plan explicitly aimed to preserve space for these later without restructuring the title/release core.

## Key Modeling Decisions Captured Here

### Unified User Model

- Developers are also players, so a unified `users` entity was preferred.

### Board Profile Is Not the Primary Identity

- Board profile data should be treated as external/non-authoritative.
- Some users may sign up before they have a Board console.
- Board profile info may be provided later via Unity/Board SDK integration.

### Roles Early, Many-to-Many

- Global user roles were planned early to avoid future RBAC migration headaches.
- A user may hold multiple roles (e.g. `player` + `developer`).

### Email Must Be Easy to Change

- Email should be mutable and not used as the system identity key.
- This influenced discussion toward a separate email-address table model.

### Versioned Metadata, Not Just Versioned Binaries

- The plan anticipated that title metadata may differ across releases/versions.
- This led to the `titles` + `title_metadata_versions` + `title_releases` split.

### Board-Like Media Slots

The initial media planning explicitly called out three image roles to mirror the Board library UX:

- `card` (small list/card image)
- `hero` / fullscreen image
- `logo` / title image

### Genre Taxonomy Deferred (Safely)

- Advanced genre taxonomy/filtering was desired long-term.
- The initial plan deferred normalization to ship faster, while avoiding choices that would block later taxonomy introduction.

## Initial Relationships (Conceptual)

Conceptually, the plan assumed relationships like:

- `users` <-> `roles` via `user_roles`
- `studios` <-> `users` via `studio_memberships`
- `studios` -> `titles`
- `titles` -> `title_metadata_versions`
- `titles` -> `title_releases`
- `title_releases` -> `release_artifacts`
- `titles` / `title_metadata_versions` -> `title_media_assets`
- `studios` -> `integration_connections`
- `titles` <-> `integration_connections` via `title_integration_bindings`

## Wave Alignment

This initial plan was intended to align with the backend implementation waves captured later in:

- [`backend/planning/mvp-schema-implementation-plan.md`](../../backend/planning/mvp-schema-implementation-plan.md)

High-level sequence discussed:

1. Identity / roles
2. Studios / memberships
3. Titles / metadata versions
4. Media / releases / artifacts
5. Integrations
6. Payments/entitlements later

## Future Agent Guidance

When using this document for context:

- treat it as a planning narrative, not a spec
- verify current API shapes in the OpenAPI contract
- verify current schema shape in backend implementation artifacts
- prefer current code/migrations over this document when conflicts exist

If a future agent changes the domain model substantially, this file should generally remain unchanged (historical context), and new rationale should be documented in current, maintained docs instead.

