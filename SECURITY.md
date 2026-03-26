# Security Policy

## Sensitive files

Never commit the following — all are covered by `.gitignore`:

| File | Why |
|---|---|
| `.env` | May contain API keys — not used by SalahSync (location is hardcoded to Davis, CA) but keep out of version control regardless |
| `dist.pem` | Chrome extension private signing key |
| `*.pem` | Any other private keys or certificates |

## Data stored by the extension

SalahSync stores one item in `chrome.storage.local`:

- `salahsync_prayer_cache` — today's prayer times (date string + timings object). No personal data, no schedule content, no identifiers. Cleared automatically when the date changes.

No schedule text entered by the user is persisted anywhere.

## Release hygiene

Before any push or release:

1. Scan for secrets:
   ```sh
   rg -n --hidden --glob '!.git' '(BEGIN PRIVATE KEY|api[_-]?key|secret|token|password)'
   ```
2. Confirm no sensitive files are tracked:
   ```sh
   git ls-files | rg -n '(\\.pem$|\\.env$)'
   ```
3. Check staged diff before committing:
   ```sh
   git diff --cached
   ```

## Incident response

If a secret is accidentally committed:
1. Remove it from tracking immediately (`git rm --cached <file>`).
2. Rotate/regenerate the affected credential or key.
3. Purge the sensitive history if the repo is public (`git filter-repo` or BFG).
