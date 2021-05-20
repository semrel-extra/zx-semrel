// Replaces semantic-release with zx script

(async () => {
  $.verbose = false

  const semanticTagPattern =  /^(v?)(\d+)\.(\d+)\.(\d+)$/
  const releaseSeverityOrder = ['major', 'minor', 'patch']
  const semanticRules = [
    {group: 'Features', releaseType: 'minor', prefixes: ['feat']},
    {group: 'Fixes & improvements', releaseType: 'patch', prefixes: ['fix', 'perf', 'refactor', 'docs']},
    {group: 'BREAKING CHANGES', releaseType: 'major', keywords: ['BREAKING CHANGE', 'BREAKING CHANGES']},
  ]

  const tags = (await $`git tag --merged`).toString().split('\n')
  const lastTag = tags.filter(tag => semanticTagPattern.test(tag)).pop()
  const newCommits = (lastTag
    ? await $`git log --format=+++%s__%b__%h__%H ${await $`git rev-list -1 ${lastTag}`}..HEAD`
    : await $`git log --format=+++%s__%b__%h__%H HEAD`)
    .toString()
    .split('+++')
    .filter(Boolean)
    .map(msg => {
      const [subj, body, short, hash] = msg.split('__').map(raw => raw.trim())
      return {subj, body, short, hash}
    })

  const semanticChanges = newCommits.reduce((acc, {subj, body, short, hash}) => {
    semanticRules.forEach(({group, releaseType, prefixes, keywords}) => {
      const prefixMatcher = prefixes && new RegExp(`^(${prefixes.join('|')})(\\(\\w+\\))?:\\s.+$`)
      const keywordsMatcher = keywords && new RegExp(`(${keywords.join('|')})`)

      if (prefixMatcher && prefixMatcher.test(subj) || keywordsMatcher && keywordsMatcher.test(body)) {
        acc.push({
          group,
          releaseType,
          subj,
          body,
          short,
          hash
        })
      }
    })

    return acc
  }, [])

  const nextReleaseType = releaseSeverityOrder.find(type => semanticChanges.find(({releaseType}) => type === releaseType))
  const nextVersion = ((lastTag, releaseType) => {
    if (!releaseType) {
      return
    }
    if (!lastTag) {
      return '1.0.0'
    }

    const [,, c1, c2, c3] = semanticTagPattern.exec(lastTag)
    if (releaseType === 'major') {
      return `${1 + +c1}.0.0`
    }
    if (releaseType === 'minor') {
      return `${c1}.${1 + +c2}.0`
    }
    if (releaseType === 'patch') {
      return `${c1}.${c2}.${1 + +c3}`
    }
  })(lastTag, nextReleaseType)

  if (!nextVersion) {
    console.log('No semantic changes - no semantic release.')
    return
  }

  const nextTag = 'v' + nextVersion
  const originUrl = (await $`git config --get remote.origin.url`).toString().trim()
  const repoUrl = 'https://' + originUrl.replace(':', '/').replace(/\.git/, '').match(/.+(@|\/\/)(.+)$/)[2]
  const releaseDiffRef = `##[${nextVersion}](${repoUrl}/compare/${lastTag}...${nextTag}) (${new Date().toISOString().slice(0, 10)})`
  const releaseDetails = Object.values(semanticChanges
    .reduce((acc, {group, subj, short, hash}) => {
      const { commits } = acc[group] || (acc[group] = {commits: [], group})
      const commitRef = `${subj} ([${short}](${hash}))`

      commits.push(commitRef)

      return acc
    }, {}))
    .map(({group, commits}) => `
###${group}
${commits.join('\n')}`).join('\n')

  const releaseNotes = releaseDiffRef + '\n' + releaseDetails

  console.log('semanticChanges=', semanticChanges)
  console.log('releaseNotes=', releaseNotes)
  // console.log('releaseDetails=', releaseDetails)

  // console.log('semanticChanges=', semanticChanges)
  // console.log('lastTag=', lastTag)
  // console.log('nextReleaseType=', nextReleaseType)
  // console.log('nextVersion=', nextVersion)

  // Update package.json version
  // await $`npm --no-git-tag-version version ${nextVersion}`

  // Create .npmrc
  //await $`echo '//registry.npmjs.org/:_authToken=\${NPM_TOKEN}' > .npmrc`

  // prepare git commit and push
  // Regular github token can not provide access to single repository only.
  // This is the key to all doors. SSH deploy keys may be more safe alternative.
  // https://stackoverflow.com/questions/26372417/github-oauth2-token-how-to-restrict-access-to-read-a-single-private-repo



// Next steps:
// 1. update package.json version
// 2. create changelog.md or just append new changes and version
// 3. git add, git commit, git push with tag
// 4. npm publish
})()


