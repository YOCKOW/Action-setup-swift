/* *************************************************************************************************
 swift-installer-swiftenv.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as path from 'path';
import * as installer from './swift-installer.js';
import { exec, info, osIsDarwin, workingDirectory, } from './common.js';
import { XcodeInfo } from './xcode.js';
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
        await navigator.locks.request("Swiftenv._setUp", async () => {
            if (Swiftenv._doneSetUp) {
                return;
            }
            await exec('Download swiftenv', 'git', ['clone', '--depth', '1', 'https://github.com/kylef/swiftenv.git', Swiftenv.directory]);
            core.addPath(Swiftenv.binDirectory);
            core.exportVariable('SWIFTENV_ROOT', Swiftenv.directory);
            Swiftenv._doneSetUp = true;
        });
    }
    constructor(version) {
        super(version);
    }
    async setUp() {
        await Swiftenv._setUp();
    }
    async installSwift() {
        await navigator.locks.request(`Swiftenv.installSwift ${this.swiftVersion}`, async () => {
            const version = this.swiftVersion;
            const whereSwift = await XcodeInfo.forSwift(version);
            if (whereSwift) {
                await info(version + ' is already installed.');
                return;
            }
            const status = (await exec('swiftenv', ['prefix', version], { ignoreReturnCode: true })).exitStatus;
            if (status == 0) {
                await info(version + ' is already installed.');
                return;
            }
            const __download_swift = async () => {
                return (await exec(Swiftenv.path, ['install', version], {
                    ignoreReturnCode: true,
                })).exitStatus;
            };
            // NOTE: Sometimes `swiftenv install ...` fails owing to curl's error 18 on GitHub Actions.
            const __retryableExitStatus = (status) => {
                return (status == 18);
            };
            const commandDesc = `swiftenv install ${version}`;
            await info('Download Swift (via swiftenv)');
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
                }
                else {
                    throw new Error(failureMessage);
                }
            }
        });
    }
    async switchSwift() {
        const version = this.swiftVersion;
        const whereSwift = await XcodeInfo.forSwift(version);
        if (whereSwift instanceof XcodeInfo) {
            this.toolchain = await whereSwift.equivalentReleaseVersion() || whereSwift;
        }
        else {
            await exec(Swiftenv.path, ['global', version]);
            await exec(Swiftenv.path, ['versions']);
            const whichResult = await exec("Determine the path to 'swift'", Swiftenv.path, ['which', 'swift']);
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
        if (osIsDarwin) {
            const activeXcode = ((this.toolchain instanceof XcodeInfo) ? this.toolchain
                : await XcodeInfo.latest());
            await activeXcode.activate();
        }
    }
}
