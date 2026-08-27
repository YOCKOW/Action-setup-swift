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
import { isUndefined, exec, extractSwiftVersionFromCommandOutput, info, nil, osIsDarwin, } from './common.js';
export class XcodeInfo {
    path;
    _version = null;
    _swiftVersion = null;
    constructor(path) {
        this.path = path;
    }
    static _instances = new Map();
    static async forPath(path) {
        return await navigator.locks.request("XcodeInfo.forPath", () => {
            const instance = this._instances.get(path);
            if (!isUndefined(instance)) {
                return instance;
            }
            const newInstance = new XcodeInfo(path);
            this._instances.set(path, newInstance);
            return newInstance;
        });
    }
    isEqualTo(other) {
        return this.path == other.path;
    }
    async _readDefaultsForKey(key) {
        const result = await exec(`Xcode: Read defaults for ${key}`, 'defaults', ['read', `${this.path}/Contents/Info`, key]);
        return result.stdout.trim();
    }
    async version() {
        return await navigator.locks.request(`XcodeInfo.version.${this.path}`, async () => {
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
    async swiftVersion() {
        return await navigator.locks.request(`XcodeInfo.swiftVersion.${this.path}`, async () => {
            if (typeof this._swiftVersion != "string") {
                const swiftVersionResult = await exec('xcrun', ['swift', '--version'], {
                    env: {
                        'DEVELOPER_DIR': this.path,
                    }
                });
                const swiftVersionString = swiftVersionResult.stdout.trim();
                const swiftVersion = extractSwiftVersionFromCommandOutput(swiftVersionString);
                if (isUndefined(swiftVersion)) {
                    throw Error(`Swift version cannot be detected for ${this.path}.`);
                }
                this._swiftVersion = swiftVersion;
                await info(`Swift version is ${swiftVersion} for Xcode at ${this.path}`);
            }
            return this._swiftVersion;
        });
    }
    get developerDirectory() {
        return path.join(this.path, '/Contents/Developer');
    }
    get toolchainDirectory() {
        return path.join(this.developerDirectory, '/Toolchains/XcodeDefault.xctoolchain');
    }
    get binDirectory() {
        return path.join(this.toolchainDirectory, '/usr/bin');
    }
    get swiftPath() {
        return path.join(this.binDirectory, 'swift');
    }
    static _betaRegex = new RegExp('^(/.+/Xcode[^/]*)_beta.app');
    /** @returns `true` if Xcode _may be_ beta. */
    async isBeta() {
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
    async equivalentReleaseVersion() {
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
            const xcodes = Array.from((await XcodeInfo.all()).values());
            for (const xcodeInfo of xcodes) {
                if (semver.eq(await xcodeInfo.version(), expectedReleaseVersion) &&
                    expectedSwiftVersion == await xcodeInfo.swiftVersion()) {
                    await info(`Xcode release version is found.`);
                    return xcodeInfo;
                }
            }
        }
        else {
            const xcodes = Array.from((await XcodeInfo.all()).values());
            for (const xcodeInfo of xcodes) {
                if (xcodeInfo.isEqualTo(this)) {
                    continue;
                }
                if (expectedSwiftVersion == await xcodeInfo.swiftVersion()) {
                    await info(`Xcode release version is found.`);
                    return xcodeInfo;
                }
            }
        }
        return null;
    }
    async activateDeveloperDirectory() {
        const developerDirectory = this.developerDirectory;
        await exec(`Switch Developer Directory to ${developerDirectory}`, 'sudo xcode-select', ['-switch', developerDirectory]);
    }
    async setSDKRootEnvironmentVariable() {
        const sdkRootResult = await exec('Set SDKROOT environment variable', 'xcrun', ['--sdk', 'macosx', '--show-sdk-path']);
        core.exportVariable('SDKROOT', sdkRootResult.stdout.trim());
    }
    async activate() {
        await Promise.all([
            this.activateDeveloperDirectory(),
            this.setSDKRootEnvironmentVariable(),
        ]);
    }
}
XcodeInfo.installedUnderApplicationsDirectory = (() => {
    let installedXcodeApplicationsUnderApplicationsDirectory = nil;
    return async () => {
        return await navigator.locks.request("XcodeInfo.installedUnderApplicationsDirectory", async () => {
            if (typeof installedXcodeApplicationsUnderApplicationsDirectory != "undefined") {
                return installedXcodeApplicationsUnderApplicationsDirectory;
            }
            if (!osIsDarwin) {
                const emptyMap = new Map();
                installedXcodeApplicationsUnderApplicationsDirectory = emptyMap;
                return emptyMap;
            }
            const result = new Map();
            const dirEntries = fs.readdirSync('/Applications', { withFileTypes: true });
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
    let allXcodes = nil;
    return async () => {
        return await navigator.locks.request("XcodeInfo.all", async () => {
            if (typeof allXcodes != "undefined") {
                return allXcodes;
            }
            if (!osIsDarwin) {
                const emptyMap = new Map();
                allXcodes = emptyMap;
                return emptyMap;
            }
            const result = new Map();
            const commandResult = await exec("Search all Xcode applications", 'mdfind', ['kMDItemCFBundleIdentifier == "com.apple.dt.Xcode"'], { ignoreReturnCode: true });
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
    let latestXcode = nil;
    return async () => {
        return await navigator.locks.request("XcodeInfo.latest", async () => {
            if (!osIsDarwin) {
                throw new Error("Called on non-Darwin?!");
            }
            if (typeof latestXcode != "undefined") {
                return latestXcode;
            }
            await info("Determining the latest Xcode...");
            const result = await (async () => {
                let currentLatest = nil;
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
})();
XcodeInfo.forSwift = (() => {
    const swiftMap = new Map();
    return async (version) => {
        return navigator.locks.request("XcodeInfo.forSwift", async () => {
            if (!osIsDarwin) {
                return null;
            }
            if (swiftMap.has(version)) {
                return swiftMap.get(version) || null;
            }
            await info('Check whether or not Swift ' + version + ' is already installed.');
            const foundXcode = await (async () => {
                // Avoid calling `mdfind` if possible
                const xcodeInAppDirMap = await XcodeInfo.installedUnderApplicationsDirectory();
                const xcodesInAppDir = Array.from(xcodeInAppDirMap.values());
                for (const xcodeInfo of xcodesInAppDir.sort((x1, x2) => (x1.path > x2.path) ? -1 : 1)) {
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
