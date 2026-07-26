# Community LE Build Catalog

A curated list of Level Editor builds that appears in FleetView under **Config → Community
Catalog**. It is one JSON file in this repo — no server, no database, no submission API.

- File: [`catalog/catalog.json`](../catalog/catalog.json)
- Served to the app from
  `https://raw.githubusercontent.com/FairyVR/fleetview/main/catalog/catalog.json`
- URL constant: `CATALOG_URL` in `src/shared/catalog.ts` (the only place it is written)

Only the maintainer publishes. LE authors DM their build; nobody else needs a GitHub account.

## Publishing a build

1. **Paste it into your own library.** LE Config Library → New → paste their code, fill in
   Name / Author / Description / Tags, Save. Use "Format commas" if their string needs it.
   This is also your chance to sanity-check the build before it goes out.
2. **Copy the entry.** With the config selected, hit **Copy catalog entry**. (The button appears
   only when Developer Mode is on in Settings.) Your clipboard now holds a correctly-escaped
   catalog entry — the LE string's quotes and newlines are already handled, which is the part
   that's easy to get wrong by hand.
3. **Paste it into the catalog.** Open `catalog/catalog.json` on github.com, click the pencil,
   add the object to the `builds` array, and commit. Users see it on their next refresh —
   no FleetView release required.

## Updating an existing build

Keep the `id` and **raise the `version`**. That is what tells every installed copy an update is
available; the user gets a diff and an explicit "Update" click, so their edits are never
silently overwritten.

Selecting a config that came from the catalog and hitting "Copy catalog entry" does this for
you — it reuses the original `id` and pre-increments `version`.

## Rules

- **`id` is permanent.** Never reuse an `id` for a different build; installs are tracked by it.
  Removing a build is fine — installed copies keep working and just stop reporting a version.
- `version` is an integer that only goes up. It is not the author's own version label.
- Required per entry: `id`, `name`, `version`, `code`. Everything else is optional.

## Entry shape

```json
{
  "id": "canyon-sprint",
  "name": "Canyon Sprint",
  "author": "someLEperson",
  "description": "Three-lap desert circuit with a shortcut over the ravine.",
  "version": 1,
  "tags": ["race", "map"],
  "category": "Race",
  "updatedAt": 1753500000000,
  "code": "…the raw LE string…"
}
```

## If you break the file

The app validates the catalog before showing it (`parseCatalog` in `src/shared/catalog.ts`) and
drops individual malformed entries rather than failing the whole list, so one bad entry won't
take the catalog down for everyone. A response that fails outright — invalid JSON, wrong
`version`, unreachable host — leaves each user's last good cached copy in place with a warning
banner. Fix the file and commit; no release needed.
