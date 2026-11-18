# Recon map: Content Credentials Verify + Adobe Content Authenticity (web)

Scope: check a file's Content Credentials in the browser, then sign images with an honest AI disclosure, in batches, paid with credits.
For: buildify.builders. Creators, agencies and real estate marketers who need to show where their media came from.
Date: 2026-11-18

Working name in these files: "the checker". Naming comes later in `/replica-brand`.

## How this map was made

- Built from public documentation, product announcements and the C2PA specification material listed below.
- **The live Verify page was not opened**: the fetch tool refused the URL. Its screens come from the official "Using the Verify tool" documentation, so `replica/screens/` is empty.
- Adobe's app was not used. Its screens are inferred from Adobe's announcements and help pages.
- States are marked **(d)** documented or **(i)** inferred. Inferred items should be confirmed by opening the products before design is finalised.
- No source code, bundles, network calls or private APIs were read. The build uses the open-source C2PA SDKs under their own licences.

## Guardrails (product rules, not preferences)

| ID | rule |
| --- | --- |
| G1 | Nothing in the product removes, strips, hides or weakens C2PA credentials, SynthID or any other provenance signal. No "clean export", no metadata-removal option for credentials. |
| G2 | Signing a file that already has credentials adds a new manifest that opens the file as a parent ingredient. The earlier history stays. |
| G3 | If existing credentials fail validation, signing is blocked in v1 and the user sees why. |
| G4 | A user cannot declare "no AI used" when a valid ingredient is labelled as AI-generated or AI-modified. |
| G5 | Results never say a file is "real", "human-made" or "not AI". No credentials means no declaration was found. The product is not an AI detector. |
| G6 | Author names and AI answers typed by a user are shown as self-declared. They are not presented as verified identity. |
| G7 | Marketing never promises avoiding AI labels, passing detectors or getting past platform rules. |

Known limit of G4: if someone strips credentials elsewhere and uploads the result, the product cannot tell. The declaration stays self-declared, which is why G5 and G6 matter.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | Verify tool docs | https://opensource.contentauthenticity.org/docs/verify | Main source: inputs, formats, panels, states |
| 2 | Known certificate list | https://opensource.contentauthenticity.org/docs/verify-known-cert-list | How Verify decides a signer is known |
| 3 | Getting a signing certificate | https://opensource.contentauthenticity.org/docs/signing/get-cert | Trust list CAs, algorithms, chain |
| 4 | Conformance program docs | https://opensource.contentauthenticity.org/docs/conformance/ | Generator and validator requirements |
| 5 | c2pa-js SDK docs | https://opensource.contentauthenticity.org/docs/sdk-repos/c2pa-js/ | c2pa-web and c2pa-node |
| 6 | C2PA synthetic content guidance (July 2026) | https://c2pa.org/wp-content/uploads/sites/33/2026/07/Use-of-Content-Credentials-to-Identify-Synthetic-and-Non-Synthetic-Content.pdf | AI labelling, informative guidance |
| 7 | C2PA implementation guidance | https://spec.c2pa.org/specifications/specifications/2.3/guidance/Guidance.html | Parent ingredients and actions |
| 8 | DigiCert: signing needs more than an SDK | https://www.digicert.com/blog/why-c2pa-signing-requires-more-than-an-sdk | Production signing requirements (vendor view) |
| 9 | SSL.com C2PA products | https://www.ssl.com/products/content-authenticity/content-credentials/c2pa/ | Certificates and managed signing API (vendor view) |
| 10 | SSL.com content authenticity guide | https://www.ssl.com/article/a-guide-to-content-authenticity-solutions/ | Assurance levels (vendor view) |
| 11 | Adobe public beta announcement | https://blog.adobe.com/en/publish/2025/04/24/adobe-content-authenticity-now-public-beta-helps-creators-secure-attribution | Signing features, 50-file batch |
| 12 | Adobe extension help | https://helpx.adobe.com/creative-cloud/apps/adobe-content-authenticity/chrome-browser-extension/use-chrome-extension.html | Page scan and empty message |
| 13 | Google: verify AI content in Gemini | https://support.google.com/gemini/answer/16722517?hl=en | Where SynthID checks live today |

## Core loop

Drop in a file, see who signed it and how it was made, then sign your own work with an honest AI disclosure and share the proof.

The originals are free, so the paid part here is new: batch signing, brand profiles, team use and public proof pages.

## Screens

### From the originals

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | Verify start | `/verify` | Take a file | Drop zone, file button, supported format list | empty (d), drag-over (i), unsupported file (i), loading (i) |
| S02 | Verify result | After a file loads | Explain the file's credentials | Left: title, thumbnail, match search. Centre: ingredient tree. Right: signing info, validation, Credit and usage, Process, About, Camera capture | known signer (d), Unrecognized (d), validation warning (d), No Content Credential (d), AI section shown (d), do-not-train shown (d), camera details shown (d), mobile (i) |
| S03 | Verify by link | `/verify?source=<ASSET_URL>` | Open a public asset directly | Same as S02 | loaded (d), host blocks cross-origin or needs login (i) |
| S04 | Ingredient view | Select an item in the S02 tree | Inspect a source file | Tree node, detail panel | selected (i), ingredient with credentials (d), without (i) |
| S05 | Possible matches | "Search for possible matches" on S02 | Find similar credentialed content | Results list | results (i), none (i), searching (i) |
| S06 | Adobe app home | Sign in to the app | Choose apply or inspect | Action cards, nav | default (i) |
| S07 | Add files | Apply flow | Pick files to sign | Multi-file picker, file list | empty (i), up to 50 files (d), wrong type (i) |
| S08 | Attribution details | Apply flow | Choose what to attach | Name, website, connected accounts | filled (i), identity not verified (i) |
| S09 | AI training preference | Apply flow | Signal training preference | Toggle, explanation | on (d), off (i) |
| S10 | Applied / download | End of apply flow | Get signed files | Result list, download | success (i), partial failure (i) |
| S11 | Identity and accounts | Settings | Connect identity | LinkedIn verification, Behance, Instagram, LinkedIn, X | connected (d), not connected (i) |
| S12 | Inspect in app | App nav | Read or recover credentials | Same result pattern as S02 | found (d), history available (d), none (i) |
| S13 | Browser extension | Extension icon on any page | Find credentials on a page | Item list, Inspect button | found (d), "No Content Credentials found on this page" (d) |

### Added for this product (not in the originals)

| ID | screen | route | purpose | key components | states to build |
| --- | --- | --- | --- | --- | --- |
| S14 | Sign in / sign up | `/login` | Account access | Email, OAuth | default, error, verify email |
| S15 | Dashboard and history | `/app` | Recent jobs, balance | Job table, credit chip | empty, filled, loading, error |
| S16 | AI-use disclosure | Sign flow | Record how AI was used | Radio cards, model fields, plain-language preview | empty, valid, blocked by G4 |
| S17 | Credits and billing | `/app/billing` | Buy credits, see ledger | Packs, ledger table | empty, low balance, payment failed, paid |
| S18 | Batch progress | `/app/jobs/:id` | Follow a job | Progress bar, per-file rows, retry | queued, running, partial failure, done, expired |
| S19 | Workspace and brand profile | `/app/settings` | Team and reusable details | Member table, profile form | empty, filled, no permission |
| S20 | Public proof page | `/p/:slug` | Share a signed asset's record | Thumbnail, signer, disclosure, caveat, re-check | live, revoked, not found |
| S21 | API keys | `/app/developers` | Automate signing | Key table, reveal once | empty, filled, revoked |

## Flows

```
F01 Check a file from the device
    S01 -> S02
    happy path clicks: 2 (select file, confirm), or 1 drag
    edge: unsupported type, damaged file, very large file

F02 Open a check from a link
    S03 -> S02
    happy path clicks: 1
    edge: private asset, host blocks cross-origin requests

F03 Understand a problem result
    S01 -> S02 (No Content Credential | Unrecognized | validation warning)
    happy path clicks: 2
    edge: credentials stripped by a platform, expired or unknown certificate, file changed after signing

F04 Walk the history
    S02 -> S04
    happy path clicks: 1 per ingredient
    edge: ingredient without credentials, deep trees

F05 Find matching credentials
    S02 -> S05
    happy path clicks: 1
    edge: no matches
    note: not rebuilt, see Out of scope

F06 Creator applies credentials (Adobe)
    S06 -> S07 -> S08 -> S09 -> S10
    happy path clicks: about 6, estimated and not measured
    edge: more than 50 files, unsupported format, account not connected

F07 Connect identity and accounts
    S11
    happy path clicks: not measured
    edge: provider refuses, account disconnected later

F08 Inspect inside the app
    S12
    happy path clicks: 2 (i)

F09 Scan a web page
    S13 -> S02 or S12
    happy path clicks: 1 to scan, 1 to inspect
    edge: nothing found

F10 Agency signs a batch with disclosure (new, the paid core)
    S14 -> S15 -> S07-style upload -> S16 -> S08-style profile -> S18 -> S10-style download
    target: 5 clicks with a saved profile
    edge: insufficient credits, one file fails, invalid existing credentials (G3), AI ingredient conflicts with answer (G4), duplicate submit

F11 Buy credits
    S17 -> provider checkout -> S17
    edge: payment fails, webhook arrives twice

F12 Share proof
    S18 -> S20
    edge: asset revoked, link expired

F13 Invite a teammate
    S19 -> email -> S14 -> S15
    edge: invite expired, seat limit
```

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Button | primary, secondary, ghost, danger | default, hover, focus, disabled, loading | all |
| File drop zone | single, batch | idle, drag-over, reading, rejected | S01, S07 |
| Status banner | verified, unrecognized, warning, none | static, expandable | S02, S12, S20 |
| Credential section | signing, credit, process, about, capture | collapsed, expanded, absent | S02, S12, S20 |
| Ingredient tree | root, node, leaf | selected, has credentials, none | S02, S04 |
| Action list | compact, detailed | filled, empty | S02, S12 |
| AI disclosure card | generated, modified, composite, none | selected, disabled by G4 | S16, S20 |
| Self-declared tag | inline | static with tooltip | S02, S16, S20 |
| Job row | file, batch | queued, running, done, failed | S15, S18 |
| Progress bar | determinate | running, partial, done | S18 |
| Credit chip | balance | normal, low, empty | S15, S17 |
| Data table | history, ledger, members, keys | empty, loading, filled | S15, S17, S19, S21 |
| Modal | confirm, danger | open, submitting | S17, S19, S21 |
| Toast | success, error | shown, dismissed | all app screens |
| App nav | sidebar, mobile | active, collapsed | S15 to S21 |

## Inferred data model

### What the file contains (read and written through the C2PA SDK, not database tables)

```
ManifestStore  active_manifest, manifests[], validation_status[]
               evidence: S02, source 1      confidence: high
Manifest       title, claim_generator, signature_info, assertions[], ingredients[]
               evidence: S02, source 1      confidence: high
SignatureInfo  issuer, time
               evidence: S02, source 1      confidence: high
Assertion      label, data (actions, CreativeWork, do-not-train, Exif, ai-disclosure)
               evidence: S02, source 1, 6   confidence: high
Action         action (c2pa.created | c2pa.opened | c2pa.edited | ...), when,
               softwareAgent, digitalSourceType, parameters.relatedAssertions
               evidence: sources 6, 7       confidence: high
Ingredient     title, thumbnail, relationship (parentOf | inputTo), active_manifest
               evidence: S02, S04, sources 6, 7   confidence: high
```

### What this product stores (proposed, not observed)

```
User              id, email, name
Workspace         id, name, owner_id
Membership        workspace_id, user_id, role (owner | admin | member)
SigningProfile    workspace_id, display_name, website, default_training_preference
SignJob           workspace_id, created_by, status, file_count, credits_reserved, idempotency_key
SignJobItem       job_id, original_name, input_sha256, output_sha256, output_key, status, error_code, expires_at
Disclosure        job_item_id, ai_use, digital_source_type, model_type, model_name, declared_by
CreditLedgerEntry workspace_id, delta, reason, job_id, purchase_id
Purchase          workspace_id, provider_ref, amount_cents, currency, credits, status
PublicCredential  job_item_id, slug, status (live | revoked)
ApiKey            workspace_id, hash, label, last_used_at, revoked_at
TrustListSnapshot source_url, sha256, fetched_at, active
confidence: design proposal for /replica-architect
```

Relationships: Workspace 1-n Membership, Workspace 1-n SigningProfile, Workspace 1-n SignJob, SignJob 1-n SignJobItem, SignJobItem 1-1 Disclosure, SignJobItem 0-1 PublicCredential, Workspace 1-n CreditLedgerEntry.

### Disclosure mapping for S16

Based on source 6, which is informative guidance. Confirm against the normative specification when building.

| user's answer | manifest shape | digitalSourceType |
| --- | --- | --- |
| Fully generated by AI | `c2pa.created` | `trainedAlgorithmicMedia` |
| My original, edited or enhanced with AI | `c2pa.opened` + parent ingredient, then `c2pa.edited` or `c2pa.enhanced` | `compositeWithTrainedAlgorithmicMedia` |
| A composite with at least one AI element | Actions plus ingredients | `compositeSynthetic` |
| Human edits to an AI-generated asset | `c2pa.opened` + AI parent ingredient kept | `humanEdits` |
| Made by people, no generative AI | Self-declared, blocked by G4 if an AI ingredient exists | `humanEdits` |

When AI is declared, add `c2pa.ai-disclosure` (`modelType` is required, `modelName` and `modelIdentifier` are recommended when known), referenced from the action.

## Feature matrix

See `features.csv`. Must: 34, should: 12, could: 10, skip: 3. 32 rows exist in the originals and count toward parity. 24 rows are additions for this product and do not.

## Out of scope (cannot or should not be cloned)

- Adobe Content Credentials Cloud and its match search: their hosted index and data.
- Verified on LinkedIn: a partner integration.
- Durable credentials that survive screenshots: needs watermarking plus a hosted lookup, so it is not in this slice.
- The Content Credentials and Adobe brands, logos and copy. The Content Credentials mark may have its own usage rules, which need checking before any use.
- SynthID detection. It is not part of C2PA, and no integration was assessed here. Google offers a check inside the Gemini app (source 13), so the product can point people there.
- Anything that breaks G1 to G7.

## Size

Screens 21 (13 from the originals, 8 added). Flows 13. Stored entities 12.

Hard parts:

1. **Trusted signing is a compliance project.** Conforming generator products must use a certificate from a CA on the C2PA trust list (source 3), and the signing product must pass the Conformance Program's evaluation and legal onboarding (source 8). Until then, signatures made with test certificates should be expected to show as Unrecognized in Verify. SSL.com advertises a managed signing API (source 9). Whether a managed API removes the need for Buildify's own conformance is **not confirmed** and must be asked before committing.
2. **Signing happens on the server.** Reading can run in the browser through `c2pa-web`. Signing is documented for `c2pa-node`, and private keys must stay protected, so signed files must be uploaded, processed and deleted. That means the "files stay on your device" promise applies to checking only.
3. **Identity is easy to overstate.** Claim signing certificates identify the application or service, not the author (source 8). So a credential signed through this product says the product signed it. The user's name is a declaration unless a separate identity method such as CAWG is added.

Other points for `/replica-architect`: `c2pa-node` needs a patched Node 22+ release (source 5), batch jobs need a worker rather than a short web request, credit charges must be idempotent, and payment provider availability for a Pakistan-based business must be checked.

Size: **M** for the build (a few weeks to a working product using test certificates). Conformance and certificate timing are outside that estimate and depend on third parties.
