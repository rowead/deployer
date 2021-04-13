const { execSync } = require('child_process')
const settings = require('./args')
const fs = require('fs-extra')
const got = require('got')
const _ = require('lodash')
const pipe = require('multipipe')
const path = require('path')
const queue = require('async/queue')

async function cleanUp(code) {
  if (code === 0) {
    console.log('Success')
    // update current release
    cleanupReleases(false)
  } else {
    console.log('Failed')
    // remove release folder
    cleanupReleases(true)
  }
}

function cleanupReleases(failure) {
  console.log('cleanupReleases')
  console.log('release: ' + settings.release)
  if (failure !== true) {
    // build list of folders to remove
    let remove = fs.readdirSync(path.join(settings.path, settings.releasesFolder))

    // we don't want to remove the release we are creating
    // switch this to currentRelease and only call after current is updated
    let key = remove.indexOf(settings.release)
    remove.splice(key, 1)
    remove.sort(function (a, b) {
      if (a > b) {
        return -1
      }
      if (b > a) {
        return 1
      }
      return 0
    })

    for (i = 0; i < settings.keepReleases; i++) {
      console.log('keeping ' + remove.shift())
    }
    remove.forEach(function (release, index) {
      console.log('deleting ' + path.join(settings.path, settings.releasesFolder, release))
      // @TODO: add checks so it won't delete arbitrary folders
      fs.removeSync(path.join(settings.path, settings.releasesFolder, release))
    })
    console.log(remove)

    // @TODO: test with open files
    fs.unlink(path.join(settings.path, settings.currentFolder))
    fs.symlinkSync(path.resolve(path.join(settings.path, settings.releasesFolder, settings.release)), path.join(settings.path, settings.currentFolder), 'dir')
  } else {
    // remove release that we are working on
    // @TODO: only remove release if it exists and output debug info
    fs.removeSync(path.join(settings.path, settings.releasesFolder, settings.release))
    if (settings.debug) {
      console.log(path.join(settings.path, settings.releasesFolder, settings.release))
    }
  }
}

// @TODO: check for writability...
function createDir(path, force = false) {
  try {
    if (fs.statSync(path).isDirectory()) {
      if (settings.debug) {
        console.log('file already exists', path)
      }
      return true
    }
  } catch (error) {
    try {
      if (error.code === 'ENOENT') {
        fs.mkdirSync(path, { recursive: true})
        return true
      }
    } catch (error) {
      if (settings.debug) {
        console.log('error creating folder, aborting', path)
      }
      return false
    }
  }
}

async function createRelease() {
  // Check that the containing folder exists
  if (!createDir(settings.path)) {
    console.log('Error creating containing folder, aborting')
    process.exit(1)
  }
  console.log('Creating new release:', settings.release)
  if (!createDir(getNewReleasePath())) {
    console.log('could not create release')
    process.exit(1)
  }
  if (settings.debug) {
    console.log("release\t\t", settings.release)
  }
}

function currentReleaseExists() {
  return fs.lstatSync(path.join(settings.path, settings.currentFolder)).isSymbolicLink()
}

function dirExists(path) {
  try {
    if (fs.lstatSync(path).isSymbolicLink()) {
      console.log('path is a symlink', path)
      return true
    }
    if (fs.statSync(path).isDirectory()) {
      console.log('path is a directory', path)
      return true
    }
    return false
  } catch (error) {
    console.log('Not a folder or symlink', path)
    //console.log(error)
    return false
  }
}

function getCurrentReleasePath() {
  return fs.realpathSync(path.resolve(path.join(settings.path, settings.currentFolder)))
}

function getNewReleasePath() {
  return path.join(settings.path, settings.releasesFolder, settings.release)
}

function getPath() {
  return fs.realpathSync(path.resolve(settings.path))
}

async function runPostCommand(cmd) {
  try {
    const command = execSync(cmd, {
      cwd: getNewReleasePath(),
      stdio: 'inherit'
    })
  } catch(error) {
    console.log(error)
    process.exit(1)
  }
}

let saveAssetQueue = queue(async function(task, callback) {
  try {
    let targetFile = path.join(getNewReleasePath(), decodeURI(task.target.replace(/\?.*/, '')))
    let currentFile = path.join(getCurrentReleasePath(), decodeURI(task.target).replace(/\?.*/, ''))
    createDir(path.dirname( targetFile))

    // always download image derivatives as they may have changed, other drupal assets will always have a new URL (no change in place)
    if (settings.force === false && fs.existsSync(currentFile) && !task.target.match(/^\/sites\/default\/files\/styles\/.*/)) {
      if (settings.debug === true) {
        console.log('Copy Asset from current: ', targetFile)
      }
      fs.copySync(currentFile, targetFile)
    } else {
      if (settings.debug === true) {
        console.log('Downloading Asset:', task.target)
      }
      const save = await pipe(
          got.stream(task.url, {timeout: settings.queryTimeout}),
          fs.createWriteStream(targetFile)
      ).on('error', function (err, val) {
        console.error('Pipeline failed.', err.message)
        process.exit(1)
      })
    }
  } catch (error) {
    console.log(error)
  }
  callback()
},1)

module.exports =  {
  cleanUp,
  cleanupReleases,
  createDir,
  createRelease,
  currentReleaseExists,
  dirExists,
  getCurrentReleasePath,
  getNewReleasePath,
  getPath,
  runPostCommand,
  saveAssetQueue
}
