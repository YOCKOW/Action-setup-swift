/* *************************************************************************************************
 xcode.ts
   © 2019-2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as semver from 'semver';
import { run, } from './common.js';
export class XcodeInfo {
    path;
    _version = null;
    _swiftVersion = null;
    constructor(path) {
        this.path = path;
    }
    async version() {
        if (!this._version) {
            let versionString = '';
            await exec.exec('defaults', ['read', `${this.path}/Contents/Info`, 'CFBundleShortVersionString'], {
                listeners: {
                    stdout: (data) => { versionString = data.toString().trim(); }
                }
            });
            if ((/^\d+\.\d+$/).test(versionString)) {
                versionString += '.0';
            }
            let ver = semver.parse(versionString);
            if (ver == null) {
                throw "Invalid Version String.";
            }
            this._version = ver;
        }
        return this._version;
    }
    async swiftVersion() {
        if (!this._swiftVersion) {
            let swiftVersionString = '';
            await exec.exec('xcrun', ['swift', '--version'], {
                env: {
                    'DEVELOPER_DIR': this.path,
                },
                listeners: {
                    stdout: (data) => { swiftVersionString = data.toString().trim(); }
                }
            });
            const result = (new RegExp('Swift version (\\d+(?:\\.\\d+)+)')).exec(swiftVersionString);
            if (!result) {
                throw Error(`Swift version cannot be detected for ${this.path}.`);
            }
            this._swiftVersion = result[1];
            core.info(`Swift version is ${this._swiftVersion} for Xcode at ${this.path}`);
        }
        return this._swiftVersion;
    }
}
let _installedXcodeApplicationsUnderApplicationsDirectory = new Map();
export async function installedXcodeApplicationsUnderApplicationsDirectory() {
    if (os.platform() == 'darwin' && _installedXcodeApplicationsUnderApplicationsDirectory.size < 1) {
        const dirents = fs.readdirSync('/Applications', { withFileTypes: true });
        for (const dirent of dirents) {
            if (dirent.isDirectory() && (/^Xcode([^/])*.app/).test(dirent.name)) {
                const xcodePath = path.join('/Applications', dirent.name);
                const xcodeInfo = new XcodeInfo(xcodePath);
                _installedXcodeApplicationsUnderApplicationsDirectory.set(xcodePath, xcodeInfo);
            }
        }
    }
    return _installedXcodeApplicationsUnderApplicationsDirectory;
}
let _allInstalledXcodeApplications = new Map();
export async function allInstalledXcodeApplications() {
    if (os.platform() == 'darwin' && _allInstalledXcodeApplications.size < 1) {
        let paths = [];
        await exec.exec('mdfind', ['kMDItemCFBundleIdentifier == "com.apple.dt.Xcode"'], {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => {
                    paths = data.toString().split(/\r\n|\r|\n/).map(path => path.trim()).filter(path => path != '');
                }
            }
        });
        for (const xcodePath of paths) {
            _allInstalledXcodeApplications.set(xcodePath, new XcodeInfo(xcodePath));
        }
    }
    return _allInstalledXcodeApplications;
}
export async function latestXcode() {
    const list = await allInstalledXcodeApplications();
    let latest = null;
    for (const info of Array.from(list.values())) {
        if (!latest || semver.gt(await info.version(), await latest.version())) {
            latest = info;
        }
    }
    if (latest == null) {
        throw "Cant't detect latest Xcode.";
    }
    return latest;
}
;
export const swiftPath = (function () {
    const _swiftPaths = new Map();
    return async (version) => {
        if (!_swiftPaths.has(version)) {
            _swiftPaths.set(version, "not_found");
            await run('Check whether or not Swift ' + version + ' is already installed.', async () => {
                // Avoid calling `mdfind` if possible
                const xcodeInAppDirMap = await installedXcodeApplicationsUnderApplicationsDirectory();
                const xcodesInAppDir = Array.from(xcodeInAppDirMap.values());
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
        return _swiftPaths.get(version);
    };
})();
