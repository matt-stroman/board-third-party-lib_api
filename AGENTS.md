# Board Third Party Library API (Postman API-First)

## Purpose

This submodule is the API-first design workspace for the Board Third Party Library.

It is intended to be the versioned home for:

- API definitions/specifications (OpenAPI)
- Postman collections generated from and/or aligned to the API definitions
- Postman environments (non-secret templates)
- Mock-ready examples and request tests for API contract validation

## Primary Development Approach (Contract-First)

- Start in **Postman API Builder** with an API definition before backend implementation.
- Treat the API contract as the primary source of truth for endpoint shapes and semantics.
- Use Postman collections and environments as executable contract checks and workflow tests.
- Use mock servers/examples to unblock frontend/client work before backend endpoints are implemented.

## Source of Truth Rule

- **Primary source of truth:** OpenAPI definition(s) in this repo / API Builder.
- Collections should be generated from or kept explicitly aligned to the spec.
- Avoid editing spec and collection independently in ways that cause drift.

When endpoint behavior changes, update all applicable artifacts:

1. OpenAPI spec
2. Examples
3. Postman collection request/tests
4. Environments (if expectations/variables change)
5. Backend implementation (in `backend/`)

## Scope Boundaries

- This submodule contains API design/testing artifacts only.
- Backend implementation code, database, and backend-only scripts belong in `backend/`.
- Frontend implementation code belongs in `frontend/`.
- Root repo remains focused on orchestration across submodules.

## Structure Guidance

Prefer this layout as the API grows:

- `postman/specs/` for OpenAPI definitions
- `postman/collections/` for generated and workflow collections
- `postman/environments/` for non-secret environment templates
- `postman/globals/` only when truly needed
- `.postman/config.json` for Postman workspace/repo metadata

## Postman Standards (for this project)

- Prefer **OpenAPI 3.0** for smoother Postman sync/generation workflows.
- Start with a **single-file** spec until the API surface justifies multi-file splitting.
- Use domain-oriented tags (e.g., `Health`, `Catalog`, `DeveloperIntegrations`, `Payments`, `Entitlements`).
- Include explicit examples for success and common error responses.
- Define consistent error response schemas early.
- Keep environment files non-secret; do not commit tokens/secrets.

## Testing Philosophy

- Postman tests in this repo validate the API contract and workflow behavior from a client perspective.
- Backend unit/integration tests in `backend/` still validate implementation correctness and persistence behavior.
- These are complementary, not replacements for each other.

## Collaboration Guidance

- Keep names stable and descriptive (API name, version names, tags, folders).
- Favor small, reviewable contract increments (one domain slice at a time).
- Start with mock-friendly examples so frontend/client development can proceed in parallel.
- Update this `AGENTS.md` as the API-first workflow evolves (tooling conventions, sync rules, versioning rules).
