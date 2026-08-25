/* *************************************************************************************************
 common.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */
import * as core from '@actions/core';
import * as actionsExec from '@actions/exec';
import * as fs from 'fs';
import * as https from 'https';
import * as os from 'os';
export const nil = void 0;
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
function _isType(value, type) {
    if (type == "undefined" && value === nil) {
        return true;
    }
    return (value !== nil && typeof value == type);
}
export const isUndefined = (value) => {
    return _isType(value, "undefined");
};
export const isObject = (value) => {
    return (typeof value === "object" && value !== null) ? true : false;
};
export const isArray = (value) => {
    return isObject(value) && Array.isArray(value);
};
export const isBigInt = (value) => {
    return _isType(value, "bigint");
};
export const isBoolean = (value) => {
    return _isType(value, "boolean");
};
export const isNumber = (value) => {
    return _isType(value, "number");
};
export const isString = (value) => {
    return _isType(value, "string");
};
export const isStringArray = (value) => {
    if (!isArray(value)) {
        return false;
    }
    return value.every(elem => isString(elem));
};
// ----- Functions ----- //
export function info(message) {
    const lines = message.split(/\r|\n|\r\n/);
    core.info(`ℹ️ ${lines[0]}`);
    for (let ii = 1; ii < lines.length; ii++) {
        core.info(`   ${lines[ii]}`);
    }
}
export async function exec(jobNameOrCommandName, ...otherArguments) {
    if (otherArguments.length > 3) {
        throw new Error("Unexpected number of arguments?!");
    }
    const arg0 = jobNameOrCommandName;
    const arg1 = (otherArguments.length >= 1) ? otherArguments[0] : nil;
    const arg2 = (otherArguments.length >= 2) ? otherArguments[1] : nil;
    const arg3 = (otherArguments.length >= 3) ? otherArguments[2] : nil;
    const isObjectNotArray = (something) => {
        return isObject(something) && !isArray(something);
    };
    const __types = (tg0, tg1, tg2, tg3) => {
        const __is = (tg, something) => {
            if (isUndefined(tg)) {
                return isUndefined(something);
            }
            return tg(something);
        };
        return __is(tg0, arg0) && __is(tg1, arg1) && __is(tg2, arg2) && __is(tg3, arg3);
    };
    const actualArguments = (() => {
        if (__types(isString, isString, isStringArray, isObjectNotArray)) {
            return {
                jobName: arg0,
                commandName: arg1,
                commandArgs: arg2,
                commandOptions: arg3,
            };
        }
        if (__types(isString, isString, isStringArray, nil)) {
            return {
                jobName: arg0,
                commandName: arg1,
                commandArgs: arg2,
                commandOptions: nil,
            };
        }
        if (__types(isString, isString, isObjectNotArray, nil)) {
            return {
                jobName: arg0,
                commandName: arg1,
                commandArgs: nil,
                commandOptions: arg2,
            };
        }
        if (__types(isString, isString, nil, nil)) {
            return {
                jobName: arg0,
                commandName: arg1,
                commandArgs: nil,
                commandOptions: nil,
            };
        }
        if (__types(isString, isStringArray, isObjectNotArray, nil)) {
            return {
                jobName: nil,
                commandName: arg0,
                commandArgs: arg1,
                commandOptions: arg2,
            };
        }
        if (__types(isString, isStringArray, nil, nil)) {
            return {
                jobName: nil,
                commandName: arg0,
                commandArgs: arg1,
                commandOptions: nil,
            };
        }
        if (__types(isString, isObjectNotArray, nil, nil)) {
            return {
                jobName: nil,
                commandName: arg0,
                commandArgs: nil,
                commandOptions: arg1,
            };
        }
        if (__types(isString, nil, nil, nil)) {
            return {
                jobName: nil,
                commandName: arg0,
                commandArgs: nil,
                commandOptions: nil,
            };
        }
        throw new Error(`Unexpected type(s) of arguments?! (The number of arguments: ${arguments.length.toString()})`);
    })();
    /**  For displaying purpose only. */
    const __shellEscape = (aString) => {
        // eslint-disable-next-line @typescript-eslint/no-misused-spread
        const uniChars = [...aString];
        let result = "";
        uniChars.forEach((uniChar) => {
            const codePoint = uniChar.charCodeAt(0);
            if (codePoint <= 0x2A ||
                (0x3B <= codePoint && codePoint <= 0x3F) ||
                (0x5B <= codePoint && codePoint <= 0x5D) ||
                codePoint == 0x60 ||
                (0x7B <= codePoint && codePoint <= 0x7D)) {
                result += `\\${uniChar}`;
            }
            else {
                result += uniChar;
            }
        });
        return result;
    };
    const jobName = actualArguments.jobName;
    const commandName = actualArguments.commandName;
    const commandArgs = actualArguments.commandArgs;
    const commandOptions = actualArguments.commandOptions;
    const __commandDescription = () => {
        let result = commandName;
        if (!isUndefined(commandArgs)) {
            result += " " + commandArgs.map(__shellEscape).join(' ');
        }
        return result;
    };
    if (isUndefined(jobName) || jobName.length < 1) {
        info(`Executing ${__commandDescription()}`);
    }
    else {
        info(`Executing '${jobName}'...`);
    }
    let stdoutString = '';
    let stderrString = '';
    const originalStdoutListener = commandOptions?.listeners?.stdout;
    const stdoutListener = (data) => {
        stdoutString = data.toString().trimEnd();
        originalStdoutListener?.call(null, data);
    };
    const originalStderrListener = commandOptions?.listeners?.stderr;
    const stderrListener = (data) => {
        stderrString = data.toString().trimEnd();
        originalStderrListener?.call(null, data);
    };
    const listeners = commandOptions?.listeners || {};
    listeners.stdout = stdoutListener;
    listeners.stderr = stderrListener;
    const newOptions = commandOptions || {};
    newOptions.listeners = listeners;
    const exitStatus = await actionsExec.exec(commandName, commandArgs, newOptions);
    return {
        exitStatus: exitStatus,
        stdout: stdoutString,
        stderr: stderrString,
    };
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
            if (typeof response.statusCode !== 'number' || Math.floor(response.statusCode / 100) != 2) {
                const reasonDesc = ((isUndefined(response.statusCode)) ? "Unexpected error"
                    : (isUndefined(response.statusMessage)) ? `HTTP status ${response.statusCode.toString()}`
                        : `HTTP status ${response.statusCode.toString()} (${response.statusMessage})`);
                throw new Error(`Download failed: ${reasonDesc}`);
            }
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
