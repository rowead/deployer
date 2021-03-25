const { execSync } = require('child_process')
const fs = require('fs-extra')
const path = require('path')
const settings = require('./args')
const {currentReleaseExists, getCurrentReleasePath, getNewReleasePath} = require('./utils')

/**
 *
 * @param local
 * @returns {Promise<any>}
 */
async function deploy(local = false) {

  if (currentReleaseExists() && !settings.force) {
    // Copy forward current release so the sync will be more efficient.
    try {
      fs.copySync(
        getCurrentReleasePath(),
        getNewReleasePath(),
        {
          preserveTimestamps: true
        })
    } catch(e) {
      console.log('Failed to copy current release.')
      console.log(e)
    }
  }

  if (settings.awsProfile && settings.awsS3Path) {
    try {
      let result = execSync(`"aws" s3 sync --only-show-errors --delete --profile=${settings.awsProfile} s3://museum.wa.gov.au.asset-sync/${settings.awsS3Path} ${getNewReleasePath()}${path.sep}`, {shell: "/bin/bash"})
      console.log(result.toString())
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