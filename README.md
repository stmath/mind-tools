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

Just execute mindbuild in the root of any mind game. By default this will get asset bundles, game bundle and game manifest files created under a new ./dist folder. The manifest will report the version number for this build by incrementing the biggest avilable tag for the repo.
```shell
	$ mindbuild
```

Adding a --tag flag will (after successful bundling) create and push a new tag with the version number written on the manifest. If the biggest tag number was N before running the command, the manifest will be created reporting its version is N+1, and the repo will be tagged with a tag being N+1
```shell
	$ mindbuild --tag
```

Adding a --upload flag will (after successful bundling) attempt to upload the artifacts to an s3 bucket. (This features needs to get updated to account for the new /dist folder).
```shell
	$ mindbuild --upload
```

Adding a --test flag will run automated test on the game, and skip tagging or uploading independently of the results of the test. The status code of the mindbuild command will be zero if no errors are found, or 1 if errors have been found.
```shell
	$ mindbuild --test
```


 ## Game specific Options:

 The package.json in the game's repository root folder has to include some information required by the building process 

 The lib directlry under the jspm section is required for bundling.
 In the "mind" section, the game name is mandatory and should be identical to the arena key.

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
		"name": "LargeNumComparison"			// Game name, mandatory
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
