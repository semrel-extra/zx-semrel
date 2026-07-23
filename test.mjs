import 'zx/globals'
import {test, describe, beforeEach, afterEach} from 'node:test'
import assert from 'node:assert'
import {PassThrough} from 'node:stream'
import {EventEmitter} from 'node:events'
import {mkdtempSync, writeFileSync, rmSync, readFileSync, statSync, existsSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'

function proc(stdout = '', code = 0) {
  const p = new EventEmitter()
  p.stdout = new PassThrough()
  p.stderr = new PassThrough()
  p.stdin = new PassThrough()
  p.pid = 1
  process.nextTick(() => {
    p.stdout.end(stdout)
    p.stderr.end('')
    p.emit('close', code, null)
    p.emit('exit', code, null)
  })
  return p
}

function createMock(responses = []) {
  const calls = []
  const spawn = (cmd, args) => {
    const command = args?.[args.length - 1] || cmd
    calls.push(command)
    for (const [pattern, output, code] of responses) {
      if (typeof pattern === 'string' ? command.includes(pattern) : pattern.test(command))
        return proc(output, code ?? 0)
    }
    return proc('')
  }
  return {spawn, calls}
}

const gitResponses = (overrides = {}) => [
  ['git config --get remote.origin.url', overrides.originUrl ?? 'https://github.com/test-org/test-repo.git'],
  ['git branch --show-current', overrides.branch ?? 'master'],
  ['git tag -l', overrides.tags ?? 'v1.0.0\nv0.9.0\n'],
  ['git rev-list -1', overrides.revList ?? 'abc1234'],
  ['git log --format', overrides.log ?? ''],
  [/npm.*version/, ''],
  ['git config user.name', ''],
  ['git config user.email', ''],
  ['git remote set-url', ''],
  ['git add', ''],
  ['git commit', ''],
  [/git tag/, ''],
  ['git push', ''],
  ['curl', '{}'],
  ['npm publish', ''],
  [/jq/, '{}'],
  [/echo/, ''],
]

let tmpDir, origCwd, origEnv

// release.mjs writes the opt-in SSH signing key to this fixed path in os.tmpdir()
const signKeyFile = join(tmpdir(), 'zx-semrel-ssh-signing-key')
// synthetic multi-line key material — git is mocked, so it need not be a real key
const signKey = 'zx-semrel-test-key-line-1\nzx-semrel-test-key-line-2\nzx-semrel-test-key-line-3'

const baseEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  GITHUB_TOKEN: 'ghp_test123',
  NPM_TOKEN: 'npm_test123',
}

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'zx-semrel-test-'))
  writeFileSync(join(tmpDir, 'package.json'), JSON.stringify({
    name: 'test-pkg',
    version: '1.0.0',
  }))
  writeFileSync(join(tmpDir, 'CHANGELOG.md'), '# Changelog\n')
  origCwd = process.cwd()
  origEnv = $.env
  $.env = {...baseEnv}
  process.chdir(tmpDir)
})

afterEach(() => {
  process.chdir(origCwd)
  $.env = origEnv
  rmSync(tmpDir, {recursive: true, force: true})
  rmSync(signKeyFile, {force: true})
})

async function run(mock, env) {
  if (env) Object.assign($.env, env)
  $.spawn = mock.spawn
  $.quiet = true
  $.verbose = false
  const mod = await import(`./release.mjs?t=${Date.now()}`)
  await mod.default
}

const has = (calls, pattern) => calls.some(c => c.includes(pattern))

describe('release.mjs', () => {

  test('no semantic changes — skips release', async () => {
    const mock = createMock(gitResponses({
      log: '+++chore: update deps____abc1__abc1full',
    }))
    await run(mock)
    assert.ok(!has(mock.calls, 'git push'))
    assert.ok(!has(mock.calls, 'npm publish'))
  })

  test('fix commit — patch release', async () => {
    const mock = createMock(gitResponses({
      log: '+++fix: broken thing____def1__def1full',
    }))
    await run(mock)
    assert.ok(has(mock.calls, 'version 1.0.1'))
    assert.ok(has(mock.calls, 'v1.0.1'))
    assert.ok(has(mock.calls, 'git push'))
    assert.ok(has(mock.calls, 'npm publish'))
  })

  test('feat commit — minor release', async () => {
    const mock = createMock(gitResponses({
      log: '+++feat: new feature____aaa1__aaa1full',
    }))
    await run(mock)
    assert.ok(has(mock.calls, 'version 1.1.0'))
  })

  test('breaking change — major release', async () => {
    const mock = createMock(gitResponses({
      log: '+++feat: big change__BREAKING CHANGE: everything__bbb1__bbb1full',
    }))
    await run(mock)
    assert.ok(has(mock.calls, 'version 2.0.0'))
  })

  test('dry run — stops before git push', async () => {
    const mock = createMock(gitResponses({
      log: '+++fix: something____ccc1__ccc1full',
    }))
    await run(mock, {DRY_RUN: 'true'})
    assert.ok(has(mock.calls, 'version 1.0.1'))
    assert.ok(!has(mock.calls, 'git push'))
    assert.ok(!has(mock.calls, 'npm publish'))
  })

  test('OIDC mode — no NPM_TOKEN in npmrc, --provenance forced', async () => {
    const mock = createMock(gitResponses({
      log: '+++fix: oidc test____ddd1__ddd1full',
    }))
    $.env = {...baseEnv, GITHUB_TOKEN: 'ghp_test123', NPM_OIDC: 'true', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.actions.githubusercontent.com'}
    await run(mock)

    const publishCalls = mock.calls.filter(c => c.includes('npm publish') && c.includes('registry.npmjs.org'))
    assert.ok(publishCalls.length > 0, 'should publish to npmjs')
    assert.ok(publishCalls.every(c => c.includes('--provenance')), '--provenance should be set')

    const npmrcCall = mock.calls.find(c => c.includes('--userconfig='))
    const npmrcPath = npmrcCall?.match(/--userconfig=(\S+)/)?.[1]
    if (npmrcPath) {
      const content = readFileSync(npmrcPath, 'utf8')
      assert.ok(!content.includes('registry.npmjs.org/:_authToken'), 'npmrc should not contain npmjs token')
      assert.ok(content.includes('npm.pkg.github.com/:_authToken'), 'npmrc should contain gh packages token')
    }
  })

  test('legacy mode — NPM_TOKEN in npmrc', async () => {
    const mock = createMock(gitResponses({
      log: '+++fix: legacy test____eee1__eee1full',
    }))
    await run(mock)

    const npmrcCall = mock.calls.find(c => c.includes('--userconfig='))
    const npmrcPath = npmrcCall?.match(/--userconfig=(\S+)/)?.[1]
    if (npmrcPath) {
      const content = readFileSync(npmrcPath, 'utf8')
      assert.ok(content.includes('registry.npmjs.org/:_authToken=npm_test123'), 'npmrc should contain NPM_TOKEN')
    }
  })

  test('missing GITHUB_TOKEN — throws', async () => {
    const mock = createMock(gitResponses())
    $.env = {...baseEnv, GITHUB_TOKEN: '', NPM_TOKEN: 'npm_test123'}
    await assert.rejects(() => run(mock), /GITHUB_TOKEN or GH_TOKEN is required/)
  })

  test('NPM_OIDC without ACTIONS_ID_TOKEN_REQUEST_URL — throws', async () => {
    const mock = createMock(gitResponses())
    await assert.rejects(() => run(mock, {NPM_OIDC: 'true'}), /NPM_OIDC requires GitHub Actions/)
  })

  test('no NPM_OIDC and no NPM_TOKEN — throws', async () => {
    const mock = createMock(gitResponses())
    const {NPM_TOKEN: _, ...envWithoutNpm} = baseEnv
    $.env = {...envWithoutNpm, GITHUB_TOKEN: 'ghp_test123'}
    await assert.rejects(() => run(mock), /Either NPM_OIDC or NPM_TOKEN is required/)
  })

  test('PUSH_MAJOR_TAG — pushes major version tag', async () => {
    const mock = createMock(gitResponses({
      log: '+++fix: major tag test____fff1__fff1full',
    }))
    await run(mock, {PUSH_MAJOR_TAG: 'true'})
    assert.ok(has(mock.calls, 'git tag -fa v1'))
    assert.ok(mock.calls.filter(c => c.includes('git push')).length >= 2)
  })

  test('no tags — uses package.json version', async () => {
    const mock = createMock(gitResponses({
      tags: '\n',
      log: '+++fix: first release____ggg1__ggg1full',
    }))
    await run(mock)
    assert.ok(has(mock.calls, 'version 1.0.0'))
  })

  test('GIT_SIGN_KEY — enables SSH signing via local git config and writes 0600 key file', async () => {
    rmSync(signKeyFile, {force: true})
    const mock = createMock(gitResponses({
      log: '+++fix: sign the release____sig1__sig1full',
    }))
    // surrounding whitespace proves the key is trimmed before writing
    await run(mock, {GIT_SIGN_KEY: `\n${signKey}\n`})

    // SSH signing configured — locally only, never --global
    assert.ok(has(mock.calls, 'git config gpg.format ssh'))
    assert.ok(has(mock.calls, 'git config user.signingkey'))
    assert.ok(has(mock.calls, 'git config commit.gpgsign true'))
    assert.ok(has(mock.calls, 'git config tag.gpgsign true'))
    assert.ok(!mock.calls.some(c => c.includes('--global')), 'signing must never touch global git config')
    // signingkey points at the written key file
    assert.ok(mock.calls.some(c => c.includes('user.signingkey') && c.includes(signKeyFile)))
    // release still proceeds
    assert.ok(has(mock.calls, 'git commit'))
    assert.ok(has(mock.calls, 'git push'))

    // key material preserved exactly: multi-line, single trailing newline, mode 0600
    const content = readFileSync(signKeyFile, 'utf8')
    assert.strictEqual(content, signKey + '\n')
    assert.strictEqual(content.split('\n').filter(Boolean).length, 3, 'multi-line key preserved')
    assert.strictEqual(statSync(signKeyFile).mode & 0o777, 0o600)
  })

  test('GIT_SIGN_KEY unset — no signing config, unsigned commit (no regression)', async () => {
    rmSync(signKeyFile, {force: true})
    const mock = createMock(gitResponses({
      log: '+++fix: plain unsigned release____uns1__uns1full',
    }))
    await run(mock)

    assert.ok(!has(mock.calls, 'gpg.format'))
    assert.ok(!has(mock.calls, 'user.signingkey'))
    assert.ok(!has(mock.calls, 'commit.gpgsign'))
    assert.ok(!has(mock.calls, 'tag.gpgsign'))
    // commit is still created and pushed — just unsigned
    assert.ok(has(mock.calls, 'git commit'))
    assert.ok(has(mock.calls, 'git push'))
    assert.ok(!existsSync(signKeyFile), 'no key file when GIT_SIGN_KEY is unset')
  })

  test('dry run with GIT_SIGN_KEY — writes no key file and changes no git config', async () => {
    rmSync(signKeyFile, {force: true})
    const mock = createMock(gitResponses({
      log: '+++fix: dry signed run____dry1__dry1full',
    }))
    await run(mock, {DRY_RUN: 'true', GIT_SIGN_KEY: signKey})

    assert.ok(!has(mock.calls, 'gpg.format'))
    assert.ok(!has(mock.calls, 'commit.gpgsign'))
    assert.ok(!has(mock.calls, 'user.signingkey'))
    // guard returns before the post-guard config/commit section runs at all
    assert.ok(!has(mock.calls, 'git config user.name'))
    assert.ok(!has(mock.calls, 'git push'))
    assert.ok(!existsSync(signKeyFile), 'dry run must not write the signing key file')
  })
})
