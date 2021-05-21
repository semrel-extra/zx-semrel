# zx-semrel
[zx](https://github.com/google/zx) -based release script as [semantic-release](https://github.com/semantic-release/semantic-release) alternative (PoC)

## Motivation
Sometimes bloody enterprise enforces you not to use any third-party solutions for sensitive operations (like release, deploy, so on).
Old good script **copy-paste** hurries to the rescue!

## Key features
* Zero dependencies
* Reliability and safety*
* Simplicity and maintainability*
* \* - sarcazm

## Usage
```bash
zx ./release.mjs
```
or just this like if `zx` is not installed:
```
npx zx ./release.mjs
```

## Refs
* [stackoverflow.com/github-oauth2-token-how-to-restrict-access-to-read-a-single-private-repo](https://stackoverflow.com/questions/26372417/github-oauth2-token-how-to-restrict-access-to-read-a-single-private-repo)
* [NIH](https://en.wikipedia.org/wiki/Not_invented_here)
* [npmjs.com/using-private-packages-in-a-ci-cd-workflow](https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow)
* [https://github.com/cli/cli/issues/1425](https://github.com/cli/cli/issues/1425)
* [https://gist.github.com/Kovrinic/ea5e7123ab5c97d451804ea222ecd78a](https://gist.github.com/Kovrinic/ea5e7123ab5c97d451804ea222ecd78a)
* [https://docs.github.com/en/actions/reference/authentication-in-a-workflow#permissions-for-the-github_token](https://docs.github.com/en/actions/reference/authentication-in-a-workflow#permissions-for-the-github_token)
