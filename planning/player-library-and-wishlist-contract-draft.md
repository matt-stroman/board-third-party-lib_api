# Player Library And Wishlist Contract Draft

## Table of Contents

- [Purpose](#purpose)
- [Status](#status)
- [Draft Routes](#draft-routes)
- [Draft Response Shapes](#draft-response-shapes)
- [Open Questions](#open-questions)

## Purpose

This draft captures the next authenticated player-facing API surface without adding future-only endpoints to the maintained `v1` contract before backend implementation begins.

Use this document to guide the later contract-first implementation of:

- the authenticated player library
- the authenticated wishlist

Developer enrollment is no longer part of this draft because it is now implemented in the maintained contract as `POST /identity/me/developer-enrollment`.

## Status

Status on March 4, 2026:

- frontend routes exist as visual stubs at `/player/library` and `/player/wishlist`
- backend implementation for player library and wishlist does not exist yet
- developer enrollment is implemented separately in the maintained contract
- the maintained contract remains [`api/postman/specs/board-third-party-library-api.v1.openapi.yaml`](../postman/specs/board-third-party-library-api.v1.openapi.yaml)

## Draft Routes

### `GET /player/library`

Authenticated read model for the signed-in player's owned and organized titles.

Intended behavior:

- return only the caller's private player-library data
- include owned titles first
- expose collection and favorite metadata when those features exist

### `GET /player/wishlist`

Authenticated read model for titles the signed-in player has saved for later.

Intended behavior:

- return only the caller's private wishlist entries
- reuse public catalog summary fields so wishlist cards can render without extra catalog fetches
- support future sort modes such as `recentlyAdded`

## Draft Response Shapes

```yaml
paths:
  /player/library:
    get:
      tags: [Player]
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Authenticated player library returned successfully.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PlayerLibraryResponse'
  /player/wishlist:
    get:
      tags: [Player]
      security:
        - BearerAuth: []
      responses:
        '200':
          description: Authenticated wishlist returned successfully.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PlayerWishlistResponse'

components:
  schemas:
    PlayerLibraryResponse:
      type: object
      required: [playerLibrary]
      properties:
        playerLibrary:
          $ref: '#/components/schemas/PlayerLibrary'
    PlayerLibrary:
      type: object
      required: [ownedTitles, collections, favorites]
      properties:
        ownedTitles:
          type: array
          items:
            $ref: '#/components/schemas/CatalogTitleSummary'
        collections:
          type: array
          items:
            $ref: '#/components/schemas/PlayerCollection'
        favorites:
          type: array
          items:
            type: string
            format: uuid
    PlayerCollection:
      type: object
      required: [id, displayName, titleIds]
      properties:
        id:
          type: string
          format: uuid
        displayName:
          type: string
        titleIds:
          type: array
          items:
            type: string
            format: uuid
    PlayerWishlistResponse:
      type: object
      required: [wishlist]
      properties:
        wishlist:
          $ref: '#/components/schemas/PlayerWishlist'
    PlayerWishlist:
      type: object
      required: [titles]
      properties:
        titles:
          type: array
          items:
            $ref: '#/components/schemas/CatalogTitleSummary'
```

## Open Questions

- whether wishlist writes should live under `/player/wishlist` or under catalog title actions
- whether player collections and favorites ship in the same backend wave as owned-title entitlements or immediately after
