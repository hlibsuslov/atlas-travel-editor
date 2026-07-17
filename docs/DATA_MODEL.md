# Data model and compatibility

Atlas edits, validates, stores, imports, exports, and syncs one document:
`TravelData`. This page is the human-readable contract; the executable contract
is `src/domain/schema.ts`.

## Shape

```json
{
  "person": {
    "birthplace": {
      "country": "Ukraine"
    }
  },
  "travel": {
    "countries": [
      {
        "name": "Norway",
        "status": {
          "visited": true,
          "lived": false,
          "birthplace": false
        },
        "capitalVisit": {
          "visited": true
        },
        "timeline": {
          "visited": ["2023-06", "2025"],
          "lived": []
        },
        "cities": [
          {
            "name": "Oslo",
            "timeline": {
              "visited": [2023, 2025]
            }
          }
        ]
      }
    ],
    "stays": [
      {
        "name": "Harbour hotel",
        "country": "Norway",
        "city": "Oslo",
        "from": "2025-03-02",
        "to": "2025-03-05",
        "cost": {
          "amount": 349900,
          "currency": "NOK"
        },
        "note": "Three nights"
      }
    ]
  }
}
```

## Field reference

### Person

| Path | Type | Rules |
| --- | --- | --- |
| `person.birthplace.country` | string | Required and non-empty |

The birthplace scalar and a country's `status.birthplace` can both exist. UI
actions normally keep the visual state coherent, but the schema does not enforce a
single-country birthplace relationship.

### Country

| Field | Type | Rules |
| --- | --- | --- |
| `name` | string | Required and non-empty; canonical English names map most reliably |
| `status.visited` | boolean | Has visited the country |
| `status.lived` | boolean | Has lived in the country |
| `status.birthplace` | boolean | Marks birthplace status on the map |
| `capitalVisit.visited` | boolean | Has visited the capital |
| `timeline.visited` | string[] | Valid timeline values |
| `timeline.lived` | string[] | Valid timeline values |
| `cities` | City[] | Ordered city list |

Status booleans are stored independently. Map rendering derives one primary
colour with this precedence: birthplace, lived, visited, capital, none.

### Timeline values

Accepted string forms:

| Form | Example | Meaning |
| --- | --- | --- |
| `YYYY` | `2025` | A year |
| `YYYY-MM` | `2025-03` | A month |
| `YYYY-MM-DD` | `2025-03-02` | A calendar day |
| `YYYY-YYYY` | `2022-2024` | Inclusive year range |

Years are limited to 1900–2100. Calendar dates are checked for real month/day
combinations. City visit years are integers in the same range.

### Stay

`travel.stays` is optional, so pre-diary documents remain valid.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | Place or accommodation |
| `country` | string | no | Free text |
| `city` | string | no | Free text |
| `from` | timeline string | no | Usually a day or month |
| `to` | timeline string | no | Usually a day or month |
| `cost.amount` | integer | with cost | Non-negative minor units, never a float |
| `cost.currency` | string | with cost | Three uppercase letters |
| `note` | string | no | Free text |

For example, USD 19.99 is stored as `{ "amount": 1999, "currency": "USD" }`.
The schema does not currently enforce that `to >= from` or validate currency
codes against the complete ISO list.

## Portable envelope

File and IndexedDB storage wrap the document:

```json
{
  "app": "travel-editor",
  "schemaVersion": 2,
  "updatedAt": "2026-07-16T12:00:00.000Z",
  "data": {}
}
```

- `app` prevents unrelated JSON from being mistaken for an Atlas envelope.
- `schemaVersion` is the compatibility/migration anchor.
- `updatedAt` is informational sync metadata.
- `data` is the complete `TravelData` document.

Bare legacy `TravelData` JSON is also accepted. Version 2 added optional stays.
The server stores this envelope as opaque JSON plus indexed visibility, slug,
version, and timestamp columns.

The current reader does not yet reject an envelope version newer than it
understands. Before schema version 3 ships, add either an explicit forward
migration or a fail-closed “newer client required” path to prevent unknown fields
from being normalized away.

## Strict validation versus normalization

These operations are deliberately different:

- `validateTravelData(value)` is strict. It returns every path-prefixed schema
  error and persistence refuses invalid data.
- `normalizeTravelData(value)` is lenient. It coerces legacy/untrusted input,
  fills structural defaults, drops unusable values, de-duplicates/sorts city
  years, and never throws.

The storage registry normalizes every load and validates every save. Adapters must
not reproduce or bypass those policies.

## Versions and optimistic concurrency

`DocumentStore` returns a `StorageDoc` with opaque metadata:

```ts
{
  data: TravelData;
  meta: {
    version: string | number | null;
    isPublic: boolean;
    shareSlug: string | null;
    updatedAt?: string;
  };
}
```

- IndexedDB uses a monotonic integer.
- Atlas Server uses the document row's integer version and `If-Match`.
- Local files expose mtime/size as metadata but do not claim atomic concurrency.
- Future providers can use ETags, revisions, or blob hashes.

Callers round-trip the token without interpreting it. A stale token produces
`ConflictError` with the current remote document.

## How to evolve the model

1. Prefer optional/additive fields.
2. Update the Zod schema and derived types.
3. Teach normalization how to read every older supported shape.
4. Add strict, normalization, storage, import, and server validation tests.
5. Sync the vendored server domain files.
6. Increment `SCHEMA_VERSION` when serialized meaning changes.
7. Update this page, the changelog, and an ADR for compatibility decisions.

Never make a SQL table tree the canonical travel contract. The opaque document is
an intentional architecture decision.
