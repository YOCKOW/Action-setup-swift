import * as exec from '@actions/exec';
import * as os from 'os'
import * as semver from 'semver'
import SemVer = semver.SemVer

type XcodeInfo = {
  path: string,
  version: SemVer
};

async function _semanticVersionOfXcodeForPath(path: string): Promise<SemVer> {
  let versionString = ''
  await exec.exec('defaults', ['read', `${path}/Contents/Info`, 'CFBundleShortVersionString'], {
    listeners: {
      stdout: (data: Buffer) => { versionString = data.toString().trim() }
    }
  })
  if ((/^\d+\.\d+$/).test(versionString)) { versionString += '.0'; }
  let ver = semver.parse(versionString)
  if (ver == null) {
    throw "Invalid Version String."
  }
  return ver
}

let _xcode_info_list: XcodeInfo[] = []
export async function installedXcodeApplications(): Promise<XcodeInfo[]> {
  if (os.platform() == 'darwin' && _xcode_info_list.length < 1) {
    let paths: string[] = [];
    await exec.exec('mdfind', ['kMDItemCFBundleIdentifier == "com.apple.dt.Xcode"'], {
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          paths = data.toString().split(/\r\n|\r|\n/).map(path => path.trim()).filter(path => path != '');
        }
      }
    })

    for (let ii = 0;ii < paths.length;ii++) {
      const version = await _semanticVersionOfXcodeForPath(paths[ii]);
      const info: XcodeInfo = { path: paths[ii], version: version };
      // core.info(`The version of Xcode at "${info.path}" is ${info.version}.`);
      _xcode_info_list.push(info);
    }
  }
  return _xcode_info_list
}

export async function swiftVersionForXcode(xcode: XcodeInfo): Promise<string> {
  let swiftVersionString = ''
  await exec.exec('xcrun', ['swift', '--version'], {
    env: {
      'DEVELOPER_DIR': xcode.path,
    },
    listeners: {
      stdout: (data: Buffer) => { swiftVersionString = data.toString().trim(); }
    }
  });
  const result = (new RegExp('Swift version (\\d+(?:\\.\\d+)+)')).exec(swiftVersionString)
  if (!result) {
    throw Error(`Swift Version cannot be detected for ${xcode.path}`)
  }
  return result[1]
}

export async function latestXcode(): Promise<XcodeInfo> {
  const list = await installedXcodeApplications();
  let latest: XcodeInfo | null = null;
  list.forEach((info) => {
    if (!latest || semver.gt(info.version, latest.version)) { latest = info; }
  })
  if (latest == null) {
    throw "Cant't detect latest Xcode."
  }
  return latest;
}