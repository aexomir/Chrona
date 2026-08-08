const { withEntitlementsPlist } = require("expo/config-plugins");

// expo-widgets' withPushNotifications mod unconditionally sets
// `aps-environment: development` in the entitlements plist, even when
// `enablePushNotifications` is false (see node_modules/expo-widgets/plugin/src/ios/withPushNotifications.ts).
// Chrona doesn't use push notifications at all — Live Activities are
// started/updated locally from the app, not via remote push — so strip
// the stray entitlement rather than ship a `development` value that
// would need manual verification at every archive.
module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    return mod;
  });
};
