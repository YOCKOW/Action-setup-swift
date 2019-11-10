from workflow import Workflow, util
import textwrap
import unittest

class WorkflowTests(unittest.TestCase):
  def test_workflow(self):
    workflow_dict = {
      'name': "Test Workflow",
      'on': {
        'push': {
          'branches': ['master', 'development']
        }
      },
      'jobs': {
        'job1': {
          'name': 'Some Job',
          'strategy': {
            'fail-fast': False,
            'max-parallel': 2,
            'matrix': {
              'os': ['ubuntu-latest', 'macOS-latest']
            }
          },
          'runs-on': '${{ matrix.os }}',
          'steps':[
            {
              'uses': 'actions/setup-node@v1',
              'with': {
                'node-version': '12.x'
              }
            },
            {
              'name': 'Run Node.js',
              'run': "echo run\nnode index.js",
              'env': {
                'env-name': 'env-value'
              }
            }
          ]
        }
      }
    }
    
    original_indent_width = util.INDENT_WIDTH
    util.INDENT_WIDTH = 2
    self.maxDiff = None
    self.assertEqual(Workflow(workflow_dict).yaml_string(), textwrap.dedent("""\
      name: Test Workflow
      on:
        push:
          branches:
            - master
            - development
      jobs:
        job1:
          name: Some Job
          strategy:
            fail-fast: false
            max-parallel: 2
            matrix:
              os:
                - ubuntu-latest
                - macOS-latest
          runs-on: ${{ matrix.os }}
          steps:
            - uses: actions/setup-node@v1
              with:
                node-version: 12.x
            - name: Run Node.js
              env:
                env-name: env-value
              run: |
                echo run
                node index.js
    """))
    util.INDENT_WIDTH = original_indent_width