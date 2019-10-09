import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as os from 'os'
import * as semver from 'semver'
import SemVer = semver.SemVer

const swiftVersion: string = core.getInput('swift-version');
const workingDirectory = '$HOME/action-setup-swift'
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
    await exec.exec('git', ['clone', 'https://github.com/kylef/swiftenv.git', swiftenvDirectory]);
    core.addPath(swiftenvBinDirectory);
  })
}

async function check_swift(): Promise<boolean> {
  let installed = false;
  await run('Check whether or not Swift ' + swiftVersion + ' is already installed.', async () => {
    let status = await exec.exec('swiftenv', ['prefix', swiftVersion], {
                                  ignoreReturnCode: true
                                 });
    installed = (status == 0) ? true : false;
  })
  return installed;
}

async function download_swift(): Promise<void> {
  await run('Downlod Swift (via swiftenv)...', async () => {
    await exec.exec(swiftenvPath, ['install', swiftVersion]);
  })
}

type XcodeInfo = {
  path: string,
  version: SemVer | null
};

async function semantic_version_of_xcode_for_path(path: string): Promise<SemVer | null> {
  let versionString = ''
  await exec.exec('defaults', ['read', `${path}/Contents/Info`, 'CFBundleShortVersionString'], {
    listeners: {
      stdout: (data: Buffer) => { versionString = data.toString().trim() }
    }
  })
  if ((/^\d+\.\d+$/).test(versionString)) { versionString += '.0'; }
  return semver.parse(versionString, true)
}

let _xcode_info_list: XcodeInfo[] = []
async function xcode_info_list(): Promise<XcodeInfo[]> {
  if (_xcode_info_list.length < 1) {
    await run('Search Installed Xcode Applications...', async () => {
      let paths: string[] = [];
      await exec.exec('mdfind', ["kMDItemCFBundleIdentifier == \"com.apple.dt.Xcode\""], {
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            paths = data.toString().split(/\r\n|\r|\n/).map(path => path.trim()).filter(path => path != '');
          }
        }
      })

      for (let ii = 0;ii < paths.length;ii++) {
        const version = await semantic_version_of_xcode_for_path(paths[ii]);
        const info: XcodeInfo = { path: paths[ii], version: version };
        // core.info(`The version of Xcode at "${info.path}" is ${info.version}.`);
        _xcode_info_list.push(info);
      }
    })
  }
  return _xcode_info_list
}

async function latest_xcode_info(): Promise<XcodeInfo | null> {
  const list = await xcode_info_list();
  let latest: XcodeInfo | null = null;
  list.forEach((info) => {
    if ((info.version) && (!latest || semver.gt(info.version, latest.version as SemVer))) {
      latest = info;
    }
  })
  return latest;
}

async function switch_swift(): Promise<void> {
  await run('Switch Swift to ' + swiftVersion, async () => {
    let swiftPath = '';
    await exec.exec('swiftenv', ['global', swiftVersion]);
    await exec.exec('swiftenv', ['versions']);
    await exec.exec(swiftenvPath, ['which', 'swift'], {
      listeners: {
        stdout: (data: Buffer) => { swiftPath = data.toString().trim(); }
      }
    });
    const swiftBinDirectory= swiftPath.replace(/\/swift$/, '');
    core.addPath(swiftBinDirectory);
    
    // FIXME: There should be more appropriate way...
    if (os.platform() != 'darwin') { return; }
    const xcodePathRegExp = new RegExp('^/Applications/Xcode[^/]*.app/Contents/Developer');
    const xcodeMatched = swiftBinDirectory.match(xcodePathRegExp);
    let developerDirectory = '/Applications/Xcode.app/Contents/Developer'
    if (xcodeMatched && xcodeMatched[0]) {
      developerDirectory = xcodeMatched[0]
    } else {
      const latestXcodeInfo = await latest_xcode_info();
      if (latestXcodeInfo) {
        developerDirectory = `${latestXcodeInfo.path}/Contents/Developer`
      }
    }
    await run(`Switch Developer Directory to ${developerDirectory}`, async () => {
      await exec.exec('sudo xcode-select', ['-switch', developerDirectory]);
    })
  })
}

async function main(): Promise<void> {
  await prepare_directory();
  await download_swiftenv();
  let installed = await check_swift();
  if (installed) {
    core.info(swiftVersion + ' is already installed.');
  } else {
    await download_swift();
  }
  await switch_swift();
}

main().catch(error => { core.setFailed(error.message); })
