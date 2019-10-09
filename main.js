"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const os = __importStar(require("os"));
const semver = __importStar(require("semver"));
const swiftVersion = core.getInput('swift-version');
const workingDirectory = '$HOME/action-setup-swift';
const swiftenvDirectory = `${workingDirectory}/.swiftenv`;
const swiftenvBinDirectory = `${swiftenvDirectory}/bin`;
const swiftenvPath = `${swiftenvBinDirectory}/swiftenv`;
async function run(name, closure) {
    core.startGroup(name);
    await closure();
    core.endGroup();
}
async function prepare_directory() {
    await run('Prepare working directory...', async () => {
        await exec.exec('mkdir', ['-p', workingDirectory]);
    });
}
async function download_swiftenv() {
    await run('Download swiftenv...', async () => {
        await exec.exec('git', ['clone', 'https://github.com/kylef/swiftenv.git', swiftenvDirectory]);
        core.addPath(swiftenvBinDirectory);
    });
}
async function check_swift() {
    let installed = false;
    await run('Check whether or not Swift ' + swiftVersion + ' is already installed.', async () => {
        let status = await exec.exec('swiftenv', ['prefix', swiftVersion], {
            ignoreReturnCode: true
        });
        installed = (status == 0) ? true : false;
    });
    return installed;
}
async function download_swift() {
    await run('Downlod Swift (via swiftenv)...', async () => {
        await exec.exec(swiftenvPath, ['install', swiftVersion]);
    });
}
async function semantic_version_of_xcode_for_path(path) {
    let versionString = '';
    await exec.exec('defaults', ['read', `${path}/Contents/Info`, 'CFBundleShortVersionString'], {
        listeners: {
            stdout: (data) => { versionString = data.toString().trim(); }
        }
    });
    if ((/^\d+\.\d+$/).test(versionString)) {
        versionString += '.0';
    }
    return semver.parse(versionString, true);
}
let _xcode_info_list = [];
async function xcode_info_list() {
    if (_xcode_info_list.length < 1) {
        await run('Search Installed Xcode Applications...', async () => {
            let paths = [];
            await exec.exec('mdfind', ["kMDItemCFBundleIdentifier == \"com.apple.dt.Xcode\""], {
                ignoreReturnCode: true,
                listeners: {
                    stdout: (data) => {
                        paths = data.toString().split(/\r\n|\r|\n/).map(path => path.trim()).filter(path => path != '');
                    }
                }
            });
            for (let ii = 0; ii < paths.length; ii++) {
                const version = await semantic_version_of_xcode_for_path(paths[ii]);
                const info = { path: paths[ii], version: version };
                // core.info(`The version of Xcode at "${info.path}" is ${info.version}.`);
                _xcode_info_list.push(info);
            }
        });
    }
    return _xcode_info_list;
}
async function latest_xcode_info() {
    const list = await xcode_info_list();
    let latest = null;
    list.forEach((info) => {
        if ((info.version) && (!latest || semver.gt(info.version, latest.version))) {
            latest = info;
        }
    });
    return latest;
}
async function switch_swift() {
    await run('Switch Swift to ' + swiftVersion, async () => {
        let swiftPath = '';
        await exec.exec('swiftenv', ['global', swiftVersion]);
        await exec.exec('swiftenv', ['versions']);
        await exec.exec(swiftenvPath, ['which', 'swift'], {
            listeners: {
                stdout: (data) => { swiftPath = data.toString().trim(); }
            }
        });
        const swiftBinDirectory = swiftPath.replace(/\/swift$/, '');
        core.addPath(swiftBinDirectory);
        // FIXME: There should be more appropriate way...
        if (os.platform() != 'darwin') {
            return;
        }
        const xcodePathRegExp = new RegExp('^/Applications/Xcode[^/]*.app/Contents/Developer');
        const xcodeMatched = swiftBinDirectory.match(xcodePathRegExp);
        let developerDirectory = '/Applications/Xcode.app/Contents/Developer';
        if (xcodeMatched && xcodeMatched[0]) {
            developerDirectory = xcodeMatched[0];
        }
        else {
            const latestXcodeInfo = await latest_xcode_info();
            if (latestXcodeInfo) {
                developerDirectory = `${latestXcodeInfo.path}/Contents/Developer`;
            }
        }
        await run(`Switch Developer Directory to ${developerDirectory}`, async () => {
            await exec.exec('sudo xcode-select', ['-switch', developerDirectory]);
        });
    });
}
async function main() {
    await prepare_directory();
    await download_swiftenv();
    let installed = await check_swift();
    if (installed) {
        core.info(swiftVersion + ' is already installed.');
    }
    else {
        await download_swift();
    }
    await switch_swift();
}
main().catch(error => { core.setFailed(error.message); });
