/* *************************************************************************************************
 swift-installer-swiftenv.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as path from 'path';
import * as installer from './swift-installer.js';
import { workingDirectory, run, execRun, } from './common.js';
import * as xcode from './xcode.js';
/**
 * An installer that uses 'swiftenv' internally.
 */
export class Swiftenv extends installer.SwiftInstaller {
    /** The path to the directory of 'swiftenv' repository. */
    static directory = `${workingDirectory}/.swiftenv`;
    static binDirectory = `${Swiftenv.directory}/bin`;
    /** The path to the executable of 'swiftenv'. */
    static path = `${Swiftenv.binDirectory}/swiftenv`;
    static _doneSetUp = false;
    static async _setUp() {
        if (Swiftenv._doneSetUp) {
            return;
        }
        Swiftenv._doneSetUp = true;
        await execRun('Download swiftenv...', 'git', ['clone', '--depth', '1', 'https://github.com/kylef/swiftenv.git', Swiftenv.directory]);
        core.addPath(Swiftenv.binDirectory);
        core.exportVariable('SWIFTENV_ROOT', Swiftenv.directory);
    }
    constructor(version) {
        super(version);
    }
    async setUp() {
        await Swiftenv._setUp();
    }
    async installSwift() {
        const version = this.swiftVersion;
        const whereSwift = await xcode.swiftPath(version);
        if (whereSwift != "not_found") {
            core.info(version + ' is already installed.');
            return;
        }
        const status = await exec.exec('swiftenv', ['prefix', version], { ignoreReturnCode: true });
        if (status == 0) {
            core.info(version + ' is already installed.');
            return;
        }
        const __download_swift = async () => {
            return await exec.exec(Swiftenv.path, ['install', version], {
                ignoreReturnCode: true,
            });
        };
        // NOTE: Sometimes `swiftenv install ...` fails owing to curl's error 18 on GitHub Actions.
        const __retryableExitStatus = (status) => {
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
                }
                else {
                    throw new Error(failureMessage);
                }
            }
        });
    }
    async switchSwift() {
        const version = this.swiftVersion;
        const whereSwift = await xcode.swiftPath(version);
        if (whereSwift instanceof xcode.XcodeInfo) {
            this.toolchain = whereSwift;
        }
        else {
            await exec.exec(Swiftenv.path, ['global', version]);
            await exec.exec(Swiftenv.path, ['versions']);
            const whichResult = await execRun("Determine the path to 'swift'.", Swiftenv.path, ['which', 'swift']);
            const swiftPath = whichResult.stdout;
            const binDirectory = path.dirname(swiftPath);
            const toolchainDirectory = path.dirname(path.dirname(binDirectory));
            this.toolchain = {
                toolchainDirectory: toolchainDirectory,
                binDirectory: binDirectory,
                swiftPath: swiftPath,
            };
        }
    }
    async finalize() {
        await super.finalize();
    }
}
