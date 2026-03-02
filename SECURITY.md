# Security Policy

## Sensitive Files
- Never commit private keys, certificates, `.env` files, tokens, or secrets.
- Extension signing keys (for example `dist.pem`) must stay local-only and untracked.
- `.gitignore` includes `*.pem`, `dist.pem`, and `.env` and should not be weakened.

## Release Hygiene
Before any push or release:
1. Run a quick secret scan:
   - `rg -n --hidden --glob '!.git' '(BEGIN PRIVATE KEY|api[_-]?key|secret|token|password)'`
2. Verify ignored/private files are not tracked:
   - `git ls-files | rg -n '(\\.pem$|\\.env$)'`
3. Confirm staged changes do not include secrets:
   - `git diff --cached`

## Incident Response
If a secret is accidentally committed:
1. Remove it from tracking immediately.
2. Rotate/regenerate affected credentials or keys.
3. Purge sensitive history if the repo was shared publicly.
