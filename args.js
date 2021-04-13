const moment = require('moment');
const argv = require('yargs')
  .config()
  .env('WAM_ASSET_SYNC')
  .option('aws-profile', {
    describe: 'Profile to use for aws cli',
    type: 'string',
    default: 'default'
  })
  .option('aws-s3-bucket', {
    describe: "Name of AWS Bucket" ,
    type: 'string'
  })
  .option('aws-s3-path', {
    describe: "Path to folder within bucket" ,
    type: 'string'
  })
  .option( 'current-folder', {
    type: 'string',
    description: 'Name to use for "current" symlink',
    default: 'current',
    hidden: true
  })
  .option('debug', {
    description: 'Output debug information to stdout',
    type: 'boolean',
    default: false
  })
  .option('deploy-method', {
    description: "Deployment module to use",
    type: 'string',
    default: 'git',
    choices: ['s3', 'git']
  })
  .option('force', {
    description: 'Force a full deployment downloading all assets',
    type: 'boolean',
    default: false
  })
  .option('git-repo', {
    describe: 'git repository',
    type: 'string'
  })
  .option('git-branch', {
    describe: 'git branch',
    type: 'string'
  })
  .option('keep-releases', {
    description: "Number of releases to keep (default 1)",
    type: 'int',
    default: 1
  })
  .option('path', {
    describe: 'Path to releases folder',
    type: 'string',
    default: './deployment'
  })
  .option('post-command', {
    describe: 'Command to execute post deployment',
    type: 'array'
  })
  .option('proxy', {
    describe: 'Use the corporate proxy?',
    default: false,
    type: 'boolean'
  })
  .option('pass', {
    describe: 'Password for access',
    type: 'string'
  })
  .option('user', {
    describe: 'Username for access',
    type: 'string'
  })
  .option('release', {
    default: function() {
      return moment().format('YYYYMMDDHHmmss');
    },
    description: 'Release folder, defaults to (YYYYMMDDHHmmss)',
    hidden: true
  })
  .options( 'releases-folder', {
    type: 'string',
    default: 'releases',
    description: 'Folder to store releases',
    hidden: true
  })
  .option('shared-folder', {
    describe: 'Shared folder name (capistrano like git deploys)',
    type: 'array'
  })
  .option('verbose', {
    alias: 'v',
    describe: 'Verbose output',
    default: false,
    type: 'boolean'
  })
  .help()
  .wrap(null)
  .argv;

module.exports = argv;