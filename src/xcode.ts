import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as semver from 'semver'
import SemVer = semver.SemVer

export class XcodeInfo {
  readonly path: string
  private _version: SemVer | null = null
  private _swiftVersion: string | null = null

  constructor(path: string) {
    this.path = path
  }

  async version(): Promise<SemVer> {
    if (!this._version) {
      let versionString = ''
      await exec.exec('defaults', ['read', `${this.path}/Contents/Info`, 'CFBundleShortVersionString'], {
        listeners: {
          stdout: (data: Buffer) => { versionString = data.toString().trim() }
        }
      })
      if ((/^\d+\.\d+$/).test(versionString)) { versionString += '.0'; }
      let ver = semver.parse(versionString)
      if (ver == null) {
        throw "Invalid Version String."
      }
      this._version = ver
    }
    return this._version as SemVer
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