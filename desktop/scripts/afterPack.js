// afterPack hook — ad-hoc codesign macOS .app if no identity is configured.
// Apple Silicon requires at least ad-hoc signing, otherwise macOS flags the app as "damaged".
const { execSync } = require("child_process");
const path = require("path");

exports.default = async function afterPack(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // Check if a real identity is configured (skip ad-hoc if so)
  const identity = process.env.CSC_LINK || process.env.CSC_NAME;
  if (identity) {
    console.log("ℹ Real signing identity found, skipping ad-hoc sign");
    return;
  }

  console.log(`🔏 Ad-hoc signing ${appPath} for Apple Silicon compatibility...`);
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: "inherit" });
    console.log("✅ Ad-hoc signing complete");
  } catch (err) {
    console.warn("⚠ Ad-hoc signing failed (app may show 'damaged' on ARM Macs):", err.message);
  }
};
