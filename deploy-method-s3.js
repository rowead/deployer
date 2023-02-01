const { execSync } = require('child_process')
const fs = require('fs-extra')
const path = require('path')
const settings = require('./args')
const {dirExists,currentReleaseExists, getCurrentReleasePath, getNewReleasePath} = require('./utils')

/**
 *
 * @param local
 * @returns {Promise<any>}
 */
async function deploy(local = false) {

  if (currentReleaseExists() && !settings.force) {
    // Copy forward current release so the sync will be more efficient.
    try {
      const ignore = [...(settings.sharedFolder || []), ...(settings.sharedFile || []), ...['.git']];
      const currentDirList = fs.readdirSync(getCurrentReleasePath());
      for (const item of currentDirList) {
        if (!ignore.includes(item)) {
          fs.copySync(
            path.join(getCurrentReleasePath(), item),
            path.join(getNewReleasePath(), item),
            {
              preserveTimestamps: true
            })
        } else {
          console.log('ignoring', item);
        }
      }
      // remove symlinks to shared files so aws s3 sync doesn't need to deal with them.
      for (const sharedFile of (settings.sharedFile || [])) {
        try {
          if (fs.pathExistsSync(path.join(getNewReleasePath(), sharedFile))) {
            fs.unlinkSync(path.join(getNewReleasePath(), sharedFile));
          }
        } catch (e) {
          console.log('Error removing Share File', e);
        }
      }
    } catch(e) {
      console.log('Failed to copy current release.')
      console.log(e)
    }
  }

  if (settings.awsProfile && settings.awsS3Path) {
    try {
      let result = execSync(`"aws" s3 sync --exact-timestamps --no-progress --delete --profile=${settings.awsProfile} s3://${settings.awsS3Bucket}/${settings.awsS3Path} ${getNewReleasePath()}${path.sep}`,
        {
          shell: process.platform === 'win32' ? "cmd.exe" : "/bin/bash",
          maxBuffer: 1024 * 1024 * 1024
        }
      )
      // console.log(result.toString().trim())
      const syncCount = result.toString().trim().match(/.+$/gm) ? result.toString().trim().match(/.+$/gm).length : 0;
      console.log(syncCount);
      if (syncCount < 1) {
        console.log('nothing synced, aborting');
        process.exit(2);
      }
    }
    catch (e) {
      console.log(e)
      process.exit(1)
    }
  } else {
    console.log('Both AWS Profile and S3 Path need to be provided')
    process.exit(1)
  }
}

module.exports = deploy