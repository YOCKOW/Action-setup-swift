/* *************************************************************************************************
 swift-installer-swiftly.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

// Modules

import * as core from '@actions/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { osIsDarwin, workingDirectory, download, exec, info, aptInstall } from "./common.js";
import { SwiftInstaller } from "./swift-installer.js";

/**
 * An installer that uses 'swiftly' internally.
 */
export class Swiftly extends SwiftInstaller {
  public static readonly homeDirectory: string = `${workingDirectory}/.swiftly`;
  public static readonly binDirectory: string = `${Swiftly.homeDirectory}/bin`;
  public static readonly toolchainsDirectory: string = `${Swiftly.homeDirectory}/toolchains`;

  private static _packagedBinaryURL: URL = (
    (osIsDarwin) ? new URL("https://download.swift.org/swiftly/darwin/swiftly.pkg")
    : new URL(`https://download.swift.org/swiftly/linux/swiftly-${os.machine()}.tar.gz`)
  );
  
  private static _doneSetUp: boolean = false;
  private static async _setUp(): Promise<void> {
    await navigator.locks.request("Swiftly._setUp", async () => {
      if (Swiftly._doneSetUp) {
        return;
      }
      await fs.promises.mkdir(Swiftly.homeDirectory, {recursive: true});
      const localPackagedBinaryFilename = Swiftly._packagedBinaryURL.pathname.replace(/^.*\//, '');
      const localPackagedBinaryPath = path.join(Swiftly.homeDirectory, localPackagedBinaryFilename);
      await download(Swiftly._packagedBinaryURL, localPackagedBinaryPath);

      core.exportVariable("SWIFTLY_HOME_DIR", Swiftly.homeDirectory);
      core.exportVariable("SWIFTLY_BIN_DIR", Swiftly.binDirectory);
      core.exportVariable("SWIFTLY_TOOLCHAINS_DIR", Swiftly.toolchainsDirectory);

      if (osIsDarwin) {
        await exec(
          'Install swiftly',
          'installer',
          [
            '-pkg', localPackagedBinaryFilename,
            '-target', 'CurrentUserHomeDirectory',
          ],
          {
            cwd: Swiftly.homeDirectory,
          }
        );
      } else {
        await aptInstall("bash", "tar", "libcurl4-openssl-dev");
        await exec(
          "Unarchive swiftly",
          "tar",
          [
            'zxf', localPackagedBinaryFilename
          ],
          {
            cwd: Swiftly.homeDirectory
          }
        );
      }

      await exec(
        "Initialize swiftly",
        (
          (osIsDarwin) ? `${os.homedir()}/.swiftly/bin/swiftly`
          : `${Swiftly.homeDirectory}/swiftly`
        ),
        [
          'init',
          '--skip-install',
          '--quiet-shell-followup',
          '--assume-yes',
        ]
      );
      core.addPath(Swiftly.binDirectory);
      Swiftly._doneSetUp = true;
    });
  }

  private static async _tearDown(): Promise<void> {
    if (!Swiftly._doneSetUp) {
      return;
    }
    await fs.promises.rm(Swiftly.homeDirectory, {recursive: true, force: true});
    Swiftly._doneSetUp = false;
  }

  public constructor(version: string) {
    super(version);
  }

  public override async setUp(): Promise<void> {
    await Swiftly._setUp();
  }

  public override async installSwift(): Promise<void> {
    await navigator.locks.request(`Swiftly.installSwift ${this.swiftVersion}`, async () => {
      info(`Download Swift ${this.swiftVersion} (via swiftly)`);
      await exec('swiftly', ['install', this.swiftVersion]);
    });
  }

  public override async tearDown(): Promise<void> {
    await Swiftly._tearDown();
  }
}