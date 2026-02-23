# board-third-party-lib_api

Design and tests for the API for the Board third party library.

## Table of Contents

- [Postman Workflow](#postman-workflow)
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

## Mock-First Flow

The contract test collection now includes:

- saved examples for the health endpoints (including `/health/ready` `200` and `503`)
- a `Mock Validation` folder with a mock-only request that forces the saved `503` readiness example using Postman mock headers

### Files used for mock-first work

- `postman/environments/board-third-party-library_mock.postman_environment.json`
- `postman/environments/board-third-party-library_mock-admin.postman_environment.json`
- `postman/collections/postman-admin.board-third-party-library-mock-provisioning.postman_collection.json`
- `postman/collections/board-third-party-library-api.contract-tests.postman_collection.json`

### Provision the mock server (code-driven in Postman)

1. In Postman, import/sync both environments:
   - `Board Third Party Library - Mock` (day-to-day contract test runs)
   - `Board Third Party Library - Mock Admin` (mock provisioning/maintenance)
2. Select `Board Third Party Library - Mock Admin`.
3. Add your Postman API key to **Postman Vault** as `postman-api-key` (local secret), so the admin collection can use `{{vault:postman-api-key}}`.
4. Enable Vault access for scripts (one-time Postman setup) and grant this collection/workspace access when prompted.
5. Run `Postman Admin - Board Third Party Library Mock Provisioning`:
   - `Collections / Provision/refresh mock server (one-step)`
6. The collection test scripts will populate in the **Mock Admin** environment:
   - `contractTestsCollectionUid`
   - `mockId`
   - `mockUrl`
   - `baseUrl` (set to the created mock URL)
7. The one-step admin request will also attempt to automatically sync `Board Third Party Library - Mock` `baseUrl` via the Postman API using `mockRuntimeEnvironmentId` (or resolve the runtime environment ID by name if it is blank).
8. Run `Board Third Party Library API (Contract Tests)` against `Board Third Party Library - Mock`.

### If runtime Mock environment auto-sync fails

Use the `Environments` folder in the Postman admin collection:

1. `Environments / List environments and resolve Mock runtime environment ID`
2. `Collections / Provision/refresh mock server (one-step)` (retry; it will auto-sync if `mockRuntimeEnvironmentId` is now resolved)

Optional manual fallback:

- `Environments / Sync Mock runtime environment baseUrl from mockUrl`

### Why some mock-admin environment variables start blank

These values are intentionally blank in the versioned **Mock Admin** environment template and are populated by the Postman admin provisioning collection after you run it:

- `contractTestsCollectionUid`
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
