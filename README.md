# Sancta Maria 1187 — Températures

Private mobile web app for one daily temperature reading across the restaurant's 13 cold-storage appliances. French interface; Paris dates and times; Monday and Tuesday are closure days unless an exceptional reading is explicitly enabled.

## Implemented

- Thirteen blank temperature fields, including an explicit sign control for mobile keyboards.
- Date, time, operator initials and corrective-action notes.
- Maximum-temperature alerts using the user's existing worksheet thresholds: four freezers at −18 °C; nine positive-temperature appliances at +4 °C by default. These are configurable monitoring thresholds, not a determination of regulatory compliance.
- Persistent D1 readings and settings, authorized on every API request by the platform's stable user ID.
- One reading per user and date. Optimistic revisions reject duplicate creation and stale concurrent edits.
- Historical readings retain the thresholds in effect when they were saved.
- Monthly register, closed-day shading, A4 landscape printing with signature area, and an Excel-compatible UTF-8 CSV export.
- A saved OneDrive workbook link. The interface explicitly states that automatic synchronization is not active.

## OneDrive integration status

The user's connected Microsoft drive is personal. Microsoft's Excel workbook REST API does not support OneDrive Consumer. The existing ChatGPT connector credentials are not available to this web app, and a pasted sharing link does not grant automatic background write access.

The exact OneDrive temperature workbook has not yet been resolved. Only the user's unrelated personal-finance workbook appeared in recent Microsoft documents; it was not opened or modified.

To finish the requested connection, resolve the actual workbook from a user-provided sharing link, inspect its latest contents and choose a supported authorized transfer method. File-level download/modify/upload is supported for delegated personal accounts, but requires Microsoft consent and concurrency protection. A separately configured scheduled transfer using the user's connected apps is another possible method; none has been created.

Reference: https://learn.microsoft.com/en-us/graph/api/resources/excel?view=graph-rest-1.0

## Original worksheet mapping

The reference file is `Releve_temperatures_HACCP_Septembre_2026_Sancta_Maria_A4_Mobile_Design.xlsx`, with sheets `Septembre 2026` and `Repères HACCP`.

- Row 2: equipment maxima in C:O.
- Row 3: column headers.
- Rows 4–33: September 1–30; for this reference, day N is row N + 3.
- A: date; B: time; C:F: the four freezers; G:O: the nine refrigerated appliances; P: initials; Q: deviation/action; R: existing status formula.
- Never overwrite the original workbook from an old copy. Preserve formulas, formatting, print settings and unrelated data.

The CSV follows the same 18-column order, leaves unmeasured temperatures blank and quotes untrusted text so it is not interpreted as an Excel formula. It does not modify the OneDrive file.

## Local development and validation

Use the Sites lifecycle for installation, build, source saving and private deployment. Logical D1 binding: `DB`; object storage is not required.

- `npm run install:ci`
- `npm run db:generate` after schema changes; inspect and retain migrations.
- `node --test tests/*.test.mjs` exercises parsing, calendar rules, CSV safety, API authorization, real SQLite persistence, owner isolation, stale-write conflicts, corrective actions and threshold history.
- `./node_modules/.bin/tsc --noEmit`
- `npm run build`

Do not seed invented temperature readings. Browser storage is used only for the operator's preferred initials. Unsaved readings remain in the current form; an interrupted or offline save must never be presented as successful.
