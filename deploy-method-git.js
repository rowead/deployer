const settings = require('./args.js')
const fs = require('fs')
const { createDir, currentReleaseExists, getCurrentReleasePath, getNewReleasePath, getPath, dirExists } = require('./utils.js')
const path = require('path')
const semver = require('semver')
const simpleGit = require('simple-git')
const git = simpleGit()

async function initRepo(repoUrl) {
  try {
    const clone = await git.clone(
      repoUrl,
      path.join(getPath(), 'repo'),
      [
        '--mirror'
      ]
    )
  } catch (error) {
    console.log('Error cloning repo')
    process.exit(1)
  }
}

async function deploy(local = false) {
  let auth = ''
  if (settings.user && settings.pass) {
    auth = `${settings.user}:${settings.pass}@`
  }
  let repoUrl = `https://${auth}${settings.gitRepo}`
  let gitRepo
  let repoNewOrChanged = false
  try {
    if (!fs.existsSync(path.join(getPath(), 'repo'))) {
      console.log('repo folder does not exist')
      await initRepo(repoUrl)
      repoNewOrChanged = true
      gitRepo = simpleGit(path.join(getPath(), 'repo'))
    } else {
      try {
        gitRepo = simpleGit(path.join(getPath(), 'repo'))
        const originUrl = await gitRepo.raw(['remote', 'get-url', 'origin'])
        if (originUrl.trim() !== repoUrl) {
          console.log(`repo changed from ${originUrl.trim()} to ${repoUrl}`)
          fs.rmdirSync(path.join(getPath(), 'repo'), { recursive: true })
          await initRepo(repoUrl)
          repoNewOrChanged = true
          gitRepo = simpleGit(path.join(getPath(), 'repo'))
        }
      } catch (error) {
        console.log('Error changing repo URL')
        console.log(error)
        process.exit(1)
      }
    }

    try {
      await gitRepo.fetch()
      let gitBranch = settings.gitBranch
      if (semver.validRange(gitBranch)) {
        let tags = await gitRepo.tags()
        if (!(gitBranch = semver.maxSatisfying(tags.all, gitBranch))) {
          console.log('Error finding release for semver:', settings.gitBranch)
          // @TODO: exit or default to master?
          process.exit(1)
        } else {
          console.log('semver chosen:', gitBranch)
        }
      }
      if (!settings.force && !repoNewOrChanged) {
        if (currentReleaseExists()) {
          console.log('Checking if there is anything to deploy')
          const currentRepo = simpleGit(getCurrentReleasePath())
          if (await currentRepo.cwd(getCurrentReleasePath()).checkIsRepo()) {
            const tag = await currentRepo.tag(['--points-at'])
            console.log('current tag:', tag)
            if (gitBranch === tag.trim()) {
              console.log('no update needed')
              process.exit(2)
            }
            const currentRev = await currentRepo.revparse('@')
            const gitRev = await gitRepo.revparse(gitBranch)
            console.log("Revs:")
            console.log(currentRev)
            console.log(gitRev)
            if (currentRev === gitRev) {
              console.log('Revs match, no update needed')
              process.exit(2)
            }
          } else {
            console.log('current is not a git repository')
          }
        }
      }

      console.log(`Checking out ${gitBranch}`)
      const clone = await git.clone(
        path.join(getPath(), 'repo'),
        getNewReleasePath(),
        {
          '--branch': gitBranch,
          '--single-branch': true,
          '--depth': 1
        }
      )
    } catch (error) {
      console.log('Error cloning into release folder')
      console.log(error)
      process.exit(1)
    }
  } catch (error) {
    console.log(error)
    process.exit(1)
  }
}

module.exports = deploy
