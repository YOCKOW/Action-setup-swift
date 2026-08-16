/* *************************************************************************************************
 xcode.ts
   © 2019-2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as semver from 'semver'
import SemVer = semver.SemVer
import {
  execRun,
  run,
} from './common.js';
export class XcodeInfo {
  readonly path: string
  private _version: SemVer | null = null
  private _swiftVersion: string | null = null

  constructor(path: string) {
    this.path = path
  }

  public isEqualTo(other: XcodeInfo): boolean {
    return this.path == other.path;
  }

  private async _readDefaultsForKey(key: string): Promise<string> {
    const result = await execRun(
      `Xcode: Reading defaults for ${key}...`,
      'defaults',
      ['read', `${this.path}/Contents/Info`, key]
    );
    return result.stdout.trim();
  }

  async version(): Promise<SemVer> {
    if (!this._version) {
      let versionString = await this._readDefaultsForKey('CFBundleShortVersionString');
      if ((/^\d+\.\d+$/).test(versionString)) {
        versionString += '.0';
      }
      let ver = semver.parse(versionString);
      if (ver == null) {
        throw "Invalid Version String."
      }
      this._version = ver;
      return ver;
    }
    return this._version;
  }

  async swiftVersion(): Promise<string> {
    if (!this._swiftVersion) {
      let swiftVersionString = ''
      await exec.exec('xcrun', ['swift', '--version'], {
        env: {
          'DEVELOPER_DIR': this.path,
        },
        listeners: {
          stdout: (data: Buffer) => { swiftVersionString = data.toString().trim(); }
        }
      });
      const result = (new RegExp('Swift version (\\d+(?:\\.\\d+)+)')).exec(swiftVersionString)
      if (!result) {
        throw Error(`Swift version cannot be detected for ${this.path}.`)
      }
      this._swiftVersion = result[1]
      core.info(`Swift version is ${this._swiftVersion} for Xcode at ${this.path}`)
    }
    return this._swiftVersion as string
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
    if (XcodeInfo._betaRegex.test(this.binDirectory)) {
      return true;
    }

    const iconFile = await this._readDefaultsForKey('CFBundleIconFile');
    if ((/beta/i).test(iconFile)) {
      return true;
    }

    const iconName = await this._readDefaultsForKey('CFBundleIconName');
    if ((/beta/i).test(iconName)) {
      return true;
    }

    return false;
  } 

  public async equivalentReleaseVersion(): Promise<XcodeInfo | null> {
    if (!this.isBeta) {
      return this;
    }

    core.info(`Xcode at '${this.path}' is beta version.`);
    const expectedSwiftVersion = await this.swiftVersion();

    const betaRegexResult = XcodeInfo._betaRegex.exec(this.binDirectory);
    if (betaRegexResult) {
      const expectedReleaseVersion = await new XcodeInfo(betaRegexResult[0]).version();
      const expectedReleasePath = betaRegexResult[1] + '.app';
      const expectedReleaseXcode = new XcodeInfo(expectedReleasePath);
      if (expectedSwiftVersion == await expectedReleaseXcode.swiftVersion().catch()) {
        core.info(`Xcode release version is found.`);
        return expectedReleaseXcode;
      }

      const xcodes = Array.from((await allInstalledXcodeApplications()).values())
      for (let xcodeInfo of xcodes) {
        if (
          semver.eq(await xcodeInfo.version(), expectedReleaseVersion) &&
          expectedSwiftVersion == await xcodeInfo.swiftVersion()
        ) {
          core.info(`Xcode release version is found.`)
          return xcodeInfo;
        }
      }
    } else {
      const xcodes = Array.from((await allInstalledXcodeApplications()).values())
      for (let xcodeInfo of xcodes) {
        if (xcodeInfo.isEqualTo(this)) {
          continue;
        }

        if (expectedSwiftVersion == await xcodeInfo.swiftVersion()) {
          core.info(`Xcode release version is found.`)
          return xcodeInfo;
        }
      }
    }

    return null;
  }

  public async activateDeveloperDirectory(): Promise<void> {
    const developerDirectory = this.developerDirectory;
    await execRun(
      `Switch Developer Directory to ${developerDirectory}`,
      'sudo xcode-select',
      ['-switch', developerDirectory]
    );
  }
}

let _installedXcodeApplicationsUnderApplicationsDirectory: Map<string, XcodeInfo> = new Map()
export async function installedXcodeApplicationsUnderApplicationsDirectory(): Promise<Map<string, XcodeInfo>> {
  if (os.platform() == 'darwin' && _installedXcodeApplicationsUnderApplicationsDirectory.size < 1) {
    const dirents = fs.readdirSync('/Applications', {withFileTypes: true})
    for (const dirent of dirents) {
      if (dirent.isDirectory() && (/^Xcode([^/])*.app/).test(dirent.name)) {
        const xcodePath = path.join('/Applications', dirent.name)
        const xcodeInfo = new XcodeInfo(xcodePath)
        _installedXcodeApplicationsUnderApplicationsDirectory.set(xcodePath, xcodeInfo)
      }
    }
  }
  return _installedXcodeApplicationsUnderApplicationsDirectory
}


let _allInstalledXcodeApplications: Map<string, XcodeInfo> = new Map()
export async function allInstalledXcodeApplications(): Promise<Map<string, XcodeInfo>> {
  if (os.platform() == 'darwin' && _allInstalledXcodeApplications.size < 1) {
    let paths: string[] = [];
    await exec.exec('mdfind', ['kMDItemCFBundleIdentifier == "com.apple.dt.Xcode"'], {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          paths = data.toString().split(/\r\n|\r|\n/).map(path => path.trim()).filter(path => path != '');
        }
      }
    })
    for (const xcodePath of paths) {
      _allInstalledXcodeApplications.set(xcodePath, new XcodeInfo(xcodePath))
    }
  }
  return _allInstalledXcodeApplications
}

export async function latestXcode(): Promise<XcodeInfo> {
  const list = await allInstalledXcodeApplications();
  let latest: XcodeInfo | null = null;
  for (const info of Array.from(list.values())) {
    if (!latest || semver.gt(await info.version(), await latest.version())) {
      latest = info;
    }
  }
  if (latest == null) {
    throw "Cant't detect latest Xcode."
  }
  return latest;
}

export interface XcodeInApplicationsDirectory {
  xcodeInfo: XcodeInfo
};
export type SwiftPath = "not_found" | XcodeInApplicationsDirectory;

export const swiftPath: (version: string) => Promise<SwiftPath> = (function () {
  const _swiftPaths: Map<string, SwiftPath | null> = new Map();
  return async (version: string): Promise<SwiftPath> => {
    if (!_swiftPaths.has(version)) {
      _swiftPaths.set(version, "not_found");
      await run('Check whether or not Swift ' + version + ' is already installed.', async () => {
        // Avoid calling `mdfind` if possible
        const xcodeInAppDirMap = await installedXcodeApplicationsUnderApplicationsDirectory();
        const xcodesInAppDir = Array.from(xcodeInAppDirMap.values())
        for (const xcodeInfo of xcodesInAppDir.reverse()) {
          if (await xcodeInfo.swiftVersion() == version) {
            _swiftPaths.set(version, { xcodeInfo: xcodeInfo });
            return;
          }
        }

        const allXcodesMap = await allInstalledXcodeApplications();
        const allXcodes = Array.from(allXcodesMap.values());
        for (const xcodeInfo of allXcodes) {
          if (!xcodeInAppDirMap.has(xcodeInfo.path)) {
            if (await xcodeInfo.swiftVersion() == version) {
              _swiftPaths.set(version, { xcodeInfo: xcodeInfo });
              return;
            }
          }
        }
      });
    }
    return _swiftPaths.get(version) as SwiftPath;
  }
})();
