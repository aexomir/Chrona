/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  displayName: "Chrona Time",
  icon: "./Assets.xcassets/WidgetIcon.imageset/icon.png",
  entitlements: {
    "com.apple.security.application-groups": [
      `group.${config.ios.bundleIdentifier}`,
    ],
  },
  frameworks: ["SwiftUI", "ActivityKit"],
});
