/* *************************************************************************************************
 main.ts
   © 2019-2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import * as core from '@actions/core';
import * as fs from 'fs/promises';
import * as path from 'path';

import {
  defaultSwiftPackageDirectory,
  run,
  prepareDirectory,
} from './common.js'
import { SwiftInstaller } from './swift-installer.js';
import { Swiftenv } from './swift-installer-swiftenv.js';

const inputSwiftVersion: string = core.getInput('swift-version');
const inputSwiftPackageDirectory: string = ((packageDirectory: string): string => {
  if (path.isAbsolute(packageDirectory)) {
    return packageDirectory;
  }
  return path.normalize(path.resolve(packageDirectory));
})(core.getInput('swift-package-directory') || defaultSwiftPackageDirectory);


const swiftVersion: () => Promise<string> = (function () {
  let _swift_version: string | undefined = void(0);
  return async (): Promise<string> => {
    if (typeof _swift_version != "undefined") {
      return _swift_version;
    }

    if (inputSwiftVersion) {
      _swift_version = inputSwiftVersion;
      return inputSwiftVersion;
    }

    const __checkSwiftVerionFile = async (dirPath: string): Promise<string | undefined> => {
      const swiftVerionFilePath = path.join(dirPath, '.swift-version');
      return await run(`Read content of the file at "${swiftVerionFilePath}".`, async () => {
        let fh: fs.FileHandle | undefined;
        let content: string | undefined;
        try {
          fh = await fs.open(swiftVerionFilePath);
          content = (await fh.readFile("utf8")).trim();
          if (content) {
            core.info(`Swift version ${content} will be used.`);
          }
        } catch (error: unknown) {
          core.debug(String(error));
        } finally {
          await fh?.close();
        }
        return content;
      });
    }

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

function swiftInstaller(version: string): SwiftInstaller {
  return new Swiftenv(version);
}

async function main(): Promise<void> {
  await prepareDirectory();
  const detectedSwiftVersion = await swiftVersion();
  const installer = swiftInstaller(detectedSwiftVersion);
  await installer.setUp();
  await installer.installSwift();
  await installer.switchSwift();
  await installer.finalize();
}

main().catch((error: unknown) => { core.setFailed(String(error)); })
