# Board Enthusiasts API (Postman API-First)

## Purpose

This submodule is the API-first design workspace for the Board Enthusiasts.

It is intended to be the versioned home for:

- API definitions/specifications (OpenAPI)
- Git-tracked Postman collections aligned to the API definitions
- Postman environments (non-secret templates)
- Mock-ready examples and request tests for API contract validation

## Primary Development Approach (Contract-First)

- Start in **Postman API Builder** with an API definition before backend implementation.
- Treat the API contract as the primary source of truth for endpoint shapes and semantics.
- Use Postman collections and environments as executable contract checks and workflow tests.
- Use mock servers/examples to unblock frontend/client work before backend endpoints are implemented.
- Do not keep future-only endpoints in the maintained contract collection once it becomes clear the backend implementation is deferred to a later wave.
- Prefer Redocly CLI for OpenAPI linting and Postman CLI plus GitHub Actions for contract execution and workspace sync.

## Source of Truth Rule

- **Primary source of truth:** OpenAPI definition(s) in this repo / API Builder.
- Collections should be generated from or kept explicitly aligned to the spec.
- Avoid editing spec and collection independently in ways that cause drift.
- Treat the Git-tracked contract/smoke test collection in `postman/collections/` as the supported executable collection artifact.
- Do not make CI, mock provisioning, or workspace sync depend on an API Builder generated collection.
- If Postman Cloud admin/provisioning requests are needed (for example mock server provisioning via Postman API), keep them in a separate Git-tracked admin collection with a distinct name and purpose.
- Split Postman environments by role when helpful:
  - runtime test environments (for day-to-day contract test execution)
  - admin/provisioning environments (for Postman Cloud resource setup/maintenance)
- Use `.postman/config.json` in the current CLI-compatible format so `postman workspace push --yes` works in local dev and CI.

When endpoint behavior changes, update all applicable artifacts:

1. OpenAPI spec
2. Examples
3. Postman collection request/tests
4. Environments (if expectations/variables change)
5. CLI/workflow automation (if the change affects sync or contract execution)
6. Backend implementation (in `backend/`)

For new endpoint delivery, the expected order is:

1. OpenAPI shape and examples
2. Git-tracked Postman mock/contract coverage
3. Backend failing tests
4. Backend implementation

## Scope Boundaries

- This submodule contains API design/testing artifacts only.
- Backend implementation code, database, and backend-only scripts belong in `backend/`.
- Frontend implementation code belongs in `frontend/`.
- Root repo remains focused on orchestration across submodules.
- For routine developer workflows in the full solution repo, prefer the root `python ./scripts/dev.py ...` commands instead of calling `api/scripts/*` directly.

## Structure Guidance

Prefer this layout as the API grows:

- `postman/specs/` for OpenAPI definitions
- `postman/collections/` for Git-tracked workflow/contract test collections
- `postman/environments/` for non-secret environment templates
- `postman/globals/` only when truly needed
- `planning/` for historical planning/context artifacts that are not the current contract source of truth
- `.postman/config.json` for Postman workspace/repo metadata
- `scripts/` for API-specific automation helpers such as Postman CLI wrappers or mock-provisioning utilities

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
- The maintained contract should describe the current implemented surface plus the wave actively under delivery, not a backlog of speculative endpoints.

## Collaboration Guidance

- Keep names stable and descriptive (API name, version names, tags, folders).
- Keep Postman Native Git tracked filenames stable once established to avoid duplicate workspace artifacts.
- Favor small, reviewable contract increments (one domain slice at a time).
- Start with mock-friendly examples so frontend/client development can proceed in parallel.
- Work from a branch, commit the finished change set, push it, and open or update a PR.
- Wait for the relevant GitHub workflow runs, inspect failures, and push fixes until the branch is green.
- Merge to `main` only after the required checks pass.
- After the PR is merged, delete the merged branch locally and remotely, prune stale remote refs, and leave the repository on a clean `main` tracking `origin/main`.
- Update this `AGENTS.md` as the API-first workflow evolves (tooling conventions, sync rules, versioning rules).
