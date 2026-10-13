# Changelog

## 0.1.1 — 2026-10-13

- Reject malformed quoted CSV fields with a clear character position instead of silently returning altered data.
- Detect delimiters from complete CSV records so quoted multi-line cells do not corrupt the sample; inspect only the first twelve records.
- Preserve a valid CSV containing a single empty quoted field.

## 0.1.0 — 2026-10-08

- Initial release of the local-first CSV inspection and cleanup workspace.
- Add CSV/TSV import, delimiter detection, table search, quick cleanup, duplicate removal, undo and protected export.
- Add responsive dark/light interface and offline-ready PWA shell.
