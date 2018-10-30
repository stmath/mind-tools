**Overview**

This package should be run in a mind-game root directory in other to perform the following actions:
	- Build asset based on mind.assets in package.json.
	- Creates a bundle of the game based on --name parameter or mind.name field in package.json and the current version (+1) of the git branch.
	- Creates a manifest file for the new bundle.
	- Upload the bundle and manifest to the global repo: bucket/folder/game_name/version/.
	- If nothing fails, tag the git branch with the new version.

# Requirements.
Make sure to have the appropiate credentials for your AWS account, and a configuration entry for that account. E.g:

```shell
	$ cat .aws/credentials
	[mri-gc-account]
	aws_access_key_id=<YOUR KEY ID>
	aws_secret_access_key=<YOUR SECRET KEY>

	$ cat .aws/config
	[mri-gc-account]
	region=<REGION>
	output=json
```

# Installation

## For using the tool

### 1. Directly

1. Configure bitbucket authentication.

 ***On windows***
	Make sure you have correctly configured the bitbucket credentials for git since npm is assuming a public repo, so there is no prompt for user password.
	The latest version of git seems to ignore the credentials stored in Windows Credential Manager, the only way to workaround this is by ejecuting the git tool:
 ```shell
    > git config --global credential.helper wincred
	> <Perform any task that required authentication>, like git pull or push.
 ```

***On Linux***
You can use a file or memory to (permanent/temporarily) store credentials.

```shell
    $ git config --global credential.helper 'cache --timeout 12600'
	$ <Perform any task that required authentication>, like pull or push.
 ```

 or

```shell
    $ git config --global credential.helper 'store --file ~/.mind-credentials'
	$ <Perform any task that requires authentication>, like pull or push.
 ```

*** on MacOSX ***

osxkeychain operates in a similar fashion to "cache" and "store" helpers on linux.

2. Install

```shell
    $ npm install -g git+https://bitbucket.mindresearch.org/scm/stm/mind-tools.git
```

### 2. Cloning the repo.

  ```shell
    $ git clone https://bitbucket.mindresearch.org/scm/stm/mind-tools.git
	$ npm install
	$ npm link # this includes npm run build.
  ```

## Updating.

If already linked, just rebuild the package and, if needed, fix permissions.
```shell
	$ node run build
	$ chmod +x ~/.node_modules/bin/mindbuild # Only on linux/mac
```

## For debugging.

npm link runs the install scripts, wich makes a npm run build. You can just run npm run build-dev, so sources.map files are created.

```shell
	$ npm run build-dev
	$ chmod +x ~/.node_modules/bin/mindbuild # If needed (only on linux/mac), fix permissions.
```

# Using it.

Just execute mindbuild in the root of any mind game. e.g LargeNumComparison.

```shell
	$ mindbuild --name LargeNumComparison
```
 ## Options:

 The package.json in the root folder should include a field for the directory containing the source file for bundling.

```javascript
	{
		"jspm": {
			...
			"directories": {
				"lib": "PixiArenas"
			}
			...
		}
		...
	}

```

Optionally other fields can be added:

```javascript
{
	"jspm": {
		...
		"directories": {
			"lib": "PixiArenas"
		}
		...
	},
	"mind": {
		"name": "LargeNumComparison"			// Game name if --name parameter is not given.
		"aws": {
			"s3folder": "rmiller-test/pilot" 	// default is pilot/arenas
			"s3bucket": "mri-game-conversion"	// default
		},
		"bundle-assets": {
			"assets": [							// Asset directories.
				"assets/ExampleGame/locale/*",
				"assets/shapes/*"
			]
			"output": "assets/ExampleGame.tar",	// Assets output

		}
	}
}

```
