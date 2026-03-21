/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "watch",
  displayName: "Focus Watch",
  entitlements: {
    "com.apple.security.application-groups": [
      `group.${config.ios.bundleIdentifier}`,
    ],
  },
  frameworks: ["WatchConnectivity"],
});
