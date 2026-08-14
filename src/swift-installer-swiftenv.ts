/* *************************************************************************************************
 swift-installer-swiftenv.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as installer from './swift-installer.js';
import {
  workingDirectory,
  run,
  execRun,
} from './common.js';
import * as xcode from './xcode.js';


/**
 * An installer that uses 'swiftenv' internally.
 */
export class Swiftenv extends installer.SwiftInstaller {
  /** The path to the directory of 'swiftenv' repository. */
  public static readonly directory: string = `${workingDirectory}/.swiftenv`;

  public static readonly binDirectory: string = `${Swiftenv.directory}/bin`;

  /** The path to the executable of 'swiftenv'. */
  public static readonly path: string = `${Swiftenv.binDirectory}/swiftenv`;

  private _doneSetUp: Boolean;

  private constructor() {
    super();
    this._doneSetUp = false;
  }

  public static readonly shared: Swiftenv = new Swiftenv();

  private async _downloadRepository() {
    await execRun(
      'Download swiftenv...',
      'git', ['clone', '--depth', '1', 'https://github.com/kylef/swiftenv.git', Swiftenv.directory]
    );
  }

  public override async setUp(): Promise<void> {
    if (this._doneSetUp) {
      return
    }
    this._doneSetUp = true;
    await this._downloadRepository();
    core.addPath(Swiftenv.binDirectory);
    core.exportVariable('SWIFTENV_ROOT', Swiftenv.directory);
  }

  public override async installSwift(version: string): Promise<void> {
    const whereSwift = await xcode.swiftPath(version);
    if (whereSwift != "not_found") {
      core.info(version + ' is already installed.');
      return;
    }

    const status = await exec.exec('swiftenv', ['prefix', version], {ignoreReturnCode: true});
    if (status == 0) {
      core.info(version + ' is already installed.');
      return;
    }

    const __download_swift = async (): Promise<number> => {
      return await exec.exec(
        Swiftenv.path,
        ['install', version],
        {
          ignoreReturnCode: true,
        }
      );
    };

    // NOTE: Sometimes `swiftenv install ...` fails owing to curl's error 18 on GitHub Actions.
    const __retryableExitStatus = (status: number): boolean => {
      return (status == 18);
    };
  
    const commandDesc = `swiftenv install ${version}`;
  
    await run('Download Swift (via swiftenv)...', async () => {
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
        const failureMessage = `\`${commandDesc}\` failed with exit code ${exitStatus}.`;
        if (__retryableExitStatus(exitStatus)) {
          core.info(failureMessage);
        } else {
          throw new Error(failureMessage);
        }
      }
    });
  }

  public override async switchSwift(version: string): Promise<void> {
    const whereSwift = await xcode.swiftPath(version);
    if (typeof whereSwift !== 'string') {
      this.swiftPath = whereSwift.xcodeInfo.path + '/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift'
    } else {
      await exec.exec(Swiftenv.path, ['global', version]);
      await exec.exec(Swiftenv.path, ['versions']);
      const whichResult = await execRun(
        "Determine the path to 'swift'.",
        Swiftenv.path,
        ['which', 'swift']
      )
      this.swiftPath = whichResult.stdout;
    }
  }

  public override async finalize(version: string): Promise<void> {
    await super.finalize(version);
  }
}