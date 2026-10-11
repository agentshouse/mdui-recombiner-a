# Recombiner House port

This is an ordinary House App port of TeachBooks/recombiner at fe5b037e96a9c8c4a66a92693141a9192e359269, Apache-2.0. Preserve the Solid donor components and chapter/instruction workflow.

Read README.md and public/licenses/PROVENANCE.txt. Use npm ci --ignore-scripts --no-audit; do not run npm audit or upload dependency graphs. Checks: npm run typecheck; npm run lint; npm test; npm run build; npm run release:check; npm run licenses:check.

src/house.ts is the sole runtime boundary and only bridge import. Use the host's bridge.runtime; never construct a runtime, access credentials or call House/network endpoints directly. src/store.ts observes runtime results; no seed fallback, localStorage or fake synchronization. Saves are queued, with exact document bases and null draft CAS. Never discard or rebase refused drafts automatically. Whole groups are preflighted before any draft write.

The Manual catalogue is a CC BY 4.0 adaptation with all 109 donor TOC nodes; only its logo is bundled. Other upstream catalogues are excluded. Imported catalogue logos never load remotely. Master accepted local JSON import instead of remote harvesting (20261011T1200Z). No remote action is planned. New source/release pushes are authorized by the user's adopted 20261011T1150Z Master rules, subject to ordinary credential/security restrictions. No hosted acceptance may be claimed without actual hosted browser verification.
