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
import { XcodeInfo } from './xcode.js';
import { Swiftenv } from './swift-installer-swiftenv.js';
import { PreinstalledXcode } from './swift-installer-preinstalled-xcode.js';
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
    let _swift_version = void (0);
    return async () => {
        if (typeof _swift_version != "undefined") {
            return _swift_version;
        }
        if (inputSwiftVersion) {
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
    await common.info(`swiftenv will be used to install Swift ${version}.`);
    return new Swiftenv(version);
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
main().catch((error) => { core.setFailed(String(error)); });
