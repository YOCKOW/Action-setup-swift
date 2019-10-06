import * as core from '@actions/core';
import * as exec from '@actions/exec';

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
  await run('Checking whether or not Swift ' + swiftVersion + ' is already installed.', async () => {
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
    let swiftBinDirectory= swiftPath.replace(/\/swift$/, '');
    core.addPath(swiftBinDirectory);
    
    // FIXME: There should be more appropriate way...
    let xcodePathRegExp = new RegExp('^/Applications/Xcode[^/]*.app/Contents/Developer');
    let result = swiftBinDirectory.match(xcodePathRegExp);
    if (result && result[0]) {
       await exec.exec('sudo xcode-select', ['-switch', result[0]]);
    }
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
