const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec')

const swiftVersion = core.getInput('swift-version');
const swiftenvDirectory = '$HOME/.swiftenv'
const swiftenvBinDirectory = swiftenvDirectory + '/bin'
const swiftenvPath = swiftenvBinDirectory + '/swiftenv'

async function main() {
  core.startGroup('Download swiftenv...')
  await exec.exec('git', ['clone', 'https://github.com/kylef/swiftenv.git', swiftenvDirectory])
  core.addPath(swiftenvBinDirectory)
  core.endGroup()

  core.startGroup('Download swift via swiftenv...')
  let swiftPath = ''
  await exec.exec(swiftenvPath, ['install', swiftVersion])
  await exec.exec(swiftenvPath, ['which', 'swift'], {
                    listeners: {
                      stdout: data => { swiftPath = data.toString().trim() }
                    }
                  })
  let swiftBinDirectory= swiftPath.replace(/\/swift$/, '')
  core.addPath(swiftBinDirectory)
  core.endGroup()
}

main()
