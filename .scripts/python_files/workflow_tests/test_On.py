from workflow.On import On
from workflow import util
import textwrap
import unittest

class OnTests(unittest.TestCase):
  def test_simple_on(self):
    simple_on = On('push')
    self.assertEqual(simple_on.events, 'push')
  
  def test_list(self):
    on_list = On(['push', 'pull_request'])
    self.assertListEqual(on_list.events, ['push', 'pull_request'])

  def test_events(self):
    on_events = On({'push': {'branches': ['development'], 'tags': ['*']}, 'pull_request': {'branches': ['master']}})
    self.assertEqual(len(on_events.events), 2)

    original_indent_width = util.INDENT_WIDTH
    util.INDENT_WIDTH = 2
    self.assertEqual(on_events.yaml_string(), textwrap.dedent("""\
    on:
      push:
        branches:
          - development
        tags:
          - "*"
      pull_request:
        branches:
          - master
    """))
    util.INDENT_WIDTH = original_indent_width

