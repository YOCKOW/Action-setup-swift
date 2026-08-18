/* *************************************************************************************************
 swift-installer-preinstalled-xcode.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as installer from './swift-installer.js';
export class PreinstalledXcode extends installer.SwiftInstaller {
    toolchain;
    constructor(swiftVersion, xcode) {
        super(swiftVersion);
        this.toolchain = xcode;
    }
    async switchSwift() {
        await this.toolchain.activate();
    }
    async finalize() {
        await super.finalize();
        core.addPath(this.toolchain.binDirectory);
    }
}
