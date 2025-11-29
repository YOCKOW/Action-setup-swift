import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as os from 'os'
import * as semver from 'semver'
import * as xcode from './xcode'

const inputSwiftVersion: string = core.getInput('swift-version');
const inputSwiftPackageDirectory: string =  core.getInput('swift-package-directory') || '.'

const homeDirectory = os.homedir();
const workingDirectory = `${homeDirectory}/action-setup-swift-workspace`;
const swiftenvDirectory = `${workingDirectory}/.swiftenv`;
const swiftenvBinDirectory = `${swiftenvDirectory}/bin`;
const swiftenvPath = `${swiftenvBinDirectory}/swiftenv`;

async function run(name: string, closure: () => Promise<void> ): Promise<void> {
  core.startGroup(name);
  await closure();
  core.endGroup();
}

async function prepare_directory(): Promise<void> {
  await run('Prepare working directory...', async () => {
    await exec.exec('mkdir', ['-p', workingDirectory]);
  })
}

async function download_swiftenv(): Promise<void> {
  await run('Download swiftenv...', async () => {
    await exec.exec('git', ['clone', '--depth', '1', 'https://github.com/kylef/swiftenv.git', swiftenvDirectory]);
    core.addPath(swiftenvBinDirectory);
    core.exportVariable('SWIFTENV_ROOT', swiftenvDirectory)
  })
}

let _swift_version: string = ''
async function swift_version(): Promise<string> {
  if (!_swift_version) {
    if (inputSwiftVersion) {
      _swift_version = inputSwiftVersion
    } else {
      await run(`Check ".swift-version" file in "${inputSwiftPackageDirectory}".`, async () => {
        let status = await exec.exec('swiftenv', ['local'], {
          cwd: inputSwiftPackageDirectory,
          ignoreReturnCode: true,
          listeners: {
            stdout: (data: Buffer) => { _swift_version = data.toString().trim() }
          }
        })
        if (status != 0) {
          throw Error("Swift Version is not specified.")
        }
      })
    }
  }
  return _swift_version
}

interface XcodeInApplicationsDirectory {
  xcodeInfo: xcode.XcodeInfo
}
type SwiftPath = "not_found" | XcodeInApplicationsDirectory | "another"

let _swift_paths: Map<string, SwiftPath | null> = new Map()
async function swift_path(swift_version: string): Promise<SwiftPath> {
  if (!_swift_paths.has(swift_version)) {
    _swift_paths.set(swift_version, "not_found")
    await run('Check whether or not Swift ' + swift_version + ' is already installed.', async () => {
      // Avoid calling `mdfind` if possible
      let xcodesInAppDir = Array.from((await xcode.installedXcodeApplicationsUnderApplicationsDirectory()).values())
      for (const xcodeInfo of xcodesInAppDir.reverse()) {
        if (await xcodeInfo.swiftVersion() == swift_version) {
          _swift_paths.set(swift_version, { xcodeInfo: xcodeInfo })
          return
        }
      }
      
      let status = await exec.exec('swiftenv', ['prefix', swift_version], {ignoreReturnCode: true});
      if (status == 0) {
        _swift_paths.set(swift_version, "another")
      }
    })
  }
  return _swift_paths.get(swift_version) as SwiftPath
}

async function download_swift(swift_version: string): Promise<void> {
  const __download_swift = async (): Promise<number> => {
    return await exec.exec(
      swiftenvPath,
      ['install', swift_version],
      {
        ignoreReturnCode: true,
      }
    );
  };

  // NOTE: Sometimes `swiftenv install ...` fails owing to curl's error 18 on GitHub Actions.

  const __retryableExitStatus = (status: number): boolean => {
    return (status == 18);
  };

  const commandDesc = `swiftenv install ${swift_version}`;

  await run('Download Swift (via swiftenv)...', async () => {
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
      const failureMessage = `\`${commandDesc}\` failed with exit code ${exitStatus}.`;
      if (__retryableExitStatus(exitStatus)) {
        core.info(failureMessage);
      } else {
        throw new Error(failureMessage);
      }
    }
  })
}

async function switch_swift(swift_version: string): Promise<void> {
  await run('Switch Swift to ' + swift_version, async () => {
    let swiftPath = '';

    const where_swift = await swift_path(swift_version)
    if (typeof where_swift !== 'string') {
      swiftPath = where_swift.xcodeInfo.path + '/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift'
    } else {
      await exec.exec('swiftenv', ['global', swift_version]);
      await exec.exec('swiftenv', ['versions']);
      await exec.exec(swiftenvPath, ['which', 'swift'], {
        listeners: {
          stdout: (data: Buffer) => { swiftPath = data.toString().trim(); }
        }
      });
    }
    let swiftBinDirectory= swiftPath.replace(/\/swift$/, '');
    
    // FIXME: There should be more appropriate way...
    if (os.platform() == 'darwin') {
      // Use release rather than beta
      const betaRegexResult = (new RegExp('^(/.+/Xcode[^/]*)_beta.app')).exec(swiftBinDirectory)
      if (betaRegexResult) {
        core.info("Xcode is beta version.")
        const expectedReleaseVersion = await new xcode.XcodeInfo(betaRegexResult[0]).version()
        const expectedReleasePath = betaRegexResult[1] + '.app'
        const expectedReleaseXcode = new xcode.XcodeInfo(expectedReleasePath)
        if (swift_version == await expectedReleaseXcode.swiftVersion().catch()) {
          core.info(`Xcode release version is found.`)
          swiftBinDirectory = swiftBinDirectory.replace('_beta', '')
        } else {
          const xcodes = Array.from((await xcode.allInstalledXcodeApplications()).values())
          for (let xcodeInfo of xcodes) {
            if (semver.eq(await xcodeInfo.version(), expectedReleaseVersion) && swift_version == await xcodeInfo.swiftVersion()) {
              core.info(`Xcode release version is found.`)
              swiftBinDirectory = xcodeInfo.path + '/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin'
              break
            }
          }
        }
      }

      const xcodePathRegExp = new RegExp('^/Applications/Xcode[^/]*.app/Contents/Developer');
      const xcodeMatched = swiftBinDirectory.match(xcodePathRegExp);
      let developerDirectory = '/Applications/Xcode.app/Contents/Developer'
      if (xcodeMatched && xcodeMatched[0]) {
        developerDirectory = xcodeMatched[0]
      } else {
        const latestXcodeInfo = await xcode.latestXcode();
        developerDirectory = `${latestXcodeInfo.path}/Contents/Developer`
      }
      await run(`Switch Developer Directory to ${developerDirectory}`, async () => {
        await exec.exec('sudo xcode-select', ['-switch', developerDirectory]);
      })
    }
    
    core.addPath(swiftBinDirectory);
  })
}

async function main(): Promise<void> {
  await prepare_directory();
  await download_swiftenv();
  let detected_swift_version = await swift_version()
  let where_swift = await swift_path(detected_swift_version);
  if (where_swift == "not_found") {
    await download_swift(detected_swift_version);
  } else {
    core.info(detected_swift_version + ' is already installed.');
  }
  await switch_swift(detected_swift_version);
}

main().catch(error => { core.setFailed(error.message); })
