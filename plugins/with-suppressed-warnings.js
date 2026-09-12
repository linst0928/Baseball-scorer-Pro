const { withProjectBuildGradle } = require("@expo/config-plugins");

/**
 * Expo Config Plugin to suppress Java compiler warnings (unchecked and deprecation)
 * in all subprojects/modules (e.g., third-party node_modules packages).
 */
function withSuppressedWarnings(config) {
  return withProjectBuildGradle(config, (gradleConfig) => {
    let contents = gradleConfig.modResults.contents;

    const suppressionBlock = `
allprojects {
    tasks.withType(JavaCompile) {
        options.compilerArgs << "-Xlint:-unchecked" << "-Xlint:-deprecation"
    }
}
`;

    // Only append if it's not already present
    if (!contents.includes("-Xlint:-unchecked")) {
      contents += suppressionBlock;
    }

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
}

module.exports = withSuppressedWarnings;
