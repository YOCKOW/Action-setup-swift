"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
exports.latestXcode = exports.allInstalledXcodeApplications = exports.installedXcodeApplicationsUnderApplicationsDirectory = exports.XcodeInfo = void 0;
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const semver = __importStar(require("semver"));
class XcodeInfo {
    constructor(path) {
        this._version = null;
        this._swiftVersion = null;
        this.path = path;
    }
    async version() {
        if (!this._version) {
            let versionString = '';
            await exec.exec('defaults', ['read', `${this.path}/Contents/Info`, 'CFBundleShortVersionString'], {
                listeners: {
                    stdout: (data) => { versionString = data.toString().trim(); }
                }
            });
            if ((/^\d+\.\d+$/).test(versionString)) {
                versionString += '.0';
            }
            let ver = semver.parse(versionString);
            if (ver == null) {
                throw "Invalid Version String.";
            }
            this._version = ver;
        }
        return this._version;
    }
    async swiftVersion() {
        if (!this._swiftVersion) {
            let swiftVersionString = '';
            await exec.exec('xcrun', ['swift', '--version'], {
                env: {
                    'DEVELOPER_DIR': this.path,
                },
                listeners: {
                    stdout: (data) => { swiftVersionString = data.toString().trim(); }
                }
            });
            const result = (new RegExp('Swift version (\\d+(?:\\.\\d+)+)')).exec(swiftVersionString);
            if (!result) {
                throw Error(`Swift version cannot be detected for ${this.path}.`);
            }
            this._swiftVersion = result[1];
            core.info(`Swift version is ${this._swiftVersion} for Xcode at ${this.path}`);
        }
        return this._swiftVersion;
    }
}
exports.XcodeInfo = XcodeInfo;
let _installedXcodeApplicationsUnderApplicationsDirectory = new Map();
async function installedXcodeApplicationsUnderApplicationsDirectory() {
    if (os.platform() == 'darwin' && _installedXcodeApplicationsUnderApplicationsDirectory.size < 1) {
        const dirents = fs.readdirSync('/Applications', { withFileTypes: true });
        for (const dirent of dirents) {
            if (dirent.isDirectory() && (/^Xcode([^/])*.app/).test(dirent.name)) {
                const xcodePath = path.join('/Applications', dirent.name);
                const xcodeInfo = new XcodeInfo(xcodePath);
                _installedXcodeApplicationsUnderApplicationsDirectory.set(xcodePath, xcodeInfo);
            }
        }
    }
    return _installedXcodeApplicationsUnderApplicationsDirectory;
}
exports.installedXcodeApplicationsUnderApplicationsDirectory = installedXcodeApplicationsUnderApplicationsDirectory;
let _allInstalledXcodeApplications = new Map();
async function allInstalledXcodeApplications() {
    if (os.platform() == 'darwin' && _allInstalledXcodeApplications.size < 1) {
        let paths = [];
        await exec.exec('mdfind', ['kMDItemCFBundleIdentifier == "com.apple.dt.Xcode"'], {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => {
                    paths = data.toString().split(/\r\n|\r|\n/).map(path => path.trim()).filter(path => path != '');
                }
            }
        });
        for (const xcodePath of paths) {
            _allInstalledXcodeApplications.set(xcodePath, new XcodeInfo(xcodePath));
        }
    }
    return _allInstalledXcodeApplications;
}
exports.allInstalledXcodeApplications = allInstalledXcodeApplications;
async function latestXcode() {
    const list = await allInstalledXcodeApplications();
    let latest = null;
    for (const info of Array.from(list.values())) {
        if (!latest || semver.gt(await info.version(), await latest.version())) {
            latest = info;
        }
    }
    if (latest == null) {
        throw "Cant't detect latest Xcode.";
    }
    return latest;
}
exports.latestXcode = latestXcode;
