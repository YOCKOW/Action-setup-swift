"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const os = __importStar(require("os"));
const semver = __importStar(require("semver"));
const xcode = __importStar(require("./xcode"));
const inputSwiftVersion = core.getInput('swift-version');
const inputSwiftPackageDirectory = core.getInput('swift-package-directory') || '.';
const homeDirectory = os.homedir();
const workingDirectory = `${homeDirectory}/action-setup-swift-workspace`;
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
let _swift_paths = new Map();
async function swift_path(swift_version) {
    if (!_swift_paths.has(swift_version)) {
        _swift_paths.set(swift_version, "not_found");
        await run('Check whether or not Swift ' + swift_version + ' is already installed.', async () => {
            // Avoid calling `mdfind` if possible
            let xcodesInAppDir = Array.from((await xcode.installedXcodeApplicationsUnderApplicationsDirectory()).values());
            for (const xcodeInfo of xcodesInAppDir.reverse()) {
                if (await xcodeInfo.swiftVersion() == swift_version) {
                    _swift_paths.set(swift_version, { xcodeInfo: xcodeInfo });
                    return;
                }
            }
            let status = await exec.exec('swiftenv', ['prefix', swift_version], { ignoreReturnCode: true });
            if (status == 0) {
                _swift_paths.set(swift_version, "another");
            }
        });
    }
    return _swift_paths.get(swift_version);
}
async function download_swift(swift_version) {
    await run('Download Swift (via swiftenv)...', async () => {
        await exec.exec(swiftenvPath, ['install', swift_version]);
    });
}
async function switch_swift(swift_version) {
    await run('Switch Swift to ' + swift_version, async () => {
        let swiftPath = '';
        const where_swift = await swift_path(swift_version);
        if (typeof where_swift !== 'string') {
            swiftPath = where_swift.xcodeInfo.path + '/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin/swift';
        }
        else {
            await exec.exec('swiftenv', ['global', swift_version]);
            await exec.exec('swiftenv', ['versions']);
            await exec.exec(swiftenvPath, ['which', 'swift'], {
                listeners: {
                    stdout: (data) => { swiftPath = data.toString().trim(); }
                }
            });
        }
        let swiftBinDirectory = swiftPath.replace(/\/swift$/, '');
        // FIXME: There should be more appropriate way...
        if (os.platform() == 'darwin') {
            // Use release rather than beta
            const betaRegexResult = (new RegExp('^(/.+/Xcode[^/]*)_beta.app')).exec(swiftBinDirectory);
            if (betaRegexResult) {
                core.info("Xcode is beta version.");
                const expectedReleaseVersion = await new xcode.XcodeInfo(betaRegexResult[0]).version();
                const expectedReleasePath = betaRegexResult[1] + '.app';
                const expectedReleaseXcode = new xcode.XcodeInfo(expectedReleasePath);
                if (swift_version == await expectedReleaseXcode.swiftVersion().catch()) {
                    core.info(`Xcode release version is found.`);
                    swiftBinDirectory = swiftBinDirectory.replace('_beta', '');
                }
                else {
                    const xcodes = Array.from((await xcode.allInstalledXcodeApplications()).values());
                    for (let xcodeInfo of xcodes) {
                        if (semver.eq(await xcodeInfo.version(), expectedReleaseVersion) && swift_version == await xcodeInfo.swiftVersion()) {
                            core.info(`Xcode release version is found.`);
                            swiftBinDirectory = xcodeInfo.path + '/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin';
                            break;
                        }
                    }
                }
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
        }
        core.addPath(swiftBinDirectory);
    });
}
async function main() {
    await prepare_directory();
    await download_swiftenv();
    let detected_swift_version = await swift_version();
    let where_swift = await swift_path(detected_swift_version);
    if (where_swift == "not_found") {
        await download_swift(detected_swift_version);
    }
    else {
        core.info(detected_swift_version + ' is already installed.');
    }
    await switch_swift(detected_swift_version);
}
main().catch(error => { core.setFailed(error.message); });
