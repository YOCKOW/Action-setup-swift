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
    static directory = `${workingDirectory}/.swiftly`;
    static binDirectory = `${Swiftly.directory}/bin`;
    static toolchainsDirectory = `${Swiftly.directory}/toolchains`;
    static _packagedBinaryURL = ((osIsDarwin) ? new URL("https://download.swift.org/swiftly/darwin/swiftly.pkg")
        : new URL(`https://download.swift.org/swiftly/linux/swiftly-${os.machine()}.tar.gz`));
    static _doneSetUp = false;
    static async _setUp() {
        if (Swiftly._doneSetUp) {
            return;
        }
        Swiftly._doneSetUp = true;
        await fs.promises.mkdir(Swiftly.directory, { recursive: true });
        const localPackagedBinaryFilename = Swiftly._packagedBinaryURL.pathname.replace(/^.*\//, '');
        const localPackagedBinaryPath = path.join(Swiftly.directory, localPackagedBinaryFilename);
        await download(Swiftly._packagedBinaryURL, localPackagedBinaryPath);
        core.exportVariable("SWIFTLY_HOME_DIR", Swiftly.directory);
        core.exportVariable("SWIFTLY_BIN_DIR", Swiftly.binDirectory);
        core.exportVariable("SWIFTLY_TOOLCHAINS_DIR", Swiftly.toolchainsDirectory);
        if (osIsDarwin) {
            await exec('Install swiftly', 'installer', [
                '-pkg', localPackagedBinaryFilename,
                '-target', 'CurrentUserHomeDirectory',
            ], {
                cwd: Swiftly.directory,
            });
            await exec("Initialize swiftly", `${os.homedir()}/.swiftly/bin/swiftly`, [
                'init',
                '--skip-install',
                '--quiet-shell-followup',
                '--assume-yes',
            ]);
        }
        else {
            await exec("Unarchive swiftly", "tar", [
                'zxf', localPackagedBinaryFilename
            ], {
                cwd: Swiftly.directory
            });
            await exec("Initialize swiftly", `${Swiftly.directory}/swiftly`, [
                'init',
                ' --skip-install',
                '--quiet-shell-followup',
                '--assume-yes',
            ]);
        }
        core.addPath(Swiftly.binDirectory);
    }
    static async _tearDown() {
        if (!Swiftly._doneSetUp) {
            return;
        }
        await fs.promises.rm(Swiftly.directory, { recursive: true, force: true });
        Swiftly._doneSetUp = false;
    }
    constructor(version) {
        super(version);
    }
    async setUp() {
        await Swiftly._setUp();
    }
    async tearDown() {
        await Swiftly._tearDown();
    }
}
