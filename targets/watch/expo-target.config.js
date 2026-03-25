/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "watch",
  displayName: "Chrona Watch",
  entitlements: {
    "com.apple.security.application-groups": [
      `group.${config.ios.bundleIdentifier}`,
    ],
  },
  frameworks: ["WatchConnectivity"],
});
