const { execSync } = require('child_process')
const settings = require('./args')
const { DownloaderHelper } = require('node-downloader-helper')
const fs = require('fs-extra')
const got = require('got')
const _ = require('lodash')
const path = require('path')
const queue = require('async/queue')

async function cleanUp(code) {
  switch (code) {
    case 0:
      console.log('Success')
      // update current release
      cleanupReleases(false)
      break;
    case 1:
      console.log('Failed')
      // remove release folder
      cleanupReleases(true)
      break;
    case 2:
      console.log('Nothing to deploy')
      // remove release folder
      cleanupReleases(true)
      break;
    default:
      console.log("Unknown error")
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

    if (dirExists(path.join(settings.path, settings.currentFolder))) {
      try {
        fs.unlinkSync(path.join(settings.path, settings.currentFolder))
      } catch (error) {
        console.log('error removing current symlink')
        process.exitCode(1)
        return
      }
    }
    try {
      fs.symlinkSync(path.resolve(
        path.join(settings.path, settings.releasesFolder, settings.release)),
        path.join(settings.path, settings.currentFolder), 'dir')
    } catch (error) {
      console.log('error creating symlink')
      process.exitCode(1)
      // @TODO: try and recreate current symlink
    }

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
  try {
    return fs.lstatSync(path.join(settings.path, settings.currentFolder)).isSymbolicLink()
  } catch (error) {
    return false
  }
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
  return path.join(settings.path, settings.currentFolder)
}

function getNewReleasePath() {
  return path.join(settings.path, settings.releasesFolder, settings.release)
}

function getPath() {
  return fs.realpathSync(path.resolve(settings.path))
}

async function linkShared() {
  if (settings.sharedFolder || settings.sharedFile) {
    if (!dirExists(path.join(getPath(), 'shared')) && !createDir(path.join(getPath(), 'shared'))) {
      console.log('Error setting up shared folders')
      process.exit(1)
    }
    if (settings.sharedFolder) {
      for (const sharedFolder of settings.sharedFolder) {
        if (dirExists(path.join(settings.path, 'shared', sharedFolder)) ||
          createDir(path.join(settings.path, 'shared', sharedFolder))) {
          try {
            fs.symlinkSync(
              path.resolve(path.join(settings.path, 'shared', sharedFolder)),
              path.join(settings.path, settings.releasesFolder,
                settings.release, sharedFolder),
              'dir'
            )
          } catch (error) {
            console.log(error)
            process.exit(1)
          }
        } else {
          console.log(
            "Error shared folder doesn't exist or not a folder or symlink")
          process.exit(1)
        }
      }
    }

    if (settings.sharedFile) {
      for (const sharedFile of settings.sharedFile) {
        console.log(sharedFile)
        try {
          let dir = path.parse(sharedFile).dir
          if (fs.pathExistsSync(path.join(settings.path, 'shared', sharedFile))) {
            fs.ensureDirSync(path.join(getNewReleasePath(), dir))
            console.log("Created:", path.join(getNewReleasePath(), dir))
            fs.symlinkSync(
              path.resolve(path.join(settings.path, 'shared', sharedFile)),
              path.join(getNewReleasePath(), sharedFile),
              'file'
            )
          } else {
            console.log("Shared file doesn't exist:", path.join(settings.path, 'shared', sharedFile))
          }
        } catch (error) {
          console.log(error)
          process.exit(1)
        }
      }
    }
  }
}

async function runPostCommand() {
  try {
    if (settings.postCommand) {
      for (const cmd of settings.postCommand) {
        console.log('Executing post command: ', cmd)
        const command = execSync(cmd, {
          cwd: getNewReleasePath(),
          stdio: 'inherit'
        })
      }
    }
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
      const dl = new DownloaderHelper(task.url, path.dirname(targetFile), {
        method: 'GET',
        fileName: filename => `${path.basename(targetFile)}`,
        retry: { maxRetries: 5, delay: 3000 },
        timeout: 6000
      });

      dl.on('error', (err) => {
        console.error('Something happened', err);
        process.exit(1);
      });

      if (settings.debug === true) {
        dl
        .on('end', downloadInfo => console.log('Download Completed: ', downloadInfo))
        .on('retry', (attempt, opts, err) => {
          console.log({
            RetryAttempt: `${attempt}/${opts.maxRetries}`,
            StartsOn: `${opts.delay / 1000} secs`,
            Reason: err ? err.message : 'unknown'
          });
        })
        .on('resume', isResumed => {
          console.log('Resuming');
        });
      }

      await dl.start();
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
  linkShared,
  runPostCommand,
  saveAssetQueue
}
