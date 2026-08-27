/* *************************************************************************************************
 xcode.ts
   © 2019-2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import SemVer = semver.SemVer;
import {
  isUndefined,
  exec,
  extractSwiftVersionFromCommandOutput,
  info,
  nil,
  Optional,
  osIsDarwin,
} from './common.js';

export type XcodePath = string;
export class XcodeInfo {
  readonly path: XcodePath;
  private _version: SemVer | null = null
  private _swiftVersion: string | null = null

  private constructor(path: string) {
    this.path = path
  }

  private static _instances: Map<string /* path */, XcodeInfo> = new Map();
  static async forPath(path: string): Promise<XcodeInfo> {
    return await navigator.locks.request("XcodeInfo.forPath", (): XcodeInfo => {
      const instance = this._instances.get(path);
      if (!isUndefined(instance)) {
        return instance;
      }
      const newInstance = new XcodeInfo(path);
      this._instances.set(path, newInstance);
      return newInstance;
    });
  }

  public isEqualTo(other: XcodeInfo): boolean {
    return this.path == other.path;
  }

  private async _readDefaultsForKey(key: string): Promise<string> {
    const result = await exec(
      `Xcode: Read defaults for ${key}`,
      'defaults',
      ['read', `${this.path}/Contents/Info`, key]
    );
    return result.stdout.trim();
  }

  async version(): Promise<SemVer> {
    return await navigator.locks.request(`XcodeInfo.version.${this.path}`, async (): Promise<SemVer> => {
      if (!this._version) {
        let versionString = await this._readDefaultsForKey('CFBundleShortVersionString');
        if ((/^\d+\.\d+$/).test(versionString)) {
          versionString += '.0';
        }
        const parsedVersion = semver.parse(versionString);
        if (parsedVersion == null) {
          throw new Error("Invalid Version String.");
        }
        this._version = parsedVersion;
        return parsedVersion;
      }
      return this._version;
    });
  }

  async swiftVersion(): Promise<string> {
    return await navigator.locks.request(`XcodeInfo.swiftVersion.${this.path}`, async (): Promise<string> => {
      if (typeof this._swiftVersion != "string") {
        const swiftVersionResult = await exec(
          'xcrun',
          ['swift', '--version'],
          {
            env: {
              'DEVELOPER_DIR': this.path,
            }
          }
        );
        const swiftVersionString = swiftVersionResult.stdout.trim();
        const swiftVersion = extractSwiftVersionFromCommandOutput(swiftVersionString);
        if (isUndefined(swiftVersion)) {
          throw Error(`Swift version cannot be detected for ${this.path}.`)
        }
        this._swiftVersion = swiftVersion;
        await info(`Swift version is ${swiftVersion} for Xcode at ${this.path}`)
      }
      return this._swiftVersion;
    });
  }

  get developerDirectory(): string {
    return path.join(this.path, '/Contents/Developer');
  }

  get toolchainDirectory(): string {
    return path.join(this.developerDirectory, '/Toolchains/XcodeDefault.xctoolchain');
  }

  get binDirectory(): string {
    return path.join(this.toolchainDirectory, '/usr/bin');
  }

  get swiftPath(): string {
    return path.join(this.binDirectory, 'swift');
  }

  private static readonly _betaRegex = new RegExp('^(/.+/Xcode[^/]*)_beta.app');

  /** @returns `true` if Xcode _may be_ beta. */
  public async isBeta(): Promise<boolean> {
    // FIXME: There should be more appropriate way...
    if (XcodeInfo._betaRegex.test(this.path)) {
      await info(`The path to this Xcode contains "beta": ${this.path}`);
      return true;
    }

    const iconFile = await this._readDefaultsForKey('CFBundleIconFile');
    if ((/beta/i).test(iconFile)) {
      await info(`The value of 'CFBundleIconFile' contains "beta": ${iconFile} (Xcode path: ${this.path})`);
      return true;
    }

    const iconName = await this._readDefaultsForKey('CFBundleIconName');
    if ((/beta/i).test(iconName)) {
      await info(`The value of 'CFBundleIconName' contains "beta": ${iconName} (Xcode path: ${this.path})`);
      return true;
    }

    return false;
  } 

  public async equivalentReleaseVersion(): Promise<XcodeInfo | null> {
    if (!(await this.isBeta())) {
      return this;
    }

    await info(`Xcode at '${this.path}' is beta version.`);
    const expectedSwiftVersion = await this.swiftVersion();

    const betaRegexResult = XcodeInfo._betaRegex.exec(this.path);
    if (betaRegexResult) {
      core.debug("`betaRegexResult`: " + betaRegexResult.toString());

      const expectedReleaseVersion = await new XcodeInfo(betaRegexResult[0]).version();
      const expectedReleasePath = betaRegexResult[1] + '.app';
      const expectedReleaseXcode = new XcodeInfo(expectedReleasePath);
      if (expectedSwiftVersion == await expectedReleaseXcode.swiftVersion().catch()) {
        await info(`Xcode release version is found.`);
        return expectedReleaseXcode;
      }

      const xcodes = Array.from((await XcodeInfo.all()).values())
      for (const xcodeInfo of xcodes) {
        if (
          semver.eq(await xcodeInfo.version(), expectedReleaseVersion) &&
          expectedSwiftVersion == await xcodeInfo.swiftVersion()
        ) {
          await info(`Xcode release version is found.`)
          return xcodeInfo;
        }
      }
    } else {
      const xcodes = Array.from((await XcodeInfo.all()).values())
      for (const xcodeInfo of xcodes) {
        if (xcodeInfo.isEqualTo(this)) {
          continue;
        }

        if (expectedSwiftVersion == await xcodeInfo.swiftVersion()) {
          await info(`Xcode release version is found.`)
          return xcodeInfo;
        }
      }
    }

    return null;
  }

  public async activateDeveloperDirectory(): Promise<void> {
    const developerDirectory = this.developerDirectory;
    await exec(
      `Switch Developer Directory to ${developerDirectory}`,
      'sudo xcode-select',
      ['-switch', developerDirectory]
    );
  }

  public async setSDKRootEnvironmentVariable(): Promise<void> {
    const sdkRootResult = await exec(
      'Set SDKROOT environment variable',
      'xcrun',
      ['--sdk', 'macosx', '--show-sdk-path'],
    );
    core.exportVariable('SDKROOT', sdkRootResult.stdout.trim());
  }

  public async activate(): Promise<void> {
    await Promise.all([
      this.activateDeveloperDirectory(),
      this.setSDKRootEnvironmentVariable(),
    ])
  }
}

export declare namespace XcodeInfo {
  export function installedUnderApplicationsDirectory(): Promise<ReadonlyMap<XcodePath, XcodeInfo>>;
  export function all(): Promise<ReadonlyMap<XcodePath, XcodeInfo>>;
  export function latest(): Promise<XcodeInfo>;
  export function forSwift(version: string): Promise<XcodeInfo | null>;
}

XcodeInfo.installedUnderApplicationsDirectory = (() => {
  let installedXcodeApplicationsUnderApplicationsDirectory: Optional<Map<XcodePath, XcodeInfo>> = nil;
  return async (): Promise<ReadonlyMap<XcodePath, XcodeInfo>> => {
    return await navigator.locks.request("XcodeInfo.installedUnderApplicationsDirectory", async () => {
      if (typeof installedXcodeApplicationsUnderApplicationsDirectory != "undefined") {
        return installedXcodeApplicationsUnderApplicationsDirectory;
      }

      if (!osIsDarwin) {
        const emptyMap = new Map<XcodePath, XcodeInfo>();
        installedXcodeApplicationsUnderApplicationsDirectory = emptyMap;
        return emptyMap;
      }

      const result = new Map<XcodePath,XcodeInfo>();
      const dirEntries = fs.readdirSync('/Applications', {withFileTypes: true});
      for (const entry of dirEntries) {
        if (entry.isDirectory() && (/^Xcode([^/])*.app/).test(entry.name)) {
          const xcodePath = path.join('/Applications', entry.name);
          const xcodeInfo = await XcodeInfo.forPath(xcodePath);
          result.set(xcodePath, xcodeInfo);
        }
      }
      installedXcodeApplicationsUnderApplicationsDirectory = result;
      return result;
    });
  };
})();

XcodeInfo.all = (() => {
  let allXcodes: Optional<Map<XcodePath, XcodeInfo>> = nil;
  return async (): Promise<ReadonlyMap<XcodePath, XcodeInfo>> => {
    return await navigator.locks.request("XcodeInfo.all", async () => {
      if (typeof allXcodes != "undefined") {
        return allXcodes;
      }

      if (!osIsDarwin) {
        const emptyMap = new Map<XcodePath, XcodeInfo>();
        allXcodes = emptyMap;
        return emptyMap;
      }

      const result = new Map<XcodePath, XcodeInfo>();
      const commandResult = await exec(
        "Search all Xcode applications",
        'mdfind',
        ['kMDItemCFBundleIdentifier == "com.apple.dt.Xcode"'],
        { ignoreReturnCode: true }
      );
      const paths = commandResult.stdout.split(/\r\n|\r|\n/).map(path => path.trim()).filter(path => path != '');
      for (const path of paths) {
        result.set(path, await XcodeInfo.forPath(path));
      }
      allXcodes = result;
      return result;
    });
  };
})();

XcodeInfo.latest = (() => {
  let latestXcode: Optional<XcodeInfo> = nil;
  return async (): Promise<XcodeInfo> => {
    return await navigator.locks.request("XcodeInfo.latest", async () => {
      if (!osIsDarwin) {
        throw new Error("Called on non-Darwin?!");
      }

      if (typeof latestXcode != "undefined") {
        return latestXcode;
      }

      await info("Determining the latest Xcode...");
      const result = await (async (): Promise<XcodeInfo> => {
        let currentLatest: Optional<XcodeInfo> = nil;
        for (const info of Array.from((await XcodeInfo.all()).values())) {
          if (!currentLatest || semver.gt(await info.version(), await currentLatest.version())) {
            currentLatest = info;
          }
        }
        if (!currentLatest) {
          throw new Error("No Xcode.app?!");
        }
        return currentLatest;
      })();
      latestXcode = result;
      return result;
    });
  };
})()

XcodeInfo.forSwift = (() => {
  const swiftMap: Map<string /* Swift version */, XcodeInfo | null> = new Map();
  return async (version: string): Promise<XcodeInfo | null> => {
    return navigator.locks.request("XcodeInfo.forSwift", async () => {
      if (!osIsDarwin) {
        return null;
      }

      if (swiftMap.has(version)) {
        return swiftMap.get(version) || null;
      }

      await info('Check whether or not Swift ' + version + ' is already installed.');
      const foundXcode = await (async (): Promise<XcodeInfo | null> => {
        // Avoid calling `mdfind` if possible
        const xcodeInAppDirMap = await XcodeInfo.installedUnderApplicationsDirectory();
        const xcodesInAppDir = Array.from(xcodeInAppDirMap.values());
        for (const xcodeInfo of xcodesInAppDir.sort((x1, x2) => (x1.path > x2.path) ? -1 : 1 )) {
          if (await xcodeInfo.swiftVersion() == version) {
            return xcodeInfo;
          }
        }

        const allXcodesMap = await XcodeInfo.all();
        const allXcodes = Array.from(allXcodesMap.values());
        for (const xcodeInfo of allXcodes) {
          if (!xcodeInAppDirMap.has(xcodeInfo.path)) {
            if (await xcodeInfo.swiftVersion() == version) {
              return xcodeInfo;
            }
          }
        }

        return null;
      })();
      swiftMap.set(version, foundXcode);
      return foundXcode;
    });
  };
})();
