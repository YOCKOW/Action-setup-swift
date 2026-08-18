/* *************************************************************************************************
 swift-installer.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

export interface ActiveToolchain {
  readonly toolchainDirectory: string;
  readonly binDirectory: string;
  /** The absolute path to 'swift' binary. */
  readonly swiftPath: string;
};

/**
 * A base (abstract) class to install Swift toolchain.
 */
export class SwiftInstaller {
  protected toolchain: ActiveToolchain | undefined = void(0);

  public readonly swiftVersion: string;

  /**
   * @param version - The version of Swift to be installed.
   */
  public constructor(version: string) {
    this.swiftVersion = version;
  }

  public async setUp() {}

  public async installSwift() {}

  public async switchSwift() {}

  /* eslint-disable "@typescript-eslint/require-await" */
  public async finalize() {
    if (!this.toolchain) {
      throw new Error("`toolchain` is undefined.");
    }
  }
  /* eslint-enable "@typescript-eslint/require-await" */
}