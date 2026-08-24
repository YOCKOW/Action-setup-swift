/* *************************************************************************************************
 common.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import { IncomingHttpHeaders, IncomingMessage } from 'http';
import * as https from 'https';
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

export interface ResponseHeader {
  statusCode: number;
  reasonPhrase: string | undefined;
  fields: IncomingHttpHeaders;
}
export async function responseHeader(url: URL): Promise<ResponseHeader> {
  const request = https.request(url, {method: 'HEAD'});
  const response = await new Promise(
    (resolve: (response: IncomingMessage) => void, reject: (anError: Error) => void) => {
      try {
        request.on('response', resolve);
        request.on('error', reject);
        request.end();
      } catch (anError) {
        if (anError instanceof Error) {
          reject(anError);
        } else {
          reject(new Error(String(anError)));
        }
      }
    }
  );
  
  const statusCode = response.statusCode;
  if (typeof statusCode == 'undefined') {
    throw new Error(`Missing status code. URL=${url}`);
  }
  return {
    statusCode: statusCode,
    reasonPhrase: response.statusMessage,
    fields: response.headers,
  };
}

export async function redirectedURL(initialURL: URL, maxRedirectCount: number = 20): Promise<URL> {
  let currentCount = 0;
  let currentURL = initialURL;
  REDIRECTING: while (true) {
    const currentResponseHeader = await responseHeader(currentURL);
    if (currentResponseHeader.statusCode == 201 || Math.floor(currentResponseHeader.statusCode / 100) == 3) {
      const location = currentResponseHeader.fields.location;
      if (typeof location == 'undefined') {
        throw new Error(`Missing 'Location' header field for ${currentURL}`);
      }

      currentCount += 1;
      if (currentCount > maxRedirectCount) {
        throw new Error(`Too many redirects from ${initialURL}`);
      }

      if ((/^https?:\/\//).test(location)) {
        currentURL = new URL(location);
      } else {
        currentURL = new URL(location, currentURL);
      }
    } else {
      break REDIRECTING;
    }
  }
  return currentURL;
}

export async function download(url: URL, path: string, maxRedirectCount: number = 20): Promise<void> {
  const finalDestination = await redirectedURL(url, maxRedirectCount);
  const localFile = fs.createWriteStream(path);
  await new Promise<void>((resolve, reject) => {
    const request = https.request(finalDestination, (response) => {
      response.pipe(localFile);
      response.on("close", () => {
        localFile.close();
        resolve();
      })
      response.on("error", (anError: Error) => {
        localFile.close();
        reject(anError);
      })
    });
    request.end();
  });
}