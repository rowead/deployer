const settings = require('./args.js')
const fs = require('fs')
const { createDir, getNewReleasePath, getPath, dirExists } = require('./utils.js')
const path = require('path')
const semver = require('semver')
const simpleGit = require('simple-git')
const git = simpleGit()

async function initRepo(repoUrl) {
  try {
    const clone = await git.clone(
      repoUrl,
      path.join(getPath(), 'repo'),
      {
        '--bare': true,
        '--no-single-branch': true,
        '--depth': 1
      }
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
  try {
    if (!fs.existsSync(path.join(getPath(), 'repo'))) {
      console.log('repo folder does not exist')
      await initRepo(repoUrl)
      gitRepo = simpleGit(path.join(getPath(), 'repo'))
    } else {
      try {
        gitRepo = simpleGit(path.join(getPath(), 'repo'))
        const originUrl = await gitRepo.raw(['remote', 'get-url', 'origin'])
        if (originUrl.trim() !== repoUrl) {
          console.log(`repo changed from ${originUrl.trim()} to ${repoUrl}`)
          fs.rmdirSync(path.join(getPath(), 'repo'), { recursive: true })
          await initRepo(repoUrl)
        }
      } catch (error) {
        console.log('Error changing repo URL')
        console.log(error)
        process.exit(1)
      }
    }

    if (!dirExists(path.join(getPath(), 'shared')) && !createDir(path.join(getPath(), 'shared'))) {
      console.log('Error setting up shared folders')
      process.exit(1)
    }

    try {
      await gitRepo.fetch({'--depth': 1})
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
    
    if (settings.sharedFolder) {
      for (const sharedFolder of settings.sharedFolder) {
        if (dirExists(path.join(settings.path, 'shared', sharedFolder)) || createDir(path.join(settings.path, 'shared', sharedFolder))) {
          try {
            fs.symlinkSync(
              path.resolve(path.join(settings.path, 'shared', sharedFolder)),
              path.join(settings.path, settings.releasesFolder, settings.release, sharedFolder),
              'dir'
            )
          }
          catch (error) {
            console.log(error)
            process.exit(1)
          }
        }
        else {
          console.log("Error shared folder doesn't exist or not a folder or symlink")
          process.exit(1)
        }
      }
    }
  }
  catch (error) {
    console.log(error)
    process.exit(1)
  }
}

module.exports = deploy
