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
import { osIsDarwin, workingDirectory, download, exec } from "./common.js";
import { SwiftInstaller } from "./swift-installer.js";

/**
 * An installer that uses 'swiftly' internally.
 */
export class Swiftly extends SwiftInstaller {
  public static readonly directory: string = `${workingDirectory}/.swiftly`;
  public static readonly binDirectory: string = `${Swiftly.directory}/bin`;
  public static readonly toolchainsDirectory: string = `${Swiftly.directory}/toolchains`;

  private static _packagedBinaryURL: URL = (
    (osIsDarwin) ? new URL("https://download.swift.org/swiftly/darwin/swiftly.pkg")
    : new URL(`https://download.swift.org/swiftly/linux/swiftly-${process.arch}.tar.gz`)
  );
  
  private static _doneSetUp: boolean = false;
  private static async _setUp(): Promise<void> {
    if (Swiftly._doneSetUp) {
      return;
    }
    Swiftly._doneSetUp = true;
    await fs.promises.mkdir(Swiftly.directory, {recursive: true});
    const localPackagedBinaryFilename = Swiftly._packagedBinaryURL.pathname.replace(/^.*\//, '');
    const localPackagedBinaryPath = path.join(Swiftly.directory, localPackagedBinaryFilename);
    await download(Swiftly._packagedBinaryURL, localPackagedBinaryPath);

    core.exportVariable("SWIFTLY_HOME_DIR", Swiftly.directory);
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
          cwd: Swiftly.directory,
        }
      );
      await exec(
        "Initialize swiftly",
        `${os.homedir()}/.swiftly/bin/swiftly`,
        [
          'init',
          '--skip-install',
          '--quiet-shell-followup',
          '--assume-yes',
        ]
      );
    } else {
      await exec(
        "Unarchive swiftly",
        "tar",
        [
          'zxf', localPackagedBinaryFilename
        ],
        {
          cwd: Swiftly.directory
        }
      );
      await exec(
        "Initialize swiftly",
        `${Swiftly.directory}/swiftly`,
        [
          'init',
          ' --skip-install',
          '--quiet-shell-followup',
          '--assume-yes',
        ]
      )
    }
    core.addPath(Swiftly.binDirectory);
  }

  private static async _tearDown(): Promise<void> {
    if (!Swiftly._doneSetUp) {
      return;
    }
    await fs.promises.rm(Swiftly.directory, {recursive: true, force: true});
    Swiftly._doneSetUp = false;
  }

  public constructor(version: string) {
    super(version);
  }

  public override async setUp(): Promise<void> {
    await Swiftly._setUp();
  }

  public override async tearDown(): Promise<void> {
    await Swiftly._tearDown();
  }
}