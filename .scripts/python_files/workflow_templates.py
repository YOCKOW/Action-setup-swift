from copy import deepcopy
from textwrap import dedent
from typing import List
try:
  from workflow import Workflow
except:
  raise ImportError("Could you exec `pip3 install git+https://github.com/YOCKOW/PythonGitHubActionsWorkflowRepresentation.git`?")


SCRIPTS_DIR = './.scripts'
OS_LIST = ['ubuntu-latest', 'macOS-latest']
SWIFT_VERSION_LIST = ['5.1.1', 'DEVELOPMENT-SNAPSHOT-2019-10-21-a']

__each_branch = {
  'name': "Test for branch \"%s\"",
  'on': {
    'push': {
      'branches': [],
      'tags': ['!*']
    }
  },
  'jobs': {
    'branch-test': {
      'strategy': {
        'matrix': {
          'os': OS_LIST,
          'swift-version': SWIFT_VERSION_LIST
        }
      },
      'runs-on': "${{ matrix.os }}",
      'name': "Test of Action-setup-swift",
      'steps': [
        {
          'uses': "actions/checkout@master"
        },
        {
          'name': "Install Swift.",
          'uses': "YOCKOW/Action-setup-swift@%s",
          'with': {
            'swift-version': "${{ matrix.swift-version }}"
          }
        },
        {
          'name': "View Swift Version",
          'run': "swift --version"
        },
        {
          'name': "Run Swift",
          'run': f"{SCRIPTS_DIR}/swift-test"
        }
      ]
    }
  }
}

__direct_test = {
  'name': "Direct Test",
  'on': {
    'push': {
      'branches': ['*', '*/*'],
      'tags': ['!*']
    },
    'pull_request': {
      'branches': ['*', '*/*']
    }
  },
  'jobs': {
    'direct-test': {
      'strategy': {
        'matrix': {
          'os': OS_LIST,
          'swift-version': SWIFT_VERSION_LIST
        }
      },
      'runs-on': "${{ matrix.os }}",
      'name': "Test of Action-setup-swift",
      'steps': [
        {
          'uses': "actions/checkout@master"
        },
        {
          'uses': "actions/setup-node@v1",
          'with': {
            'node-version': '12.x'
          }
        },
        {
          'name': "Run the smoke test.",
          'run': "npm ci && npm run smoke-test"
        },
        {
          'name': "Install Swift",
          'run': "node ./lib/main.js",
          'env': {
            'INPUT_SWIFT-VERSION': "${{ matrix.swift-version }}"
          }
        },
        {
          'name': "View Swift Version",
          'run': "swift --version"
        },
        {
          'name': "Run Swift",
          'run': f"{SCRIPTS_DIR}/swift-test"
        }
      ]
    }
  }
}

__check_commits = {
  'name': "Check commits",
  'on': {
    'push': {
      'branches': ['*', '*/*'],
      'tags': ['!*']
    },
    'pull_request': {
      'branches': ['*', '*/*']
    }
  },
  'jobs': {
    'check-modules': {
      'runs-on': "ubuntu-latest",
      'name': "Check whether or not unnecessary modules are installed.",
      'steps': [
        {
          'uses': "actions/checkout@master"
        },
        {
          'uses': "actions/setup-node@v1",
          'with': {
            'node-version': '12.x'
          }
        },
        {
          'uses': "actions/setup-python@v1.1.1",
          'with': {
            'python-version': "3.7"
          }
        },
        {
          'name': "Check modules.",
          'run': f"{SCRIPTS_DIR}/check-modules"
        }
      ]
    },
    'check-traspilation': {
      'runs-on': "ubuntu-latest",
      'name': "Check whether or not transpilation is completed.",
      'steps':[
        {
          'uses': "actions/checkout@master"
        },
        {
          'uses': "actions/setup-node@v1",
          'with': {
            'node-version': '12.x'
          }
        },
        {
          'name': 'Check transpilation',
          'run': dedent("""\
            npm install
            npm run build
            if [ $(git diff -- ./lib) ]; then
              echo "Transpilation has not been completed."
              exit 1
            fi
          """)
        }
      ]
    }
  }
}

def workflow_for_branch(branch_name: str) -> Workflow:
  template = deepcopy(__each_branch)
  template['name'] = template['name'] % branch_name
  template['on']['push']['branches'].append(branch_name)
  template['jobs']['branch-test']['steps'][1]['uses'] = template['jobs']['branch-test']['steps'][1]['uses'] % branch_name
  return Workflow(template)

def workflow_for_direct_test(excluding_branches: List[str]) -> Workflow:
  template = deepcopy(__direct_test)
  template['on']['push']['branches'] += list(map(lambda branch: f"!{branch}", excluding_branches))
  return Workflow(template)

def workflow_for_checking_commits() -> Workflow:
  return Workflow(__check_commits)