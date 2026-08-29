const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Final native-level guard for Android landscape-only scoring workspaces.
 * The expo-screen-orientation plugin supplies the standard configuration;
 * this plugin verifies the generated MainActivity cannot be emitted without
 * the required activity orientation, even if another config plugin changes it.
 */
function withAndroidLandscape(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    const activities = application?.activity ?? [];
    const mainActivity =
      activities.find((activity) => activity.$?.["android:name"] === ".MainActivity") ?? activities[0];

    if (!mainActivity?.$) {
      throw new Error("Android MainActivity 不存在，無法套用強制橫式設定。");
    }

    mainActivity.$["android:screenOrientation"] = "landscape";

    const existingChanges = String(mainActivity.$["android:configChanges"] ?? "")
      .split("|")
      .filter(Boolean);
    const requiredChanges = ["keyboard", "keyboardHidden", "orientation", "screenSize", "screenLayout", "uiMode"];
    mainActivity.$["android:configChanges"] = Array.from(new Set([...existingChanges, ...requiredChanges])).join("|");

    return androidConfig;
  });
}

module.exports = withAndroidLandscape;
