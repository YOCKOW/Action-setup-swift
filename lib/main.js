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
const xcode = __importStar(require("./xcode"));
const inputSwiftVersion = core.getInput('swift-version');
const inputSwiftPackageDirectory = core.getInput('swift-package-directory') || '.';
const homeDirectory = os.homedir();
const workingDirectory = `${homeDirectory}/action-setup-swift-workspace`;
const repositoriesDirectory = `${workingDirectory}/repositories`;
const swiftenvDirectory = `${repositoriesDirectory}/.swiftenv`;
const swiftenvBinDirectory = `${swiftenvDirectory}/bin`;
const swiftenvPath = `${swiftenvBinDirectory}/swiftenv`;
const cacheActionDirectory = `${repositoriesDirectory}/.cache`;
async function run(name, closure) {
    core.startGroup(name);
    await closure();
    core.endGroup();
}
async function prepare_directory() {
    await run('Prepare working directory...', async () => {
        await exec.exec('mkdir', ['-p', workingDirectory]);
        await exec.exec('mkdir', ['-p', repositoriesDirectory]);
    });
}
async function download_swiftenv() {
    await run('Download swiftenv...', async () => {
        await exec.exec('git', ['clone', '--depth', '1', 'https://github.com/kylef/swiftenv.git', swiftenvDirectory]);
        core.addPath(swiftenvBinDirectory);
        core.exportVariable('SWIFTENV_ROOT', swiftenvDirectory);
    });
}
let _swift_version = '';
async function swift_version() {
    if (!_swift_version) {
        if (inputSwiftVersion) {
            _swift_version = inputSwiftVersion;
        }
        else {
            await run(`Check ".swift-version" file in "${inputSwiftPackageDirectory}".`, async () => {
                let status = await exec.exec('swiftenv', ['local'], {
                    cwd: inputSwiftPackageDirectory,
                    ignoreReturnCode: true,
                    listeners: {
                        stdout: (data) => { _swift_version = data.toString().trim(); }
                    }
                });
                if (status != 0) {
                    throw Error("Swift Version is not specified.");
                }
            });
        }
    }
    return _swift_version;
}
async function download_cache_action() {
    await run('Download acitions/cache', async () => {
        await exec.exec('git', ['clone', '--depth', '1', '-b', 'v1.1.2', 'https://github.com/actions/cache.git', cacheActionDirectory]);
    });
}
function toolchain_directory(swift_version) {
    if (os.platform() == 'darwin') {
        if (/^\d+(\.\d+)+$/.test(swift_version)) {
            return `/Library/Developer/Toolchains/swift-${swift_version}-RELEASE.xctoolchain`;
        }
        else {
            return `/Library/Developer/Toolchains/swift-${swift_version}.xctoolchain`;
        }
    }
    else {
        return `${swiftenvDirectory}/versions/${swift_version}`;
    }
}
const platform_name = (() => {
    let _platform_name = '';
    return async () => {
        if (!_platform_name) {
            if (os.platform() == 'darwin') {
                _platform_name = 'macOS';
            }
            else {
                const status = await exec.exec('lsb_release', ['-cs'], {
                    ignoreReturnCode: true,
                    listeners: {
                        stdout: (data) => { _platform_name = data.toString().trim(); }
                    }
                });
                if (status != 0 || _platform_name == '') {
                    _platform_name = 'unknown';
                }
            }
        }
        return _platform_name;
    };
})();
async function restore_cache(swift_version) {
    await run('Try to resotre cache', async () => {
        process.env['INPUT_PATH'] = toolchain_directory(swift_version);
        process.env['INPUT_KEY'] = `yockow.action.setupswift-${await platform_name()}-${swift_version}`;
        const _ = await Promise.resolve().then(() => __importStar(require(`${cacheActionDirectory}/dist/restore/index.js`)));
    });
}
async function save_cache(swift_version) {
    await run('Try to save cache', async () => {
        process.env['INPUT_PATH'] = toolchain_directory(swift_version);
        process.env['STATE_CACHE_KEY'] = `yockow.action.setupswift-${await platform_name()}-${swift_version}`;
        const _ = await Promise.resolve().then(() => __importStar(require(`${cacheActionDirectory}/dist/save/index.js`)));
    });
}
async function check_swift(swift_version) {
    let installed = false;
    await run('Check whether or not Swift ' + swift_version + ' is already installed.', async () => {
        let status = await exec.exec('swiftenv', ['prefix', swift_version], {
            ignoreReturnCode: true
        });
        installed = (status == 0) ? true : false;
    });
    return installed;
}
async function download_swift(swift_version) {
    await run('Download Swift (via swiftenv)...', async () => {
        await exec.exec(swiftenvPath, ['install', swift_version]);
    });
}
async function switch_swift(swift_version) {
    await run('Switch Swift to ' + swift_version, async () => {
        let swiftPath = '';
        await exec.exec('swiftenv', ['global', swift_version]);
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
            const latestXcodeInfo = await xcode.latestXcode();
            developerDirectory = `${latestXcodeInfo.path}/Contents/Developer`;
        }
        await run(`Switch Developer Directory to ${developerDirectory}`, async () => {
            await exec.exec('sudo xcode-select', ['-switch', developerDirectory]);
        });
    });
}
async function main() {
    await prepare_directory();
    await download_swiftenv();
    let detected_swift_version = await swift_version();
    await download_cache_action();
    await restore_cache(detected_swift_version);
    let installed = await check_swift(detected_swift_version);
    if (installed) {
        core.info(detected_swift_version + ' is already installed.');
    }
    else {
        await download_swift(detected_swift_version);
    }
    await switch_swift(detected_swift_version);
    await save_cache(detected_swift_version);
}
main().catch(error => { core.setFailed(error.message); });
