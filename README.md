# board-third-party-lib_api

Design and tests for the API for the Board third party library.

## Table of Contents

- [Postman Workflow](#postman-workflow)
- [GitHub Actions Mock Contract Tests (CI)](#github-actions-mock-contract-tests-ci)
- [Mock-First Flow](#mock-first-flow)
- [Repository Files](#repository-files)
- [Working Rules](#working-rules)

## Postman Workflow

This repository is connected to a Postman project workspace using Postman Native Git.

Local development updates the files in this repo (`postman/`, `.postman/`), and Postman Cloud provides the API Builder, mock servers, monitors, and linked generated collections.

This project intentionally avoids Postman CLI automation in-repo for now to reduce duplicate collection creation and sync ambiguity. Sync to Postman Cloud using the Postman UI (Files/Source Control in the connected workspace).

### Recommended Model (Avoid Duplicates)

- Keep the **API Builder generated collection** in Postman Cloud only.
- Keep exactly one **Git-tracked test collection** in this repo:
  - `postman/collections/board-third-party-library-api.contract-tests.postman_collection.json`
- Keep one separate **Git-tracked Postman admin collection** for Postman Cloud provisioning tasks (mock server setup, inspection):
  - `postman/collections/postman-admin.board-third-party-library-mock-provisioning.postman_collection.json`
- Keep the OpenAPI spec as the contract source of truth:
  - `postman/specs/board-third-party-library-api.v1.openapi.yaml`
- Do not export the API Builder generated collection into this repo.
- Do not give the generated collection and the Git-tracked collection the same display name.
- While the API Builder generated collection is grouped by `Tags`, use **one primary tag per endpoint** in the OpenAPI spec to avoid duplicate generated requests.

### Manual Sync (Postman UI)

Use Postman's connected repository UI to pull/push file changes.

Typical workflow:

1. Update the OpenAPI spec and/or Git-tracked contract test collection in this repo.
2. Commit changes in the `api` repo.
3. In Postman, refresh/pull the connected repository.
4. Regenerate/update the API Builder generated collection if the spec changed.
5. Run contract tests from `Board Third Party Library API (Contract Tests)`.
6. Save/export updates to the same Git-tracked collection file when test scripts change.

### Known Postman generated collection sync quirk (tag regrouping)

Postman API Builder's generated collection does not always reliably regroup requests into tag folders after spec changes (especially when adding endpoints, changing tags, or moving endpoints between tags).

Observed behavior:

- The generated collection may show new requests at the collection root even when the OpenAPI operations are correctly tagged.
- The `Update collection` action may appear inconsistently in the Postman UI.
- Incremental updates may not fully reflect tag-folder regrouping changes.

Practical workaround (current best known process):

1. Pull/refresh the connected repository in Postman.
2. Confirm the OpenAPI definition has the correct `tags` on the affected operations.
3. Regenerate the `Board Third Party Library API (Generated)` collection.
4. If grouping is still wrong, delete the generated collection and generate it again.

Important:

- Treat the generated collection as a disposable UI artifact for browsing/manual exploration.
- Treat the OpenAPI spec and the Git-tracked contract test collection as the source of truth.
- CI mock contract tests are not affected because CI runs the Git-tracked contract test collection, not the generated collection.

## GitHub Actions Mock Contract Tests (CI)

The `api` repository includes a GitHub Actions workflow that runs the Git-tracked Postman contract tests with Newman on `push`, `pull_request`, and manual dispatch:

- Workflow file: `.github/workflows/postman-mock-contract-tests.yml`

### Required GitHub secret

- `POSTMAN_API_KEY`

Use a Postman API key for an account (or service account) that has access to the workspace referenced by the Mock Admin environment (`workspaceId` in `postman/environments/board-third-party-library_mock-admin.postman_environment.json`).

No static mock URL secret is required.

### CI mock lifecycle (per run)

To avoid stale mock URLs and stale Postman collection snapshots, the workflow performs these steps during each run:

1. Resolve the contract test collection in Postman using the Mock Admin environment metadata (name/ID).
2. Update that Postman collection from the current repo file (`postman/collections/board-third-party-library-api.contract-tests.postman_collection.json`).
3. Create a fresh Postman mock server for the run and capture its `mockUrl`.
4. Run Newman against the repo-tracked collection using the generated `mockUrl` as `baseUrl`.
5. Delete the CI-created mock server during cleanup (even if Newman tests fail).

### Fork pull requests

GitHub does not expose repository secrets to forked pull requests. The workflow detects this and skips the mock-based Newman run for fork PRs rather than failing on missing credentials.

## Mock-First Flow

The contract test collection now includes:

- saved examples for the health endpoints (including `/health/ready` `200` and `503`)
- a `Mock Validation` folder with a mock-only request that forces the saved `503` readiness example using Postman mock headers

### Files used for mock-first work

- `postman/environments/board-third-party-library_mock.postman_environment.json`
- `postman/environments/board-third-party-library_mock-admin.postman_environment.json`
- `postman/collections/postman-admin.board-third-party-library-mock-provisioning.postman_collection.json`
- `postman/collections/board-third-party-library-api.contract-tests.postman_collection.json`

### Auth note for `/identity/me/*` contract tests

The Git-tracked contract test collection now sends `Authorization: Bearer {{accessToken}}` for applicable `/identity/me/*` requests (for example email address management and verification endpoints).

Environment variables:

- `Board Third Party Library - Mock` includes a non-secret placeholder `accessToken` (mock runs only need a non-empty value when forcing saved examples).
- `Board Third Party Library - Local` includes `accessToken` as a placeholder that should be replaced with a real local bearer token once backend auth is implemented.

Security mock validation coverage is included for current `/identity/me/*` endpoints and exercises saved examples for:

- `401 Unauthorized`
- `403 Forbidden`
- `429 Too Many Requests`

### Wave 1 auth semantics (contract guidance)

The Wave 1 auth/password endpoints are still API-first contract work, but the contract now documents a few important behavioral expectations to keep backend implementation and client behavior aligned:

- **Login and unverified email**: MVP may allow login before email verification so users can complete `/identity/me/email-addresses/*` verification flows. Clients should still check verification status before enabling sensitive actions.
- **Refresh token rotation**: `POST /identity/auth/refresh` returns a replacement refresh token. Clients should store the new refresh token and discard the previously used token after a successful refresh.
- **Logout scope**: `POST /identity/auth/logout` supports a request `scope` (`current_session` default, or `all_sessions`) and is intended to be idempotent for already-revoked session/refresh-token state (while still requiring a valid bearer token to call it).
- **Password change effects**: successful password changes should invalidate outstanding password-reset challenges and revoke refresh-token/session state.
- **Password reset security**: password reset requests should be anti-enumeration (generic response), and reset tokens/challenges should be short-lived and one-time-use. A successful reset should invalidate the used token and other outstanding reset challenges for the account.

### Provision the mock server (code-driven in Postman)

The mock server is provisioned from a Postman **workspace collection object** selected by the Mock Admin environment.

Default (recommended for reliability):
- `Board Third Party Library API (Contract Tests)`

Why:
- Postman's API Builder generated collection is sometimes visible in the UI but not reliably discoverable via the Postman Collections API (`GET /collections`) used by the admin automation.
- The one-step admin request now preflights the resolved source collection snapshot (route/example checks) to catch stale workspace objects before they cause false mock test failures.

The Mock Admin environment controls which workspace collection is used as the mock source:

- `mockSourceCollectionName` (default: `Board Third Party Library API (Contract Tests)`)
- `mockSourceCollectionPostmanId` (optional exact Postman collection ID override if duplicate collections exist)

If `mockSourceCollectionName` points to a collection that is not discoverable via the Postman API (for example, some API Builder generated collection objects), the one-step admin request will try to fall back to `contractTestsCollectionName` automatically and will set a warning variable.

1. In Postman, import/sync both environments:
   - `Board Third Party Library - Mock` (day-to-day contract test runs)
   - `Board Third Party Library - Mock Admin` (mock provisioning/maintenance)
2. Select `Board Third Party Library - Mock Admin`.
3. Add your Postman API key to **Postman Vault** as `postman-api-key` (local secret), so the admin collection can use `{{vault:postman-api-key}}`.
4. Enable Vault access for scripts (one-time Postman setup) and grant this collection/workspace access when prompted.
5. If the OpenAPI spec changed and you use the Generated collection as your mock source, regenerate the API Builder generated collection first.
6. Run `Postman Admin - Board Third Party Library Mock Provisioning`:
   - `Collections / Provision/refresh mock server (one-step)`
7. The collection test scripts will populate in the **Mock Admin** environment:
   - `mockSourceCollectionUid`
   - `mockId`
   - `mockUrl`
   - `baseUrl` (set to the created mock URL)
8. The one-step admin request will also attempt to automatically sync `Board Third Party Library - Mock` `baseUrl` via the Postman API using `mockRuntimeEnvironmentId` (or resolve the runtime environment ID by name if it is blank).
9. Run `Board Third Party Library API (Contract Tests)` against `Board Third Party Library - Mock`.

The one-step provisioning request performs a preflight validation of the resolved mock source collection snapshot (route presence + saved examples for currently required endpoints). If it fails, fix the mock source collection/workspace object first instead of trusting mock-based contract test failures.

### If runtime Mock environment auto-sync fails

Use the `Environments` folder in the Postman admin collection:

1. `Environments / List environments and resolve Mock runtime environment ID`
2. `Collections / Provision/refresh mock server (one-step)` (retry; it will auto-sync if `mockRuntimeEnvironmentId` is now resolved)

Optional manual fallback:

- `Environments / Sync Mock runtime environment baseUrl from mockUrl`

### Why some mock-admin environment variables start blank

These values are intentionally blank in the versioned **Mock Admin** environment template and are populated by the Postman admin provisioning collection after you run it:

- `mockSourceCollectionUid`
- `mockId`
- `mockUrl`

`baseUrl` in **Mock Admin** starts as a placeholder and is overwritten with `mockUrl` by the provisioning collection once the mock is created.

### Making the Mock environment "ready to go"

The admin collection now attempts to keep `Board Third Party Library - Mock` `baseUrl` in sync automatically whenever a new mock server is created.

If your team decides to keep a stable mock URL for a while, you can also update the versioned runtime mock environment file:

- `postman/environments/board-third-party-library_mock.postman_environment.json`

Then most day-to-day work only needs the `Board Third Party Library - Mock` environment, and the `Mock Admin` environment/collection are only used when the mock server must be created or repaired.

### Mock response selection notes

- `Health / Readiness health check` validates the default saved example (expected healthy path).
- `Mock Validation / Readiness health check (Mock 503 example)` forces the unhealthy saved example using:
  - `x-mock-response-code: 503`
  - `x-mock-response-name: API is running but not ready due to dependency failure.`

## Repository Files

- `postman/specs/`: OpenAPI definitions (contract source of truth)
- `postman/collections/`: Git-tracked executable contract/smoke test collections and Postman admin/provisioning collections
- `postman/environments/`: Non-secret environment templates
- `postman/globals/`: Workspace globals when needed
- `.postman/config.json`: Postman Native Git workspace metadata and tracked artifact paths

## Working Rules

- API Builder generated collections are for spec sync and reference, not for long-lived hand-authored tests.
- Git-tracked collections are for executable tests and workflow assertions.
- Keep Postman Cloud admin/provisioning requests in a separate collection from API contract tests.
- Keep filenames stable once Postman Native Git is tracking them to avoid duplicate workspace artifacts.
