/* *************************************************************************************************
 common.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as https from 'https';
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
export async function responseHeader(url) {
    const request = https.request(url, { method: 'HEAD' });
    const response = await new Promise((resolve, reject) => {
        try {
            request.on('response', resolve);
            request.on('error', reject);
            request.end();
        }
        catch (anError) {
            if (anError instanceof Error) {
                reject(anError);
            }
            else {
                reject(new Error(String(anError)));
            }
        }
    });
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
export async function redirectedURL(initialURL, maxRedirectCount = 20) {
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
            }
            else {
                currentURL = new URL(location, currentURL);
            }
        }
        else {
            break REDIRECTING;
        }
    }
    return currentURL;
}
export async function download(url, path, maxRedirectCount = 20) {
    const finalDestination = await redirectedURL(url, maxRedirectCount);
    const localFile = fs.createWriteStream(path);
    await new Promise((resolve, reject) => {
        const request = https.request(finalDestination, (response) => {
            response.pipe(localFile);
            response.on("close", () => {
                localFile.close();
                resolve();
            });
            response.on("error", (anError) => {
                localFile.close();
                reject(anError);
            });
        });
        request.end();
    });
}
