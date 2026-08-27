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
import { osIsDarwin, workingDirectory, map, download, exec, info, aptInstall, extractSwiftVersionFromCommandOutput } from "./common.js";
import { SwiftInstaller } from "./swift-installer.js";
import { XcodeInfo } from './xcode.js';
/**
 * An installer that uses 'swiftly' internally.
 */
export class Swiftly extends SwiftInstaller {
    static homeDirectory = `${workingDirectory}/.swiftly`;
    static binDirectory = `${Swiftly.homeDirectory}/bin`;
    static toolchainsDirectory = `${Swiftly.homeDirectory}/toolchains`;
    static _packagedBinaryURL = ((osIsDarwin) ? new URL("https://download.swift.org/swiftly/darwin/swiftly.pkg")
        : new URL(`https://download.swift.org/swiftly/linux/swiftly-${os.machine()}.tar.gz`));
    static _doneSetUp = false;
    static async _setUp() {
        await navigator.locks.request("Swiftly._setUp", async () => {
            if (Swiftly._doneSetUp) {
                return;
            }
            await fs.promises.mkdir(Swiftly.homeDirectory, { recursive: true });
            const localPackagedBinaryFilename = Swiftly._packagedBinaryURL.pathname.replace(/^.*\//, '');
            const localPackagedBinaryPath = path.join(Swiftly.homeDirectory, localPackagedBinaryFilename);
            const __installDependencies = async () => {
                if (!osIsDarwin) {
                    await aptInstall("bash", "tar", "libcurl4-openssl-dev");
                }
            };
            await Promise.all([
                __installDependencies(),
                download(Swiftly._packagedBinaryURL, localPackagedBinaryPath),
            ]);
            core.exportVariable("SWIFTLY_HOME_DIR", Swiftly.homeDirectory);
            core.exportVariable("SWIFTLY_BIN_DIR", Swiftly.binDirectory);
            core.exportVariable("SWIFTLY_TOOLCHAINS_DIR", Swiftly.toolchainsDirectory);
            if (osIsDarwin) {
                await exec('Install swiftly', 'installer', [
                    '-pkg', localPackagedBinaryFilename,
                    '-target', 'CurrentUserHomeDirectory',
                ], {
                    cwd: Swiftly.homeDirectory,
                });
            }
            else {
                await exec("Unarchive swiftly", "tar", [
                    'zxf', localPackagedBinaryFilename
                ], {
                    cwd: Swiftly.homeDirectory
                });
            }
            await exec("Initialize swiftly", ((osIsDarwin) ? `${os.homedir()}/.swiftly/bin/swiftly`
                : `${Swiftly.homeDirectory}/swiftly`), [
                'init',
                '--skip-install',
                '--quiet-shell-followup',
                '--assume-yes',
            ]);
            core.addPath(Swiftly.binDirectory);
            Swiftly._doneSetUp = true;
        });
    }
    static async _tearDown() {
        await navigator.locks.request("Swiftly._tearDown", async () => {
            if (!Swiftly._doneSetUp) {
                return;
            }
            await fs.promises.rm(Swiftly.homeDirectory, { recursive: true, force: true });
            Swiftly._doneSetUp = false;
        });
    }
    constructor(version) {
        super(version);
    }
    async setUp() {
        await Swiftly._setUp();
    }
    async installSwift() {
        await navigator.locks.request(`Swiftly.installSwift ${this.swiftVersion}`, async () => {
            await info(`Download Swift ${this.swiftVersion} (via swiftly)`);
            await exec('swiftly', ['install', this.swiftVersion]);
        });
    }
    async switchSwift() {
        await exec(`swiftly`, ['use', '--global-default', '--assume-yes', this.swiftVersion]);
        await exec('swiftly', ['link']);
        const toolchainLocResult = await exec("Determine the path to 'swift'", "swiftly", ["use", "--print-location"]);
        const toolchainDirectory = toolchainLocResult.stdout;
        const binDirectory = path.join(toolchainDirectory, '/usr/bin');
        const swiftPath = path.join(binDirectory, '/swift');
        this.toolchain = {
            toolchainDirectory: toolchainDirectory,
            binDirectory: binDirectory,
            swiftPath: swiftPath,
        };
    }
    async finalize() {
        await super.finalize();
        if (osIsDarwin) {
            const installedSwiftVersionCommandOutput = (await exec(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            this.toolchain.swiftPath, ["--version"])).stdout;
            const installedSwiftVersion = extractSwiftVersionFromCommandOutput(installedSwiftVersionCommandOutput);
            const activeXcode = (await map(installedSwiftVersion, async (version) => {
                return await XcodeInfo.forSwift(version) ?? await XcodeInfo.latest();
            })) ?? await XcodeInfo.latest();
            await activeXcode.setSDKRootEnvironmentVariable();
        }
    }
    async tearDown() {
        await Swiftly._tearDown();
    }
}
