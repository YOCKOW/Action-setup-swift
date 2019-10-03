const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec')

const swiftVersion = core.getInput('swift-version');
const swiftenvDirectory = '$HOME/.swiftenv'
const swiftenvBinDirectory = swiftenvDirectory + '/bin'
const swiftenvPath = swiftenvBinDirectory + '/swiftenv'

async function run(name, closure) {
  core.startGroup(name);
  await closure();
  core.endGroup();
}

async function download_swiftenv() {
  await run('Download swiftenv...', async () => {
    await exec.exec('git', ['clone', 'https://github.com/kylef/swiftenv.git', swiftenvDirectory]);
    core.addPath(swiftenvBinDirectory);
  })
}

async function check_swift() {
  let installed = false;
  await run('Checking whether or not Swift ' + swiftVersion + ' is already installed.', async () => {
    let status = await exec.exec('swiftenv', ['prefix', swiftVersion], {
                                  ignoreReturnCode: true
                                 });
    installed = (status == 0) ? true : false;
  })
  return installed;
}

async function download_swift() {
  await run('Downlod Swift (via swiftenv)...', async () => {
    let swiftPath = '';
    await exec.exec(swiftenvPath, ['install', swiftVersion]);
  })
}

async function switch_swift() {
  await run('Switch Swift to ' + swiftVersion, async () => {
    let swiftPath = '';
    await exec.exec('swiftenv', ['global', swiftVersion]);
    await exec.exec('swiftenv', ['versions']);
    await exec.exec(swiftenvPath, ['which', 'swift'], {
      listeners: {
        stdout: data => { swiftPath = data.toString().trim() }
      }
    });
    let swiftBinDirectory= swiftPath.replace(/\/swift$/, '');
    core.addPath(swiftBinDirectory);
  })
}

async function main() {
  await download_swiftenv();
  let installed = await check_swift();
  if (installed) {
    core.info(swiftVersion + ' is already installed.');
  } else {
    await download_swift();
  }
  await switch_swift();
}

main().catch(error => { core.setFailed(error.message) })
