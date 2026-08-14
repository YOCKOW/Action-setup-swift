/* *************************************************************************************************
 main.ts
   © 2019-2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { defaultSwiftPackageDirectory, run, prepareDirectory, } from './common.js';
import { Swiftenv } from './swift-installer-swiftenv.js';
const inputSwiftVersion = core.getInput('swift-version');
const inputSwiftPackageDirectory = ((packageDirectory) => {
    if (path.isAbsolute(packageDirectory)) {
        return packageDirectory;
    }
    return path.normalize(path.resolve(packageDirectory));
})(core.getInput('swift-package-directory') || defaultSwiftPackageDirectory);
const swiftVersion = (function () {
    let _swift_version = void (0);
    return async () => {
        if (_swift_version) {
            return _swift_version;
        }
        if (inputSwiftVersion) {
            _swift_version = inputSwiftVersion;
            return inputSwiftVersion;
        }
        const __checkSwiftVerionFile = async (dirPath) => {
            const swiftVerionFilePath = path.join(dirPath, '.swift-version');
            return await run(`Read content of the file at "${swiftVerionFilePath}".`, async () => {
                let fh;
                let content;
                try {
                    fh = await fs.open(swiftVerionFilePath);
                    content = (await fh.readFile("utf8")).trim();
                    if (content) {
                        core.info(`Swift version ${content} will be used.`);
                    }
                }
                catch (error) {
                    core.debug(String(error));
                }
                finally {
                    fh?.close();
                }
                return content;
            });
        };
        let currentDirectoryForSwiftVersion = inputSwiftPackageDirectory;
        while (currentDirectoryForSwiftVersion && currentDirectoryForSwiftVersion != "/") {
            const swiftVersionFileContent = await __checkSwiftVerionFile(currentDirectoryForSwiftVersion);
            if (swiftVersionFileContent) {
                _swift_version = swiftVersionFileContent;
                return swiftVersionFileContent;
            }
            currentDirectoryForSwiftVersion = path.dirname(currentDirectoryForSwiftVersion);
        }
        throw Error("Swift version is not specified.");
    };
})();
function swiftInstaller() {
    return Swiftenv.shared;
}
async function main() {
    await prepareDirectory();
    const detectedSwiftVersion = await swiftVersion();
    const installer = swiftInstaller();
    await installer.setUp();
    await installer.installSwift(detectedSwiftVersion);
    await installer.switchSwift(detectedSwiftVersion);
    await installer.finalize(detectedSwiftVersion);
}
main().catch(error => { core.setFailed(error.message); });
