/* *************************************************************************************************
 common.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as os from 'os';
// ----- Constants ----- //
/** Default path to the Swift package directory. */
export const defaultSwiftPackageDirectory = '.';
/** Home directory */
export const homeDirectory = os.homedir();
/** Working directory for this action */
export const workingDirectory = `${homeDirectory}/action-setup-swift-workspace`;
export const swiftenvDirectory = `${workingDirectory}/.swiftenv`;
export const swiftenvBinDirectory = `${swiftenvDirectory}/bin`;
export const swiftenvPath = `${swiftenvBinDirectory}/swiftenv`;
export const osIsDarwin = os.platform() == 'darwin';
// ----- Functions ----- //
/**
 * @param name - The name of the job.
 * @param closure - The job.
 */
export async function run(name, closure) {
    core.startGroup(name);
    const result = await closure();
    core.endGroup();
    return result;
}
/**
 * @param name - The name of the job.
 * @param commandName - Command to execute.
 * @param commandArgs - (Optional) Arguments for the command.
 * @param commandOptions - (Optional) Optional options for the command.
 * @returns The result of the command.
 */
export async function execRun(name, commandName, commandArgs = void (0), commandOptions = void (0)) {
    let stdoutString = '';
    let stderrString = '';
    let exitStatus = 1;
    const originalStdoutListener = commandOptions?.listeners?.stdout;
    const stdoutListener = (data) => {
        stdoutString = data.toString().trim();
        originalStdoutListener?.call(null, data);
    };
    const originalStderrListener = commandOptions?.listeners?.stderr;
    const stderrListener = (data) => {
        stderrString = data.toString().trim();
        originalStderrListener?.call(null, data);
    };
    const listeners = commandOptions?.listeners || {};
    listeners.stdout = stdoutListener;
    listeners.stderr = stderrListener;
    const newOptions = commandOptions || {};
    newOptions.listeners = listeners;
    await run(name, async () => {
        exitStatus = await exec.exec(commandName, commandArgs, newOptions);
    });
    return {
        exitStatus: exitStatus,
        stdout: stdoutString,
        stderr: stderrString,
    };
}
export async function prepareDirectory() {
    await execRun('Prepare working directory...', 'mkdir', ['-p', workingDirectory]);
}
