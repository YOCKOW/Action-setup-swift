/* *************************************************************************************************
 swift-installer-swiftenv.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import * as core from '@actions/core';
import * as path from 'path';
import * as installer from './swift-installer.js';
import {
  exec,
  info,
  osIsDarwin,
  workingDirectory,
} from './common.js';
import { XcodeInfo } from './xcode.js';


/**
 * An installer that uses 'swiftenv' internally.
 */
export class Swiftenv extends installer.SwiftInstaller {
  /** The path to the directory of 'swiftenv' repository. */
  public static readonly directory: string = `${workingDirectory}/.swiftenv`;

  public static readonly binDirectory: string = `${Swiftenv.directory}/bin`;

  /** The path to the executable of 'swiftenv'. */
  public static readonly path: string = `${Swiftenv.binDirectory}/swiftenv`;

  private static _doneSetUp: boolean = false;
  private static async _setUp(): Promise<void> {
    if (Swiftenv._doneSetUp) {
      return;
    }
    Swiftenv._doneSetUp = true;
    await exec(
      'Download swiftenv...',
      'git', ['clone', '--depth', '1', 'https://github.com/kylef/swiftenv.git', Swiftenv.directory]
    );
    core.addPath(Swiftenv.binDirectory);
    core.exportVariable('SWIFTENV_ROOT', Swiftenv.directory);
  }

  public constructor(version: string) {
    super(version);
  }

  public override async setUp(): Promise<void> {
    await Swiftenv._setUp();
  }

  public override async installSwift(): Promise<void> {
    const version = this.swiftVersion;
    const whereSwift = await XcodeInfo.forSwift(version);
    if (whereSwift) {
      core.info(version + ' is already installed.');
      return;
    }

    const status = (await exec('swiftenv', ['prefix', version], {ignoreReturnCode: true})).exitStatus;
    if (status == 0) {
      core.info(version + ' is already installed.');
      return;
    }

    const __download_swift = async (): Promise<number> => {
      return (await exec(
        Swiftenv.path,
        ['install', version],
        {
          ignoreReturnCode: true,
        }
      )).exitStatus;
    };

    // NOTE: Sometimes `swiftenv install ...` fails owing to curl's error 18 on GitHub Actions.
    const __retryableExitStatus = (status: number): boolean => {
      return (status == 18);
    };
  
    const commandDesc = `swiftenv install ${version}`;
  
    info('Download Swift (via swiftenv)');
    let retryCount = 0;
    const maxRetryCount = 5;
    while (true) {
      retryCount++;
      if (retryCount > maxRetryCount) {
        throw new Error(`\`${commandDesc}\` failed too many times.`);
      }

      const exitStatus = await __download_swift();
      if (exitStatus == 0) {
        break;
      }
      const failureMessage = `\`${commandDesc}\` failed with exit code ${exitStatus.toString()}.`;
      if (__retryableExitStatus(exitStatus)) {
        core.info(failureMessage);
      } else {
        throw new Error(failureMessage);
      }
    }
  }

  public override async switchSwift(): Promise<void> {
    const version = this.swiftVersion;
    const whereSwift = await XcodeInfo.forSwift(version);
    if (whereSwift instanceof XcodeInfo) {
      this.toolchain = await whereSwift.equivalentReleaseVersion() || whereSwift;
    } else {
      await exec(Swiftenv.path, ['global', version]);
      await exec(Swiftenv.path, ['versions']);
      const whichResult = await exec(
        "Determine the path to 'swift'",
        Swiftenv.path,
        ['which', 'swift']
      )
      const swiftPath = whichResult.stdout;
      const binDirectory = path.dirname(swiftPath);
      const toolchainDirectory =  path.dirname(path.dirname(binDirectory));
      this.toolchain = {
        toolchainDirectory: toolchainDirectory,
        binDirectory: binDirectory,
        swiftPath: swiftPath,
      }
    }
  }

  public override async finalize(): Promise<void> {
    await super.finalize();

    if (osIsDarwin) {
      const activeXcode = (
        (this.toolchain instanceof XcodeInfo) ? this.toolchain
        : await XcodeInfo.latest()
      );
      await activeXcode.activate();
    }
  }
}