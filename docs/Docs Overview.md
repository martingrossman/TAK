# TAK documentation overview

**Updated:** 2026-11-02  
**Purpose:** Explain which documents guide current work, which provide supporting evidence, and which are historical.

Start with the unified requirements and roadmap for the TAK direction. The focused MVP PRD and UX specification remain active detailed contracts until their replacement is explicitly accepted. Consolidating their content did not retire them.

This file is a navigation and status index. It does not approve new product scope or change the requirements in the linked documents.

## Primary documents

| Document | Status | Use it for |
|---|---|---|
| [Unified requirements and roadmap](TAK_UNIFIED_PRODUCT_REQUIREMENTS_AND_ROADMAP_2026-11-01.md) | Main overview | TAK direction, retained MVP/UX requirements, implementation snapshot, priorities, open decisions, and acceptance. Start here. |
| [PRODUCT_REQUIREMENTS_MVP.md](PRODUCT_REQUIREMENTS_MVP.md) | Active baseline | Detailed functional scope, data/runtime boundaries, FR-ENV and FR-01–FR-12, and AT-01–AT-13 acceptance criteria. |
| [UI_UX_DESIGN_SPEC.md](UI_UX_DESIGN_SPEC.md) | Active baseline | Detailed creation/editing, navigation, visual, keyboard, accessibility, responsive, and save-feedback rules. |
| [AGENTS.md](../AGENTS.md) | Active working rules | Development workflow, data safety, verification, and deployment boundaries. |

## Supporting documents

| Document | Status | Use it for / limitation |
|---|---|---|
| [IMPLEMENTATION_PLAN_MVP.md](IMPLEMENTATION_PLAN_MVP.md) | Partially current | Original MVP phases, engineering checks, and release gates. Its historical baseline and sequence need alignment with the next TAK stages; use the unified roadmap for the proposed TAK delivery order. |
| [BACKLOG.md](BACKLOG.md) | Supporting issue list | Individual defects and improvements. The unified roadmap maps their consolidated TAK priorities; an entry alone does not approve extra scope. |
| [TESTING.md](../TESTING.md) | Operational reference | Local test commands and the manual test/fix workflow. Historical test counts are dated evidence, not proof of the current revision. |
| [readme.md](../readme.md) | Operational reference | Project setup, supported modes, build, and deployment instructions. Product naming and older references still need alignment with the TAK contract. |
| [FUTURE_ROADMAP.md](FUTURE_ROADMAP.md) | Deferred-scope reference | Ideas excluded from the original MVP. Needs alignment with TAK-1/TAK-2 before guiding new TAK scope. |
| [LEGACY_SCOPE_MAPPING.md](LEGACY_SCOPE_MAPPING.md) | Scope reconciliation reference | How broad original requirements were retained, narrowed, or deferred for the focused MVP. Needs alignment with the new TAK decisions. |
| [PHASE_0_REVIEW.md](PHASE_0_REVIEW.md) | Audit and checkpoint evidence | Historical findings and later checkpoints. Read their dates/revisions; this is not a fresh implementation plan or blanket release certification. |
| [Manual Google test.md](<Manual Google test.md>) | Draft live checklist | Manual Apps Script/Sheets smoke testing. Refresh its revision and record the actual test workbook, schema, environment, and deployment before using it as release evidence. |

## Historical documents

The older root documents are now located in `archive/`. Keep them as context and history; they do not define the active MVP or automatically expand TAK scope.

| Document | Historical role |
|---|---|
| [archive/ProductRequiremtns.md](../archive/ProductRequiremtns.md) | Broad original requirements and long-term ideas. |
| [archive/IMPLEMENTATION_PLAN.md](../archive/IMPLEMENTATION_PLAN.md) | Original broad implementation review and plan. |
| [archive/README_FIRST.md](../archive/README_FIRST.md) | Earlier onboarding/design-pack introduction with old baseline references. |

These working folders outside the current repository are also historical or temporary:

- `tak-inline-capture/`: an older working/review copy. Use the current repository's PRD, UX specification, and code for ongoing work; preserve the older copy only as historical evidence.
- `tak-contract-review-2026-11-01/`: review backups and staging files. They are not product contracts and are not needed in the repository commit.

## Reading order and source differences

1. Read the unified requirements and roadmap for the product direction, priorities, and unresolved decisions.
2. Read the focused PRD and UX specification for the detailed behavior and acceptance checks of the existing core.
3. Follow AGENTS.md and the relevant implementation-plan checks when making a change.
4. Use the backlog, testing guide, and live checklist for the specific issue and verification work.

Follow the source authority rules in Section 2 of the unified document when documents conflict. Observed code establishes what currently exists; it does not cancel an unmet requirement. Requirements, implementation, and verification are separate claims.

The editor is a specific version difference to retain:

- Historical `tak-inline-capture` PRD/UX copies specify a side drawer.
- Current repository PRD/UX copies specify a compact issue dialog with More options and Back to compact.
- The next TAK target is a side panel plus full-page detail. This remains a target; the current dialog does not establish that it is complete.

## Remaining documentation maintenance

The following alignment work remains pending:

- Resolve the open TAK product decisions, then align the PRD, UX specification, implementation plan, future roadmap, scope mapping, and backlog with the accepted contract.
- Refresh setup/release references, historical test counts, and the live checklist's revision and deployment identity where needed.
- Update references in active documents that still point to the former root locations of archived files.
- Preserve dated audit evidence and historical sources rather than rewriting them as current findings.
- Keep this overview current when a document is replaced, archived, or given a new role.

The unified document's implementation and performance figures are a dated snapshot. This overview adds no new application, live Google, accessibility, or performance verification.
