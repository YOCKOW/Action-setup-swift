/* *************************************************************************************************
 swift-installer.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
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
    /* eslint-disable @typescript-eslint/require-await */
    async finalize() {
        if (!this.toolchain) {
            throw new Error("`toolchain` is undefined.");
        }
    }
    /* eslint-enable @typescript-eslint/require-await */
    /**
     * Artifacts and necessary files will be removed.
     * This method is for testing, so shouldn't be called in the production environment.
     */
    async tearDown() { }
}
