// Replaces semantic-release with zx script

export default (async () => {
  const env = $.env
  $.quiet = !env.VERBOSE
  $.verbose = !!env.VERBOSE
  $.noquote = $({quote: v => v})

  const {GIT_BRANCH, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL, GITHUB_TOKEN, GH_TOKEN, GH_USER, PKG_ALIAS, PUSH_MAJOR_TAG, NPM_TOKEN, NPM_OIDC, NPM_PROVENANCE, ACTIONS_ID_TOKEN_REQUEST_URL, DEBUG, DRY_RUN} = env
  const ghAuth = GITHUB_TOKEN || GH_TOKEN
  const npmOidc = NPM_OIDC || (!NPM_TOKEN && ACTIONS_ID_TOKEN_REQUEST_URL)

  if (!ghAuth)
    throw new Error('env.GITHUB_TOKEN or GH_TOKEN is required')
  if (npmOidc && !ACTIONS_ID_TOKEN_REQUEST_URL)
    throw new Error('NPM_OIDC requires GitHub Actions environment with `id-token: write` permission')
  if (!npmOidc && !NPM_TOKEN)
    throw new Error('Either NPM_OIDC or NPM_TOKEN is required for npm publishing')

  const debug = DEBUG || argv['debug']
  const dryRun = DRY_RUN || argv['dry-run']
  const committerName = GIT_COMMITTER_NAME || 'Semrel Extra Bot'
  const committerEmail = GIT_COMMITTER_EMAIL || 'semrel-extra-bot@hotmail.com'
  const ghUser = GH_USER ? GH_USER.replace('@', '') + ':' : ''
  const originUrl = (await $`git config --get remote.origin.url`).toString().trim()
  const branch = GIT_BRANCH || (await $`git branch --show-current`).toString().trim() || 'master'
  const [,,repoHost, repoName] = originUrl.replace(':', '/').replace(/\.git/, '').match(/.+(@|\/\/)([^/]+)\/(.+)$/)
  const repoUrl = `https://${repoHost}/${repoName}`
  const repoAuthUrl = `https://${ghUser}${ghAuth}@${repoHost}/${repoName}.git`

  // Commits analysis
  const semanticTagPattern = /^v?(\d+)\.(\d+)\.(\d+)$/
  const releaseSeverityOrder = ['major', 'minor', 'patch']
  const semanticRules = [
    {group: 'Features', releaseType: 'minor', prefixes: ['feat']},
    {group: 'Fixes & improvements', releaseType: 'patch', prefixes: ['fix', 'perf', 'refactor', 'docs']},
    {group: 'BREAKING CHANGES', releaseType: 'major', keywords: ['BREAKING CHANGE', 'BREAKING CHANGES']},
  ]

  const pkgJson = await fs.readJSON('./package.json')
  const tags = (await $`git tag -l --sort=-v:refname`).toString().split('\n').map(t => t.trim())
  const lastTag = tags.find(t => semanticTagPattern.test(t))
  const commitsRange = lastTag ? `${(await $`git rev-list -1 ${lastTag}`).toString().trim()}..HEAD` : 'HEAD'
  const newCommits = (await $.noquote`git log --format=+++%s__%b__%h__%H ${commitsRange}`)
    .toString()
    .split('+++')
    .filter(Boolean)
    .map(msg => {
      const [subj, body, short, hash] = msg.split('__').map(s => s.trim())
      return {subj, body, short, hash}
    })

  const semanticChanges = newCommits.reduce((acc, {subj, body, short, hash}) => {
    semanticRules.forEach(({group, releaseType, prefixes, keywords}) => {
      const prefixMatcher = prefixes && new RegExp(`^(${prefixes.join('|')})(\\([a-z0-9\\-_]+\\))?:\\s.+$`)
      const keywordsMatcher = keywords && new RegExp(`(${keywords.join('|')}):\\s(.+)`)
      const change = subj.match(prefixMatcher)?.[0] || body.match(keywordsMatcher)?.[2]
      if (change) acc.push({group, releaseType, change, subj, body, short, hash})
    })
    return acc
  }, [])
  console.log('semanticChanges=', semanticChanges)
  debug && console.log('tags', tags)

  const nextReleaseType = releaseSeverityOrder.find(type => semanticChanges.find(({releaseType}) => type === releaseType))
  if (!nextReleaseType) {
    console.log('No semantic changes - no semantic release.')
    return
  }
  const nextVersion = ((tag, type) => {
    if (!type) return
    if (!tag) return pkgJson.version || '1.0.0'
    const [, c1, c2, c3] = semanticTagPattern.exec(tag)
    if (type === 'major') return `${-~c1}.0.0`
    if (type === 'minor') return `${c1}.${-~c2}.0`
    if (type === 'patch') return `${c1}.${c2}.${-~c3}`
  })(lastTag, nextReleaseType)

  const nextTag = 'v' + nextVersion
  const releaseDiffRef = `## [${nextVersion}](${repoUrl}/compare/${lastTag}...${nextTag}) (${new Date().toISOString().slice(0, 10)})`
  const releaseDetails = Object.values(semanticChanges
    .reduce((acc, {group, change, short, hash}) => {
      const {commits} = acc[group] || (acc[group] = {commits: [], group})
      commits.push(`* ${change} ([${short}](${repoUrl}/commit/${hash}))`)
      return acc
    }, {}))
    .map(({group, commits}) => `\n### ${group}\n${commits.join('\n')}`).join('\n')

  const releaseNotes = releaseDiffRef + '\n' + releaseDetails + '\n'

  await $`echo ${releaseNotes}"\n$(cat ./CHANGELOG.md)" > ./CHANGELOG.md`
  await $`npm --no-git-tag-version --allow-same-version version ${nextVersion}`

  if (dryRun) return

  await $`git config user.name ${committerName}`
  await $`git config user.email ${committerEmail}`
  await $`git remote set-url origin ${repoAuthUrl}`

  console.log('git push')
  const releaseMessage = `chore(release): ${nextVersion} [skip ci]`
  await $`git add -A .`
  await $`git commit -am ${releaseMessage}`
  await $`git tag -a ${nextTag} HEAD -m ${releaseMessage}`
  await $`git push --follow-tags origin HEAD:refs/heads/${branch}`
  if (PUSH_MAJOR_TAG) {
    const majorTag = nextTag.split('.')[0]
    await $`git tag -fa ${majorTag} HEAD -m ${releaseMessage}`
    await $`git push --follow-tags -f origin ${majorTag}`
  }

  // GitHub release
  console.log('github release')
  const releaseData = JSON.stringify({name: nextTag, tag_name: nextTag, body: releaseNotes})
  await $`curl -H "Authorization: token ${ghAuth}" -H "Accept: application/vnd.github.v3+json" https://api.github.com/repos/${repoName}/releases -d ${releaseData}`

  // Publish npm artifact
  if (!pkgJson.private) {
    const aliases = new Set([pkgJson.name, PKG_ALIAS || pkgJson.alias].flat(1).filter(Boolean))
    const npmjsRegistry = 'https://registry.npmjs.org/'
    const provenance = NPM_PROVENANCE || npmOidc
    const npmrc = (() => {
      const local = path.resolve(process.cwd(), '.npmrc')
      if (fs.existsSync(local)) return local

      const lines = []
      if (!npmOidc && NPM_TOKEN) lines.push(`//registry.npmjs.org/:_authToken=${NPM_TOKEN}`)
      lines.push(`//npm.pkg.github.com/:_authToken=${ghAuth}`)

      const tmp = path.resolve(fs.realpathSync(os.tmpdir()), 'zx-semrel', Math.random().toString(36).substring(2), '.npmrc')
      fs.outputFileSync(tmp, lines.join('\n') + '\n')
      return tmp
    })()

    if (npmOidc) console.log('npm publish: OIDC trusted publishing enabled')

    for (const alias of aliases) {
      console.log(`npm publish ${alias} ${nextVersion} to ${npmjsRegistry}`)
      const flags = ['--no-git-tag-version', `--registry=${npmjsRegistry}`, `--userconfig=${npmrc}`, provenance && '--provenance'].filter(Boolean)
      await $.noquote`echo "\`jq '.name="${alias}"' package.json\`" > package.json`
      await $`npm publish ${flags}`
    }

    console.log(`npm publish @${repoName} ${nextVersion} to https://npm.pkg.github.com`)
    await $`echo "\`jq '.name="@${repoName}"' package.json\`" > package.json`
    await $`npm publish --no-git-tag-version --registry=https://npm.pkg.github.com/ --userconfig ${npmrc}`
  }

  console.log(chalk.bold('Great success!'))

  if (pkgJson.scripts?.postrelease) {
    console.log('postrelease')
    await $`npm run postrelease`
  }
})()
