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
export const defaultSwiftPackageDirectory: string = '.';

/** Home directory */
export const homeDirectory: string = os.homedir();

/** Working directory for this action */
export const workingDirectory = `${homeDirectory}/action-setup-swift-workspace`;

export const swiftenvDirectory = `${workingDirectory}/.swiftenv`;
export const swiftenvBinDirectory = `${swiftenvDirectory}/bin`;
export const swiftenvPath = `${swiftenvBinDirectory}/swiftenv`;

export const osIsDarwin: boolean = os.platform() == 'darwin';

// ----- Functions ----- //

/**
 * @param name - The name of the job.
 * @param closure - The job.
 */
export async function run<T>(name: string, closure: () => Promise<T>): Promise<T> {
  core.startGroup(name);
  const result = await closure();
  core.endGroup();
  return result;
}

export type CommandResult = {
  exitStatus: number,
  stdout: string,
  stderr: string,
};

/**
 * @param name - The name of the job.
 * @param commandName - Command to execute.
 * @param commandArgs - (Optional) Arguments for the command.
 * @param commandOptions - (Optional) Optional options for the command.
 * @returns The result of the command.
 */
export async function execRun(
  name: string,
  commandName: string,
  commandArgs: string[] | undefined = void(0),
  commandOptions: exec.ExecOptions | undefined = void(0)
): Promise<CommandResult> {
  let stdoutString: string = '';
  let stderrString: string = '';
  let exitStatus: number = 1;

  const originalStdoutListener = commandOptions?.listeners?.stdout;
  const stdoutListener = (data: Buffer): void => {
    stdoutString = data.toString().trim();
    originalStdoutListener?.call(null, data);
  };

  const originalStderrListener = commandOptions?.listeners?.stderr;
  const stderrListener = (data: Buffer): void => {
    stderrString = data.toString().trim();
    originalStderrListener?.call(null, data);
  };

  const listeners: exec.ExecListeners = commandOptions?.listeners || {};
  listeners.stdout = stdoutListener;
  listeners.stderr = stderrListener;

  const newOptions: exec.ExecOptions = commandOptions || {};
  newOptions.listeners = listeners;

  await run(name, async () => {
    exitStatus = await exec.exec(commandName, commandArgs, newOptions);
  });

  return {
    exitStatus: exitStatus,
    stdout: stdoutString,
    stderr: stderrString,
  }
}

export async function prepareDirectory(): Promise<void> {
  await execRun('Prepare working directory...', 'mkdir', ['-p', workingDirectory]);
}