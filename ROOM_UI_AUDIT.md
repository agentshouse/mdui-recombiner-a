# Master 12:25 donor chrome audit

Instruction: Porting `messages/20261011T1225Z-master-crm-room-label.md`, 2026-10-11. Donor TeachBooks/recombiner at `fe5b037e96a9c8c4a66a92693141a9192e359269` has book/chapter selection and instruction generation; the generic Room chooser and ambient House sync box were port additions.

Removed storage Room names/selector, ambient sync text and decorative status box. Kept book/chapter business selection, user-action queued receipts, genuine write-halt/error/storage-loss/refusal warnings and unfinished/returned-draft details. Exactly one runtime binding selects the catalogue; multiple bindings produce an actionable configuration warning instead of choosing first. No Room copying, fallback, identity, schema/manifest, direct network or Agent changes.

Typecheck, lint, all 20 tests, build, release:check and licenses:check pass. Added source-contract tests protect absent instrumentation and preserved warnings. All 43 dependency license texts verify. Browser acceptance is separate; source tests do not resolve the CRM admin-viewer runtime issue.
