/* *************************************************************************************************
 swift-installer.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as os from 'os';
import * as semver from 'semver';
import { execRun, } from './common.js';
import * as xcode from './xcode.js';
/**
 * A base (abstract) class to install Swift toolchain.
 */
export class SwiftInstaller {
    /**
     * The path to the binary of 'swift'.
     * (e.g.) `/usr/bin/swift`
     */
    swiftPath = void (0);
    swiftVersion;
    /**
     * @param version - The version of Swift to be installed.
     */
    constructor(version) {
        this.swiftVersion = version;
    }
    async setUp() { }
    async installSwift() { }
    async switchSwift() { }
    // FIXME: There should be more appropriate way...
    async _darwinFinalize(swiftBinDirectory) {
        if (os.platform() != 'darwin') {
            return;
        }
        const version = this.swiftVersion;
        let binDirectory = swiftBinDirectory;
        // Use release rather than beta
        const betaRegexResult = (new RegExp('^(/.+/Xcode[^/]*)_beta.app')).exec(binDirectory);
        if (betaRegexResult) {
            core.info("Xcode is beta version.");
            const expectedReleaseVersion = await new xcode.XcodeInfo(betaRegexResult[0]).version();
            const expectedReleasePath = betaRegexResult[1] + '.app';
            const expectedReleaseXcode = new xcode.XcodeInfo(expectedReleasePath);
            if (version == await expectedReleaseXcode.swiftVersion().catch()) {
                core.info(`Xcode release version is found.`);
                binDirectory = binDirectory.replace('_beta', '');
            }
            else {
                const xcodes = Array.from((await xcode.allInstalledXcodeApplications()).values());
                for (let xcodeInfo of xcodes) {
                    if (semver.eq(await xcodeInfo.version(), expectedReleaseVersion) &&
                        version == await xcodeInfo.swiftVersion()) {
                        core.info(`Xcode release version is found.`);
                        binDirectory = xcodeInfo.path + '/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin';
                        break;
                    }
                }
            }
        }
        const xcodePathRegExp = new RegExp('^/Applications/Xcode[^/]*.app/Contents/Developer');
        const xcodeMatched = binDirectory.match(xcodePathRegExp);
        let developerDirectory = '/Applications/Xcode.app/Contents/Developer';
        if (xcodeMatched && xcodeMatched[0]) {
            developerDirectory = xcodeMatched[0];
        }
        else {
            const latestXcodeInfo = await xcode.latestXcode();
            developerDirectory = `${latestXcodeInfo.path}/Contents/Developer`;
        }
        await execRun(`Switch Developer Directory to ${developerDirectory}`, 'sudo xcode-select', ['-switch', developerDirectory]);
        const sdkRootResult = await execRun('Set SDKROOT environment variable', 'xcrun', ['--sdk', 'macosx', '--show-sdk-path']);
        core.exportVariable('SDKROOT', sdkRootResult.stdout);
    }
    async finalize() {
        if (!this.swiftPath) {
            throw new Error("`swiftPath` is undefined.");
        }
        if (os.platform() == 'darwin') {
            const swiftBinDirectory = this.swiftPath.replace(/\/swift$/, '');
            await this._darwinFinalize(swiftBinDirectory);
        }
    }
}
