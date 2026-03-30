// afterSign hook — notarizes the macOS app with Apple
// Requires env vars: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID
// Or a stored keychain profile: APPLE_KEYCHAIN_PROFILE

const { notarize } = require("@electron/notarize");

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  // Only notarize macOS builds
  if (electronPlatformName !== "darwin") {
    return;
  }

  // Skip if no credentials are set
  const appleId = process.env.APPLE_ID;
  const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID || "X3H9P4VWQ7";
  const keychainProfile = process.env.APPLE_KEYCHAIN_PROFILE || "StepScribe";

  if (!keychainProfile && (!appleId || !applePassword)) {
    console.log("⚠ Skipping notarization — set APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD or APPLE_KEYCHAIN_PROFILE");
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`🔏 Notarizing ${appName}...`);

  const notarizeArgs = {
    appPath,
    tool: "notarytool",
  };

  if (keychainProfile) {
    notarizeArgs.keychainProfile = keychainProfile;
  } else {
    notarizeArgs.appleId = appleId;
    notarizeArgs.appleIdPassword = applePassword;
    notarizeArgs.teamId = teamId;
  }

  await notarize(notarizeArgs);

  console.log(`✅ Notarization complete for ${appName}`);
};
