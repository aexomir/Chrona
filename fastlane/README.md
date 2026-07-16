fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios bump_build_number

```sh
[bundle exec] fastlane ios bump_build_number
```

Bump the iOS build number in app.json

### ios screenshots

```sh
[bundle exec] fastlane ios screenshots
```

Capture and frame the iOS release screenshots

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Bump the build number, build with EAS, and submit to TestFlight

----


## Android

### android bump_build_number

```sh
[bundle exec] fastlane android bump_build_number
```

Bump the Android version code in app.json

### android screenshots

```sh
[bundle exec] fastlane android screenshots
```

Capture the Android release screenshots

### android beta

```sh
[bundle exec] fastlane android beta
```

Bump the version code, build with EAS, and submit to the Play Store

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).
