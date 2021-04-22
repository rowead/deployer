# Deployer

A cross-platform code and asset deployment script that uses a "capistrano" like release technique for atomic deployments.

## Features

- Deploy from a git repo or Amazon S3 bucket.
- Specify a git branch or semver.
- Exit codes can be used in your own scripts to handle service restarts etc.

## Requirements

- nodejs.
- The permissions to create symlinks on Windows.
- aws-cli required for syncing from S3 https://aws.amazon.com/cli/

## Installation

- Clone this repo.
- Run:
```
npm install
```

### Folder structure
```
/var/www/html/deployment/
  current -> releases/20210413115707 (always points to current "active" release)
  releases/
    20210413115705
    20210413115707/
      foo -> /var/www/html/deployment/shared/foo
      bar -> /var/www/html/deployment/shared/bar
      config/
        local.yaml -> -> /var/www/html/deployment/shared/config/local.yaml
      ... (the rest of the files deployed)
  repo/ (local bare git repo that is then checked out into a release)
  shared/
    foo/
    bar/
    config/local.yaml
```

You can specify any number of shared folders and files that will always be available withing the "current release".
Symlinks will be created within the current release and the contents of those folders can be managed however you wan't but **make sure they do not exist in the source that is being deployed**.
This is typically used to deploy large asset files outside of git or to allow persistent files created from within
your app.

Shared files will only be linked to if they exist withing the "shared" folder. They can be within a folder that is in the source but **should really be an ignored file and the file itself should not exist in the source**. Folders in the path will be created if they do not already exist in the release.

For the above example, you would set apache's document root to /var/www/html/deployment/current and if you used the argument
"--shared-folder=foo", it would be available at http://localhost/foo

Also see
```shell
./deploy --help
```

POSIX:
```shell
./deploy --git-repo=private-git-repo.com/my-git-repo.git \
  --user=myusername \
  --pass=mypassword \
  --git-branch=~7.1 \
  --deploy-method=git \
  --path=/var/www/html/deployment \ 
  --post=command="npm install" \
  --post-command="npm audit" \
  --shared-folder=foo
  --shared-folder=bar
  --shared-file="config/local.yaml"
```

Windows:
```powershell
node.exe .\deploy --git-repo=private-git-repo.com/my-git-repo.git `
  --user=myusername `
  --pass=mypassword `
  --git-branch=master `
  --deploy-method=git `
  --post=command="npm install" `
  --post-command="npm audit" `
  --shared-folder=foo `
  --shared-file="config\local.yaml" `
  --path="C:\apache\htdocs\deployment" `
  --post=command="npm install"
```