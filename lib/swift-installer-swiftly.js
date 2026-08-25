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
import { osIsDarwin, workingDirectory, download, exec, info } from "./common.js";
import { SwiftInstaller } from "./swift-installer.js";
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
        if (Swiftly._doneSetUp) {
            return;
        }
        Swiftly._doneSetUp = true;
        await fs.promises.mkdir(Swiftly.homeDirectory, { recursive: true });
        const localPackagedBinaryFilename = Swiftly._packagedBinaryURL.pathname.replace(/^.*\//, '');
        const localPackagedBinaryPath = path.join(Swiftly.homeDirectory, localPackagedBinaryFilename);
        await download(Swiftly._packagedBinaryURL, localPackagedBinaryPath);
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
        const pathToSwiftly = ((osIsDarwin) ? `${os.homedir()}/.swiftly/bin/swiftly`
            : `${Swiftly.homeDirectory}/swiftly`);
        await exec("Initialize swiftly", pathToSwiftly, [
            'init',
            '--skip-install',
            '--quiet-shell-followup',
            '--assume-yes',
        ]);
        core.addPath(Swiftly.binDirectory);
    }
    static async _tearDown() {
        if (!Swiftly._doneSetUp) {
            return;
        }
        await fs.promises.rm(Swiftly.homeDirectory, { recursive: true, force: true });
        Swiftly._doneSetUp = false;
    }
    constructor(version) {
        super(version);
    }
    async setUp() {
        await Swiftly._setUp();
    }
    async installSwift() {
        info(`Download Swift ${this.swiftVersion} (via swiftly)`);
        await exec('swiftly', ['install', this.swiftVersion]);
    }
    async tearDown() {
        await Swiftly._tearDown();
    }
}
