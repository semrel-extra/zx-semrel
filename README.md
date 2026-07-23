# zx-semrel
[![Release](https://github.com/semrel-extra/zx-semrel/workflows/Release/badge.svg)](https://github.com/semrel-extra/zx-semrel/actions)

> A [zx](https://github.com/google/zx)-based release script — a [semantic-release](https://github.com/semantic-release/semantic-release) alternative (PoC)

Sometimes bloody enterprise forbids you from using any third-party solutions for sensitive operations (like release, deploy, and so on).
Good old **copy-paste** comes to the rescue!

Btw, here's an adaptation for monorepos: [zx-bulk-release](https://github.com/semrel-extra/zx-bulk-release)

### Requirements
* macOS / linux
* Node.js >= 14.13.1
* git >= 2.0
* zx >= 1.6.0

### Key features
* Zero dependencies
* Zero configuration
* [Pretty fast](https://github.com/semrel-extra/zx-semrel/actions)
* [Tiny](https://github.com/semrel-extra/zx-semrel/blob/master/release.mjs), less than 140 lines with comments
* Reliability, safety, simplicity and maintainability (sarcasm)

### Functionality
* Poor [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) analysis
* `CHANGELOG.md` generation
* `package.json` version bumping
* Git release commit creation (optionally [SSH-signed](#signed-release-commits-opt-in))
* [GitHub Release](https://docs.github.com/en/github/administering-a-repository/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release)
* Package publishing to both [npmjs](https://registry.npmjs.org) and [gh](http://npm.pkg.github.com) registries

### 🚀 Usage
1. Copy
2. Tweak it, inject tokens, etc.
3. Run
```bash
curl https://raw.githubusercontent.com/semrel-extra/zx-semrel/master/release.mjs > ./release.mjs
zx ./release.mjs
```
or like this if `zx` is not installed:
```bash
# Just replace GIT* env values with your own
GIT_COMMITTER_NAME=antongolub GIT_COMMITTER_EMAIL=mailbox@antongolub.ru GITHUB_TOKEN=token npx zx ./release.mjs
```
or just run it without any edits through **npx**:
```bash
# Cross your fingers for luck
GIT_COMMITTER_NAME=antongolub GIT_COMMITTER_EMAIL=mailbox@antongolub.ru GITHUB_TOKEN=token npx zx-semrel
```
See also the [gh-actions usage example](https://github.com/semrel-extra/zx-semrel/blob/master/.github/workflows/release.yml)

### Environment variables
Config is entirely env-driven. Booleans are **on** for any non-empty value. Only a GitHub token is strictly required — in GitHub Actions with `id-token: write`, npm OIDC self-enables, so a token pair is often the whole config.

**Auth**

| Variable | Required | Default | Controls |
|---|:--:|---|---|
| `GITHUB_TOKEN` / `GH_TOKEN` | **yes** | — | GitHub API (release), commit push, GitHub Packages auth |
| `NPM_TOKEN` | one of | — | npm auth — legacy token mode |
| `NPM_OIDC` | one of | auto in Actions | npm [OIDC trusted publishing](#npm-publishing-oidc-vs-legacy-tokens) instead of a token |

Publishing needs **one of** `NPM_TOKEN` / `NPM_OIDC`; in GitHub Actions with `id-token: write` OIDC self-enables (via the runner-provided `ACTIONS_ID_TOKEN_REQUEST_URL`).

**Git commit / tag**

| Variable | Required | Default | Controls |
|---|:--:|---|---|
| `GIT_COMMITTER_NAME` | no | `Semrel Extra Bot` | Committer name |
| `GIT_COMMITTER_EMAIL` | no | `semrel-extra-bot@hotmail.com` | Committer email — match the signing account for **Verified** |
| `GIT_SIGN_KEY` | no | — | SSH **private** key → [sign](#signed-release-commits-opt-in) the release commit & tag |
| `GIT_BRANCH` | no | current → `master` | Branch the release is pushed to |
| `GH_USER` | no | — | Username in the token push URL (e.g. `x-access-token`) |

**npm publish** — skipped entirely when `package.json` has `"private": true`

| Variable | Required | Default | Controls |
|---|:--:|---|---|
| `PKG_ALIAS` | no | pkg `alias` field | Extra name to also publish under |
| `NPM_PROVENANCE` | no | on with OIDC | Force `--provenance` |

**Behaviour**

| Variable | Required | Default | Controls |
|---|:--:|---|---|
| `PUSH_MAJOR_TAG` | no | off | Also move & force-push the major tag (`v1`) |
| `DRY_RUN` | no | off | Stop before commit/push/publish — same as `--dry-run` |
| `DEBUG` | no | off | Extra logging — same as `--debug` |
| `VERBOSE` | no | off | Verbose shell output |

### npm publishing: OIDC vs legacy tokens
Since [npm revoked classic tokens](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/), the recommended way to publish from CI/CD is [OIDC Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

**OIDC mode** (priority) — set `NPM_OIDC=true` or omit `NPM_TOKEN` in a GitHub Actions environment with `id-token: write` permission. The npm CLI obtains a short-lived credential automatically; `--provenance` is enforced.

**Legacy mode** — provide `NPM_TOKEN` (granular access token, 90-day max lifetime). Used as fallback when `NPM_OIDC` is not set.

Auto-detection: if `NPM_OIDC` is not set and `NPM_TOKEN` is absent, OIDC is used automatically when `ACTIONS_ID_TOKEN_REQUEST_URL` is available (GitHub Actions with `id-token: write`).

#### OIDC limitations
* **First publish** of a package cannot use OIDC — the initial version must be published with a token or locally, then configure trusted publishing on [npmjs.com](https://www.npmjs.com)
* Each package supports **one trusted publisher** at a time — configure it per package (and per alias) at npmjs.com → Settings → Trusted publishing
* The **workflow filename** in trusted publisher config must match exactly (case-sensitive, `.yml` vs `.yaml`)
* Requires **npm >= 11.5.1** and **Node.js >= 22.14.0**
* An existing project `.npmrc` with an `_authToken` for `registry.npmjs.org` will override OIDC — remove it to use trusted publishing
* OIDC applies to **npmjs.org only**; GitHub Packages still uses `GITHUB_TOKEN` / `GH_TOKEN`

### Signed release commits (opt-in)
Branch [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets) with **Require signed commits** reject the release commit, because zx-semrel creates it with a plain, unsigned local `git commit`. Set `GIT_SIGN_KEY` to sign the release commit **and** tag with SSH.

`GIT_SIGN_KEY` — the **private** SSH key of the committer identity (the full multi-line key, e.g. the contents of an `id_ed25519` file). When set, zx-semrel writes it to a temporary `0600` file and enables SSH signing via **local** git config only (`gpg.format ssh`, `user.signingkey`, `commit.gpgsign`, `tag.gpgsign`) — it never touches your global git config. When unset, behaviour is unchanged (unsigned commit).

```yaml
# .github/workflows/release.yml
env:
  GIT_COMMITTER_NAME: Semrel Extra Bot
  GIT_COMMITTER_EMAIL: bot@example.com          # must be a verified email on the account below
  GIT_SIGN_KEY: ${{ secrets.GIT_SIGN_KEY }}     # PEM-format private key, incl. the BEGIN/END lines
```

For GitHub to show **Verified** (rather than **Unverified**):
* Add the matching **public** key to the committing account at **Settings → SSH and GPG keys → New SSH key**, choosing **Key type: Signing Key** (not the default *Authentication Key*).
* That account must have a **verified email equal to `GIT_COMMITTER_EMAIL`** — GitHub matches the signature to the identity by the committer email.

Notes:
* SSH format only for now; GPG signing is out of scope.
* Generate a dedicated key, e.g. `ssh-keygen -t ed25519 -C bot@example.com -f ./sign_key`, store the private half as the `GIT_SIGN_KEY` secret, and register `sign_key.pub` as a Signing Key.
* The bot account still needs push access to the protected branch (rulesets apply to everyone unless bypassed).

### 🛠️ Extras
* [zx + semrel + maven](https://gist.github.com/malys/f295388ac10c8fc30b8912598b13ceb6) by [@malys](https://github.com/malys)

### 📄 License
[MIT](https://github.com/semrel-extra/zx-semrel/blob/master/LICENSE)

### 📎 Refs
* [npm Trusted Publishing docs](https://docs.npmjs.com/trusted-publishers/)
* [npm classic tokens revoked](https://github.blog/changelog/2025-12-09-npm-classic-tokens-revoked-session-based-auth-and-cli-token-management-now-available/)
* [Actually you don’t need 'semantic-release' for semantic release](https://dev.to/antongolub/you-don-t-need-semantic-release-sometimes-3k6k)
* [stackoverflow.com/github-oauth2-token-how-to-restrict-access-to-read-a-single-private-repo](https://stackoverflow.com/questions/26372417/github-oauth2-token-how-to-restrict-access-to-read-a-single-private-repo)
* [npmjs.com/using-private-packages-in-a-ci-cd-workflow](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow)
* [https://github.com/cli/cli/issues/1425](https://github.com/cli/cli/issues/1425)
* [https://gist.github.com/Kovrinic/ea5e7123ab5c97d451804ea222ecd78a](https://gist.github.com/Kovrinic/ea5e7123ab5c97d451804ea222ecd78a)
* [https://docs.github.com/en/actions/reference/authentication-in-a-workflow#permissions-for-the-github_token](https://docs.github.com/en/actions/reference/authentication-in-a-workflow#permissions-for-the-github_token)
* [https://github.blog/changelog/2021-04-20-github-actions-control-permissions-for-github_token/](https://github.blog/changelog/2021-04-20-github-actions-control-permissions-for-github_token/)
* [Not invented here](https://en.wikipedia.org/wiki/Not_invented_here)
