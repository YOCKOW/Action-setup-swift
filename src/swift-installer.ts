/* *************************************************************************************************
 swift-installer.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import * as core from '@actions/core';
import * as os from 'os';
import * as semver from 'semver';

import {
  execRun,
} from './common.js'
import * as xcode from './xcode.js';

export interface ActiveToolchain {
  toolchainDirectory: string;
  binDirectory: string;
  /** The absolute path to 'swift' binary. */
  swiftPath: string; 
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

  private async _darwinFinalize(): Promise<void> {
    if (os.platform() != 'darwin') {
      return;
    }

    if (!this.toolchain) {
      throw new Error("`toolchain` is undefined.");
    }

    const version = this.swiftVersion;
    if (this.toolchain instanceof xcode.XcodeInfo) {
      const releaseVersion = await this.toolchain.equivalentReleaseVersion();
      if (releaseVersion) {
        this.toolchain = releaseVersion;
      }
    }

    const activeXcode =
      (this.toolchain instanceof xcode.XcodeInfo) ? this.toolchain
      : await xcode.XcodeInfo.latest();
    await activeXcode.activateDeveloperDirectory();

    const sdkRootResult = await execRun(
      'Set SDKROOT environment variable',
      'xcrun',
      ['--sdk', 'macosx', '--show-sdk-path'],
    );
    core.exportVariable('SDKROOT', sdkRootResult.stdout);
  }

  public async finalize() {
    if (!this.toolchain) {
      throw new Error("`toolchain` is undefined.");
    }

    if (os.platform() == 'darwin') {
      await this._darwinFinalize();
    }
  }
}