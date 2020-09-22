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
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.latestXcode = exports.swiftVersionForXcode = exports.installedXcodeApplications = void 0;
const exec = __importStar(require("@actions/exec"));
const os = __importStar(require("os"));
const semver = __importStar(require("semver"));
async function _semanticVersionOfXcodeForPath(path) {
    let versionString = '';
    await exec.exec('defaults', ['read', `${path}/Contents/Info`, 'CFBundleShortVersionString'], {
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
    return ver;
}
let _xcode_info_list = [];
async function installedXcodeApplications() {
    if (os.platform() == 'darwin' && _xcode_info_list.length < 1) {
        let paths = [];
        await exec.exec('mdfind', ['kMDItemCFBundleIdentifier == "com.apple.dt.Xcode"'], {
            ignoreReturnCode: true,
            listeners: {
                stdout: (data) => {
                    paths = data.toString().split(/\r\n|\r|\n/).map(path => path.trim()).filter(path => path != '');
                }
            }
        });
        for (let ii = 0; ii < paths.length; ii++) {
            const version = await _semanticVersionOfXcodeForPath(paths[ii]);
            const info = { path: paths[ii], version: version };
            // core.info(`The version of Xcode at "${info.path}" is ${info.version}.`);
            _xcode_info_list.push(info);
        }
    }
    return _xcode_info_list;
}
exports.installedXcodeApplications = installedXcodeApplications;
async function swiftVersionForXcode(xcode) {
    let swiftVersionString = '';
    await exec.exec('xcrun', ['swift', '--version'], {
        env: {
            'DEVELOPER_DIR': xcode.path,
        },
        listeners: {
            stdout: (data) => { swiftVersionString = data.toString().trim(); }
        }
    });
    const result = (new RegExp('Swift version (\\d+(?:\\.\\d+)+)')).exec(swiftVersionString);
    if (!result) {
        throw Error(`Swift Version cannot be detected for ${xcode.path}`);
    }
    return result[1];
}
exports.swiftVersionForXcode = swiftVersionForXcode;
async function latestXcode() {
    const list = await installedXcodeApplications();
    let latest = null;
    list.forEach((info) => {
        if (!latest || semver.gt(info.version, latest.version)) {
            latest = info;
        }
    });
    if (latest == null) {
        throw "Cant't detect latest Xcode.";
    }
    return latest;
}
exports.latestXcode = latestXcode;
