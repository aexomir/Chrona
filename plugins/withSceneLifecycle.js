const fs = require("fs");
const path = require("path");
const {
  IOSConfig,
  withAppDelegate,
  withInfoPlist,
  withXcodeProject,
} = require("expo/config-plugins");

// Apps built with the iOS 27 SDK refuse to launch unless they adopt the UIScene
// life cycle. expo@57.0.28 ships ExpoAppSceneDelegate for this, but the SDK 57
// prebuild template still creates the window in AppDelegate. This applies what
// the SDK 58 template does; remove it when moving to SDK 58.

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {}
`;

const APP_DELEGATE_CLASS = "class AppDelegate: ExpoAppDelegate {";
const WINDOW_SETUP = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

function withSceneManifest(config) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return mod;
  });
}

// The scene delegate now creates the window and starts React Native.
function withSceneAppDelegate(config) {
  return withAppDelegate(config, (mod) => {
    const source = mod.modResults.contents;
    if (source.includes("ExpoReactNativeFactoryProvider")) return mod;
    if (!source.includes(APP_DELEGATE_CLASS) || !WINDOW_SETUP.test(source)) {
      throw new Error(
        "withSceneLifecycle: AppDelegate.swift no longer matches the SDK 57 template. " +
          "Update the plugin, or drop it if the template now adopts UIScene.",
      );
    }
    mod.modResults.contents = source
      .replace(APP_DELEGATE_CLASS, "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {")
      .replace(WINDOW_SETUP, "");
    return mod;
  });
}

function withSceneDelegateFile(config) {
  return withXcodeProject(config, (mod) => {
    const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
    fs.writeFileSync(
      path.join(mod.modRequest.platformProjectRoot, projectName, "SceneDelegate.swift"),
      SCENE_DELEGATE,
    );
    IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
      filepath: `${projectName}/SceneDelegate.swift`,
      groupName: projectName,
      project: mod.modResults,
    });
    return mod;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneDelegateFile(withSceneAppDelegate(withSceneManifest(config)));
};
