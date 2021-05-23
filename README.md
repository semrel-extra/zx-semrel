# zx-semrel
[![Release](https://github.com/antongolub/zx-semrel/workflows/Release/badge.svg)](https://github.com/antongolub/zx-semrel/actions)

[zx](https://github.com/google/zx) -based release script as [semantic-release](https://github.com/semantic-release/semantic-release) alternative (PoC)

Sometimes bloody enterprise enforces you not to use any third-party solutions for sensitive operations (like release, deploy, so on).
Old good script **copy-paste** hurries to the rescue!

### Requirements
* mac / linux
* Node.js >= 14
* git >= 2.0
* zx >= 1.6.0

### Key features
* Zero dependencies
* Zero configuration
* [Pretty fast](https://github.com/antongolub/zx-semrel/actions)
* Tiny, less than 140 lines with comments
* Reliability, safety, simplicity and maintainability (sarcasm)

### Functionality
* Poor [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/) analysis
* `CHANGELOG.md` generation
* `package.json` version bumping
* Git release commit creation
* [GitHub Release](https://docs.github.com/en/github/administering-a-repository/releasing-projects-on-github/managing-releases-in-a-repository#creating-a-release)
* Package publishing to both [npmjs](https://registry.npmjs.org) and [gh](http://npm.pkg.github.com) registries

## Usage
1. Copy
2. Tweak up, inject tokens, etc
3. Run
```bash
curl https://raw.githubusercontent.com/antongolub/zx-semrel/master/release.mjs > ./release.mjs
zx ./release.mjs
```
or just this like if `zx` is not installed:
```bash
# Just replace GIT* env values with your own
GIT_COMMITTER_NAME=antongolub GIT_COMMITER_EMAIL=mailbox@antongolub.ru GITHUB_TOKEN=token npx zx ./release.mjs
```
or run as is without any edits though **npx**:
```bash
# Cross your fingers for luck
GIT_COMMITTER_NAME=antongolub GIT_COMMITER_EMAIL=mailbox@antongolub.ru GITHUB_TOKEN=token npx zx-semrel
```
See also [gh-actions usage example](https://github.com/antongolub/zx-semrel/blob/master/.github/workflows/release.yml)

## License
[MIT](https://github.com/antongolub/zx-semrel/blob/master/LICENSE)

## Refs
* [Actually you don’t need 'semantic-release' for semantic release](https://dev.to/antongolub/you-don-t-need-semantic-release-sometimes-3k6k)
* [stackoverflow.com/github-oauth2-token-how-to-restrict-access-to-read-a-single-private-repo](https://stackoverflow.com/questions/26372417/github-oauth2-token-how-to-restrict-access-to-read-a-single-private-repo)
* [npmjs.com/using-private-packages-in-a-ci-cd-workflow](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow)
* [https://github.com/cli/cli/issues/1425](https://github.com/cli/cli/issues/1425)
* [https://gist.github.com/Kovrinic/ea5e7123ab5c97d451804ea222ecd78a](https://gist.github.com/Kovrinic/ea5e7123ab5c97d451804ea222ecd78a)
* [https://docs.github.com/en/actions/reference/authentication-in-a-workflow#permissions-for-the-github_token](https://docs.github.com/en/actions/reference/authentication-in-a-workflow#permissions-for-the-github_token)
* [https://github.blog/changelog/2021-04-20-github-actions-control-permissions-for-github_token/](https://github.blog/changelog/2021-04-20-github-actions-control-permissions-for-github_token/)
* [Not invented here](https://en.wikipedia.org/wiki/Not_invented_here)
