// Replaces semantic-release with zx script

(async () => {
  $.verbose = false

  const semanticTagPattern =  /^(\d+)\.(\d+)\.(\d+)$/
  const releaseSeverityOrder = ['major', 'minor', 'patch']
  const semanticRules = [
    {group: 'Features', releaseType: 'minor', prefixes: ['feat']},
    {group: 'Fixes & improvements', releaseType: 'patch', prefixes: ['fix', 'perf', 'refactor', 'docs']},
    {group: 'BREAKING CHANGES', releaseType: 'major', keywords: ['BREAKING CHANGE', 'BREAKING CHANGES']},
  ]

  const tags = (await $`git tag --merged`).toString().split('\n')
  const lastVersion = tags.filter(tag => semanticTagPattern.test(tag)).pop()
  const newCommits = (lastVersion
    ? await $`git log --format=%s___%b___%h___%H ${await $`git rev-list -1 ${lastVersion}`}..HEAD`
    : await $`git log --format=%s___%b___%h___%H HEAD`)
    .toString().trim()
    .split('\n')
    .map(msg => {
      const [subj, body, short, hash] = msg.split('___')
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
  const nextVersion = ((lastVersion, releaseType) => {
    if (!releaseType) {
      return
    }
    if (!lastVersion) {
      return '1.0.0'
    }

    const [,c1, c2, c3] = semanticTagPattern.exec(lastVersion)
    if (releaseType === 'major') {
      return `${1 + +c1}.0.0`
    }
    if (releaseType === 'minor') {
      return `${c1}.${1 + +c2}.0`
    }
    if (releaseType === 'patch') {
      return `${c1}.${c2}.${1 + +c3}`
    }
  })(lastVersion, nextReleaseType)

  if (!nextVersion) {
    console.log('No semantic changes - no semantic release.')
    return
  }

  const releaseDetails = semanticChanges.reduce((acc, {group}) => {}, {
    
  })

  console.log('releaseDetails=', releaseDetails)

  // console.log('semanticChanges=', semanticChanges)
  // console.log('lastVersion=', lastVersion)
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


