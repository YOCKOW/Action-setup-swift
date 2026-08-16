/* *************************************************************************************************
 swift-installer.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as os from 'os';
import { execRun, } from './common.js';
import * as xcode from './xcode.js';
;
/**
 * A base (abstract) class to install Swift toolchain.
 */
export class SwiftInstaller {
    toolchain = void (0);
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
    async _darwinFinalize() {
        if (os.platform() != 'darwin') {
            return;
        }
        if (!this.toolchain) {
            throw new Error("`toolchain` is undefined.");
        }
        if (this.toolchain instanceof xcode.XcodeInfo) {
            const releaseVersion = await this.toolchain.equivalentReleaseVersion();
            if (releaseVersion) {
                this.toolchain = releaseVersion;
            }
        }
        const activeXcode = (this.toolchain instanceof xcode.XcodeInfo) ? this.toolchain
            : await xcode.XcodeInfo.latest();
        await activeXcode.activateDeveloperDirectory();
        const sdkRootResult = await execRun('Set SDKROOT environment variable', 'xcrun', ['--sdk', 'macosx', '--show-sdk-path']);
        core.exportVariable('SDKROOT', sdkRootResult.stdout);
    }
    async finalize() {
        if (!this.toolchain) {
            throw new Error("`toolchain` is undefined.");
        }
        if (os.platform() == 'darwin') {
            await this._darwinFinalize();
        }
    }
}
