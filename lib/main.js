/* *************************************************************************************************
 main.ts
   © 2019-2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as common from './common.js';
const nil = common.nil;
import { XcodeInfo } from './xcode.js';
import { Swiftenv } from './swift-installer-swiftenv.js';
import { Swiftly } from './swift-installer-swiftly.js';
import { PreinstalledXcode } from './swift-installer-preinstalled-xcode.js';
const inputSwiftInstaller = core.getInput("swift-installer") || common.defaultSwiftInstaller;
const inputSwiftVersion = core.getInput('swift-version');
const inputSwiftPackageDirectory = ((packageDirectory) => {
    if (path.isAbsolute(packageDirectory)) {
        return packageDirectory;
    }
    return path.normalize(path.resolve(packageDirectory));
})(core.getInput('swift-package-directory') || common.defaultSwiftPackageDirectory);
async function prepareDirectory() {
    await common.exec('Prepare working directory', 'mkdir', ['-p', common.workingDirectory]);
}
const swiftVersion = (function () {
    let _swift_version = nil;
    return async () => {
        return navigator.locks.request("main.swiftVersion", async () => {
            if (typeof _swift_version != "undefined") {
                return _swift_version;
            }
            if (inputSwiftVersion) {
                await common.info(`Swift version ${inputSwiftVersion} (passed via input) will be used.`);
                _swift_version = inputSwiftVersion;
                return inputSwiftVersion;
            }
            const __checkSwiftVerionFile = async (dirPath) => {
                const swiftVerionFilePath = path.join(dirPath, '.swift-version');
                await common.info(`Read content of the file at "${swiftVerionFilePath}".`);
                let fh;
                let content;
                try {
                    fh = await fs.open(swiftVerionFilePath);
                    content = (await fh.readFile("utf8")).trim();
                    if (content) {
                        await common.info(`Swift version ${content} will be used.`);
                    }
                }
                catch (error) {
                    core.debug(String(error));
                }
                finally {
                    await fh?.close();
                }
                return content;
            };
            let currentDirectoryForSwiftVersion = inputSwiftPackageDirectory;
            while (currentDirectoryForSwiftVersion && currentDirectoryForSwiftVersion != "/") {
                const swiftVersionFileContent = await __checkSwiftVerionFile(currentDirectoryForSwiftVersion);
                if (typeof swiftVersionFileContent != "undefined") {
                    _swift_version = swiftVersionFileContent;
                    return swiftVersionFileContent;
                }
                currentDirectoryForSwiftVersion = path.dirname(currentDirectoryForSwiftVersion);
            }
            throw Error("Swift version is not specified.");
        });
    };
})();
/**
 * @param version - Swift version
 */
async function swiftInstaller(version) {
    const properXcode = await XcodeInfo.forSwift(version);
    if (properXcode instanceof XcodeInfo) {
        await common.info(`Preinstalled Swift will be used in Xcode at ${properXcode.path}`);
        return new PreinstalledXcode(version, properXcode);
    }
    switch (inputSwiftInstaller.toLocaleLowerCase()) {
        case "swiftenv":
            await common.info(`swiftenv will be used to install Swift ${version}.`);
            return new Swiftenv(version);
        case "swiftly":
            await common.info(`swiftly will be used to install Swift ${version}.`);
            return new Swiftly(version);
        default:
            throw new Error(`Unexpected installer name: ${inputSwiftInstaller}`);
    }
}
async function main() {
    await core.group("Preparing Working Directory", prepareDirectory);
    const detectedSwiftVersion = await core.group("Detecting Swift Version", swiftVersion);
    const installer = await core.group("Selecting Swift Installer", async () => await swiftInstaller(detectedSwiftVersion));
    await core.group("Setting Up Installer", async () => installer.setUp());
    await core.group("Installing Swift", async () => installer.installSwift());
    await core.group("Switching Swift", async () => installer.switchSwift());
    await core.group("Finalizing Installer", async () => installer.finalize());
}
main().catch((error) => {
    core.setFailed((error instanceof Error) ? error : String(error));
});
