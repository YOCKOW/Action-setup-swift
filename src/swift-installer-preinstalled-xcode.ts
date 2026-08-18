/* *************************************************************************************************
 swift-installer-preinstalled-xcode.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import * as core from '@actions/core';
import * as installer from './swift-installer.js';
import { XcodeInfo } from './xcode.js';

export class PreinstalledXcode extends installer.SwiftInstaller {
  protected override toolchain: XcodeInfo;

  public constructor(swiftVersion: string, xcode: XcodeInfo) {
    super(swiftVersion);
    this.toolchain = xcode;
  }

  public override async switchSwift(): Promise<void> {
    await this.toolchain.activate();
  }

  public override async finalize(): Promise<void> {
    await super.finalize();
    core.addPath(this.toolchain.binDirectory);
  }
}