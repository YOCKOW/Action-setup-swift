/* *************************************************************************************************
 common.ts
   © 2026 YOCKOW.
     Licensed under MIT License.
     See "LICENSE.txt" for more information.
 ************************************************************************************************ */

import * as core from '@actions/core';
import * as actionsExec from '@actions/exec';
import * as fs from 'fs';
import { IncomingHttpHeaders, IncomingMessage } from 'http';
import * as https from 'https';
import * as os from 'os';

// ----- Constants ----- //

export type Optional<Wrapped> = Wrapped | undefined;
export const nil = void 0;

/** Default installer. */
export const defaultSwiftInstaller: string = "swiftenv";

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

// ----- Type Guards ----- //

export type TypeGuard<T> = (something: unknown) => something is T;
export type TypeName = "undefined" | "number" | "string" | "boolean" | "bigint" | "symbol" | "object" |  "function";

function _isType(value: unknown, type: TypeName): boolean {
  if (type == "undefined" && value === nil) {
    return true;
  }
  return (value !== nil && typeof value == type);
}

export const isUndefined: TypeGuard<undefined> = (value: unknown): value is undefined => {
  return _isType(value, "undefined");
};

export const isObject: TypeGuard<object> = (value: unknown): value is object => {
  return (typeof value === "object" && value !== null) ? true : false;
}

export const isArray: TypeGuard<Array<unknown>> = (value: unknown): value is Array<unknown> => {
  return isObject(value) && Array.isArray(value);
}

export const isBigInt: TypeGuard<bigint> = (value: unknown): value is bigint => {
  return _isType(value, "bigint");
};

export const isBoolean: TypeGuard<boolean> = (value: unknown): value is boolean => {
  return _isType(value, "boolean");
}

export const isNumber: TypeGuard<number> = (value: unknown): value is number => {
  return _isType(value, "number");
};

export const isString: TypeGuard<string> = (value: unknown): value is string => {
  return _isType(value, "string");
};

export const isStringArray: TypeGuard<Array<string>> = (value: unknown): value is Array<string> => {
  if (!isArray(value)) {
    return false;
  }
  return value.every(elem => isString(elem));
}

// ----- Functions ----- //

export function map<T, U>(optionalValue: Optional<T>, transform: (wrapped: T) => U): Optional<U> {
  if (isUndefined(optionalValue)) {
    return nil;
  }
  return transform(optionalValue);
}

export async function info(message: string, marker: "ℹ️" | "✅" = "ℹ️") {
  await navigator.locks.request("common.info", () => {
    const lines = message.trimEnd().split(/\r|\n|\r\n/);
    core.info(`${marker} ${lines[0]}`);
    for (let ii = 1; ii < lines.length; ii++) {
      core.info(`   ${lines[ii]}`);
    }
  });
}

export function warn(message: string) {
  core.warning(`⚠️ ${message}`);
}

export function extractSwiftVersionFromCommandOutput(output: string): Optional<string> {
  const result = (new RegExp('Swift version (\\d+(?:\\.\\d+)+)')).exec(output);
  return result?.[1];
}

export type CommandResult = {
  exitStatus: number,
  stdout: string,
  stderr: string,
};

/**
 * @param jobName - The name of the job.
 * @param commandName - Command to execute.
 * @param commandArgs - (Optional) Arguments for the command.
 * @param commandOptions - (Optional) Optional options for the command.
 * @returns The result of the command.
 */
export async function exec(
  jobName: string,
  commandName: string,
  commandArgs: string[],
  commandOptions: actionsExec.ExecOptions
): Promise<CommandResult>;
export async function exec(
  jobName: string, 
  commandName: string,
  commandArgs: string[]
): Promise<CommandResult>;
export async function exec(
  jobName: string,
  commandName: string,
  commandOptions: actionsExec.ExecOptions
): Promise<CommandResult>;
export async function exec(
  jobName: string,
  commandName: string,
): Promise<CommandResult>;
export async function exec(
  commandName: string,
  commandArgs: string[],
  commandOptions: actionsExec.ExecOptions
): Promise<CommandResult>;
export async function exec(
  commandName: string,
  commandArgs: string[],
): Promise<CommandResult>;
export async function exec(
  commandName: string,
  commandOptions: actionsExec.ExecOptions
): Promise<CommandResult>;
export async function exec(
  commandName: string,
): Promise<CommandResult>;
export async function exec(jobNameOrCommandName: string, ...otherArguments: unknown[]): Promise<CommandResult> {
  interface __Arguments {
    jobName: string | undefined;
    commandName: string;
    commandArgs: string[] | undefined;
    commandOptions: actionsExec.ExecOptions | undefined;
  }

  if (otherArguments.length > 3) {
    throw new Error("Unexpected number of arguments?!");
  }

  const arg0 = jobNameOrCommandName;
  const arg1: unknown = (otherArguments.length >= 1) ? otherArguments[0] : nil;
  const arg2: unknown = (otherArguments.length >= 2) ? otherArguments[1] : nil;
  const arg3: unknown = (otherArguments.length >= 3) ? otherArguments[2] : nil;

  const isObjectNotArray: TypeGuard<object> = (something): something is object => {
    return isObject(something) && !isArray(something);
  };

  const __types = <T0, T1, T2, T3>(
    tg0: TypeGuard<T0>,
    tg1: Optional<TypeGuard<T1>>,
    tg2: Optional<TypeGuard<T2>>,
    tg3: Optional<TypeGuard<T3>>
  ): boolean => {
    const __is = <T>(tg: Optional<TypeGuard<T>>, something: unknown): boolean => {
      if (isUndefined(tg)) {
        return isUndefined(something);
      }
      return tg(something);
    }
    return __is(tg0, arg0) && __is(tg1, arg1) && __is(tg2, arg2) && __is(tg3, arg3);
  };

  const actualArguments: __Arguments = ((): __Arguments => {
    if (__types(isString, isString, isStringArray, isObjectNotArray)) {
      return {
        jobName: arg0,
        commandName: arg1 as string,
        commandArgs: arg2 as string[],
        commandOptions: arg3 as object,
      };
    }
    if (__types(isString, isString, isStringArray, nil)) {
      return {
        jobName: arg0,
        commandName: arg1 as string,
        commandArgs: arg2 as string[],
        commandOptions: nil,
      };
    }
    if (__types(isString, isString, isObjectNotArray, nil)) {
      return {
        jobName: arg0,
        commandName: arg1 as string,
        commandArgs: nil,
        commandOptions: arg2 as object,
      };
    }
    if (__types(isString, isString, nil, nil)) {
      return {
        jobName: arg0,
        commandName: arg1 as string,
        commandArgs: nil,
        commandOptions: nil,
      };
    }
    if (__types(isString, isStringArray, isObjectNotArray, nil)) {
      return {
        jobName: nil,
        commandName: arg0,
        commandArgs: arg1 as string[],
        commandOptions: arg2 as object,
      };
    }
    if (__types(isString, isStringArray, nil, nil)) {
      return {
        jobName: nil,
        commandName: arg0,
        commandArgs: arg1 as string[],
        commandOptions: nil,
      };
    }
    if (__types(isString, isObjectNotArray, nil, nil)) {
      return {
        jobName: nil,
        commandName: arg0,
        commandArgs: nil,
        commandOptions: arg1 as object,
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
  })()

  /**  For displaying purpose only. */
  const __shellEscape = (aString: string): string => {
    // eslint-disable-next-line @typescript-eslint/no-misused-spread
    const uniChars = [...aString];
    let result = "";
    uniChars.forEach((uniChar) => {
      const codePoint = uniChar.charCodeAt(0);
      if (
        codePoint <= 0x2A ||
        (0x3B <= codePoint && codePoint <= 0x3F) ||
        (0x5B <= codePoint && codePoint <= 0x5D) ||
        codePoint == 0x60 ||
        (0x7B <= codePoint && codePoint <= 0x7D)
      ) {
        result += `\\${uniChar}`;
      } else {
        result += uniChar;
      }
    });
    return result;
  };

  const jobName = actualArguments.jobName;
  const commandName = actualArguments.commandName;
  const commandArgs = actualArguments.commandArgs;
  const commandOptions = actualArguments.commandOptions;

  const __commandDescription = (): string => {
    let result = commandName;
    if (!isUndefined(commandArgs)) {
      result += " " + commandArgs.map(__shellEscape).join(' ');
    }
    return result;
  };

  const jobNameForMessage =(
    (isUndefined(jobName) || jobName.length < 1) ? ("`" + __commandDescription() + "`")
    : `'${jobName}'`
  );

  let startingMessage = `Executing ${jobNameForMessage}`;

  map(commandOptions, (opts) => {
    startingMessage += "\n  With some options.\n";
    map(opts.ignoreReturnCode, (ignoreReturnCode) => {
      startingMessage += `    Ignore Return Code: ${ignoreReturnCode ? 'true' : 'false'}\n`;
    });
    map(opts.cwd, (cwd) => {
      startingMessage += `    Current Working Directory (CWD): ${cwd}\n`;
    });
    map(opts.env, (env) => {
      startingMessage += `    Environment Variables:\n`
      for (const [name, value] of Object.entries(env)) {
        startingMessage += `      ${name}: ${value}\n`;
      }
    });
  });

  await info(startingMessage);

  let stdoutString: string = '';
  let stderrString: string = '';

  const originalStdoutListener = commandOptions?.listeners?.stdout;
  const stdoutListener = (data: Buffer): void => {
    stdoutString = data.toString().trimEnd();
    originalStdoutListener?.call(null, data);
  };

  const originalStderrListener = commandOptions?.listeners?.stderr;
  const stderrListener = (data: Buffer): void => {
    stderrString = data.toString().trimEnd();
    originalStderrListener?.call(null, data);
  };

  const listeners: actionsExec.ExecListeners = commandOptions?.listeners || {};
  listeners.stdout = stdoutListener;
  listeners.stderr = stderrListener;

  const newOptions: actionsExec.ExecOptions = commandOptions || {};
  newOptions.listeners = listeners;

  const exitStatus = await actionsExec.exec(commandName, commandArgs, newOptions);

  await info(`Finished ${jobNameForMessage} (Exit status: ${exitStatus.toString()})`, "✅");

  return {
    exitStatus: exitStatus,
    stdout: stdoutString,
    stderr: stderrString,
  }
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

export async function redirectedURL(
  initialURL: URL,
  maxRedirectCount: number = 20,
  requireStatusIsOK: boolean = true
): Promise<URL> {
  let currentCount = 0;
  let currentURL = initialURL;
  REDIRECTING: while (true) {
    const currentResponseHeader = await responseHeader(currentURL);
    const statusCode = currentResponseHeader.statusCode;
    const statusCategory = Math.floor(statusCode / 100);
    if (statusCode == 201 || statusCategory == 3) {
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
      if (requireStatusIsOK && statusCategory != 2) {
        let errorMessage = `HTTP Status ${statusCode.toString()}`
        if (!isUndefined(currentResponseHeader.reasonPhrase)) {
          errorMessage += ` (${currentResponseHeader.reasonPhrase})`;
        }
        throw new Error(errorMessage);
      }
      break REDIRECTING;
    }
  }
  return currentURL;
}

export async function download(url: URL, path: string, maxRedirectCount: number = 20): Promise<void> {
  const finalDestination = await redirectedURL(url, maxRedirectCount, /* requireStatusIsOK */ true);
  if (url.href != finalDestination.href) {
    await info(`download: Redirected from ${url.toString()}\n` +
               `                     to   ${finalDestination.toString()}`);
  }

  await info(`Download file from ${finalDestination.toString()}\n` +
             `              to   ${path}`);
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
  await info(`File has been downloaded from ${finalDestination.toString()}`, "✅");
}


export const aptInstall: (...packages: string[]) => Promise<void> = (() => {
  let updated = false;
  return async (...packages: string[]): Promise<void> => {
    if (osIsDarwin) {
      throw new Error("Called on Darwin?!");
    }

    await navigator.locks.request("apt-get update", async () => {
      if (updated) {
        return;
      }
      await exec("sudo apt-get", ["update"]);
      updated = true;
    });

    await exec(
      `Install ${packages.join(', ')}`,
      "sudo apt-get",
      [
        "install",
        "-y",
        "--no-install-recommends",
        ...packages,
      ]
    );
  };
})();
