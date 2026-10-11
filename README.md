# Teachbook Recombiner for House

An ordinary House App preserving the Apache-2.0 TeachBooks/recombiner Solid UI: book cards, recursive collapsible chapter trees, checkboxes, shared chapter selection, mail instructions and DIY instructions. Donor: https://github.com/TeachBooks/recombiner at fe5b037e96a9c8c4a66a92693141a9192e359269. Original developer guide: DONOR_README.md; historical harvester retained as non-executable reference in samples/*.txt.

## Run and verify

Use Node >=24.21.0 (House packages declare this minimum). npm ci --ignore-scripts --no-audit; npm run typecheck; npm run lint; npm test; npm run build; npm run release:check; npm run licenses:check. npm run dev starts a local Vite page, but production data requires House's supplied bridge. The checkout contains no development fake-runtime fallback.

## Runtime and shared state

The catalogue Room slot accepts recombiner_book and recombiner_selection. schema.yaml is current JSON Schema in YAML, exactly matching the Room schema. One book document preserves metadata, provenance and harvested TOC JSON. One deterministic selection document per chapter avoids overwriting unrelated selections. Both books and selection are shared Room state, not per-user preferences.

src/house.ts is the only bridge import. It obtains connectHouseBridge().runtime and uses Query, Observe, Room Draft and Save only. Drafts are written with null-as-absent CAS, saved with the returned exact revisions, and removals use the exact opened Markdown base. Unfinished drafts, stale conflicts, schema refusals and transport errors remain visible and never trigger destructive automatic recovery. A save receipt is explicitly queued; actual synchronization comes from the Runtime observation. Readonly/absent Rooms, service-write-halt, connection refusal, storage loss and durability are displayed honestly.

The retained Add Book dialog accepts a local one-book harvested catalogue JSON with author, source, licence and TOC. Example: samples/manual.catalog.json. Import creates a new shared book; deleting an imported book groups its exact-base selection removals and book removal. Remote logos are omitted. Remote website harvesting and books/books_url URL-triggered fetching are unavailable under the no-external-network boundary; Master accepted local JSON import as the replacement on 2026-10-11 at 12:00 UTC (Porting message 20261011T1200Z-master-whiteboard-recombiner.md); no remote action is planned, and the issue is answered. Room sharing is managed with House's real access controls. Mail actions only open the user's email client; the App never sends an email.

## Licensed demo and assets

The Room is filled with TeachBooks Manual, the donor's 109-node catalogue. Its chapter titles, hierarchy and URLs are unchanged. Author: TeachBooks Development Team and TeachBooks users. CC BY 4.0, with license verified at Manual commit 8ea59e8f721c77848de71a7cc7de722d3bd1ad8e. The licence file retains its separate notices for referenced external materials. No full chapters are republished. The initial selection is empty, as in the donor demo; no selections or activity were invented. Other donor catalogues, including unverified HOS-workbook, are excluded.

public/licenses/PROVENANCE.txt records source links, asset hash, modifications and attribution. LICENSE preserves the donor Apache-2.0 grant; THIRD_PARTY_NOTICES.txt preserves installed production dependency license texts, including the MIT bridge. The 12-file release contains only local code, stylesheet, logo, sample catalogue and notices. There are no outside runtime fetches, remote fonts, authentication, analytics or CDNs. Vite's unused module-preload fetch polyfill is disabled.

## Verification boundary

19 model, schema, validation and runtime-boundary tests cover donor tree preservation, instruction generation, safe imports, deterministic selection creation, exact-base removals, grouped clearing, draft CAS races, refused saves, transport failures and book deletion. These are local tests. Browser CRUD/reload/sync, multi-client behavior and 360px/desktop hosted rendering remain unverified until dev's site-password gate is resolved. Publication does not mean browser acceptance.
