# Catalog Browse Contract Draft

## Status

This is a draft contract proposal for the next public catalog browse iteration.

It is **not** part of the maintained current OpenAPI contract yet because the backend implementation and backend tests for these behaviors do not exist at the time of writing.

Use this document to stage the API-first design work that should be applied to the maintained contract when the team actively starts the corresponding backend delivery.

## Goals

The current `GET /catalog` contract is sufficient for a minimal list, but it is too thin for the intended web library UX.

The next browse contract iteration should support:

- genre-based browse controls
- deterministic sorting
- pagination metadata for scalable public lists
- frontend-friendly examples that match the planned library UX

## Current Limitation Summary

The maintained `GET /catalog` contract currently supports only:

- `studioSlug`
- `contentKind`

It does not currently model:

- genre filtering
- explicit sort selection
- pagination request parameters
- pagination response metadata

## Proposed Request Shape

Proposed route remains:

- `GET /catalog`

### Proposed query parameters

- `studioSlug`
  - existing parameter, unchanged
- `contentKind`
  - existing parameter, unchanged
- `genre`
  - optional string filter against `genreDisplay`
- `sortBy`
  - optional enum
  - proposed values:
    - `displayName`
    - `genre`
    - `recentlyUpdated`
- `sortDirection`
  - optional enum
  - proposed values:
    - `asc`
    - `desc`
- `pageNumber`
  - optional integer, minimum `1`
  - default `1`
- `pageSize`
  - optional integer, minimum `1`, maximum `50`
  - default `24`

### Proposed request example

```http
GET /catalog?contentKind=game&genre=Arcade%20Shooter&sortBy=genre&sortDirection=asc&pageNumber=1&pageSize=12
```

## Proposed Response Shape

Retain the existing `titles` array and add paging metadata.

### Proposed response example

```json
{
  "titles": [
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "studioId": "11111111-1111-1111-1111-111111111111",
      "studioSlug": "stellar-forge",
      "slug": "star-blasters",
      "contentKind": "game",
      "lifecycleStatus": "testing",
      "visibility": "listed",
      "currentMetadataRevision": 2,
      "displayName": "Star Blasters",
      "shortDescription": "Family space battles in short rounds.",
      "genreDisplay": "Arcade Shooter",
      "minPlayers": 1,
      "maxPlayers": 4,
      "playerCountDisplay": "1-4 players",
      "ageRatingAuthority": "ESRB",
      "ageRatingValue": "E10+",
      "minAgeYears": 10,
      "ageDisplay": "ESRB E10+",
      "cardImageUrl": "https://cdn.example.com/titles/star-blasters/card.png",
      "acquisitionUrl": "https://stellar-forge.itch.io/star-blasters"
    }
  ],
  "pageNumber": 1,
  "pageSize": 12,
  "totalCount": 37,
  "totalPages": 4,
  "hasPreviousPage": false,
  "hasNextPage": true,
  "appliedFilters": {
    "studioSlug": null,
    "contentKind": "game",
    "genre": "Arcade Shooter",
    "sortBy": "genre",
    "sortDirection": "asc"
  }
}
```

## Proposed OpenAPI Additions

When this draft moves into the maintained contract, add these schema concepts:

- `CatalogSortField`
- `SortDirection`
- `CatalogAppliedFilters`
- paging metadata fields on `CatalogTitleListResponse`

### Proposed OpenAPI sketch

```yaml
/catalog:
  get:
    parameters:
      - name: genre
        in: query
        required: false
        schema:
          type: string
      - name: sortBy
        in: query
        required: false
        schema:
          $ref: '#/components/schemas/CatalogSortField'
      - name: sortDirection
        in: query
        required: false
        schema:
          $ref: '#/components/schemas/SortDirection'
      - name: pageNumber
        in: query
        required: false
        schema:
          type: integer
          format: int32
          minimum: 1
          default: 1
      - name: pageSize
        in: query
        required: false
        schema:
          type: integer
          format: int32
          minimum: 1
          maximum: 50
          default: 24

components:
  schemas:
    CatalogSortField:
      type: string
      enum: [displayName, genre, recentlyUpdated]
    SortDirection:
      type: string
      enum: [asc, desc]
    CatalogAppliedFilters:
      type: object
      properties:
        studioSlug:
          type: string
          nullable: true
        contentKind:
          $ref: '#/components/schemas/TitleContentKind'
        genre:
          type: string
          nullable: true
        sortBy:
          $ref: '#/components/schemas/CatalogSortField'
        sortDirection:
          $ref: '#/components/schemas/SortDirection'
    CatalogTitleListResponse:
      type: object
      required:
        - titles
        - pageNumber
        - pageSize
        - totalCount
        - totalPages
        - hasPreviousPage
        - hasNextPage
      properties:
        titles:
          type: array
          items:
            $ref: '#/components/schemas/CatalogTitleSummary'
        pageNumber:
          type: integer
          format: int32
        pageSize:
          type: integer
          format: int32
        totalCount:
          type: integer
          format: int32
        totalPages:
          type: integer
          format: int32
        hasPreviousPage:
          type: boolean
        hasNextPage:
          type: boolean
        appliedFilters:
          $ref: '#/components/schemas/CatalogAppliedFilters'
```

## Proposed Postman Contract Test Changes

When this draft moves into the maintained contract and the backend implementation starts, update the Git-tracked Postman collection to add:

1. A public catalog browse request that exercises genre filtering and sort selection.
2. Assertions for paging metadata.
3. Example coverage for:
   - default browse response
   - filtered/sorted response
   - validation failure for invalid paging values

## Open Questions

- whether `genre` should stay a free-text display filter or evolve into a normalized genre key later
- whether `recentlyUpdated` should be based on title `updatedAt`, active metadata revision update time, or current release publication time
- whether the public library will need multi-select genre filtering soon enough to justify repeated query parameters now

## Recommended Next Step

When public library implementation reaches the point where these controls are needed:

1. move this proposal into the maintained OpenAPI spec
2. update the Git-tracked Postman contract test collection
3. add failing backend tests
4. implement backend query behavior

