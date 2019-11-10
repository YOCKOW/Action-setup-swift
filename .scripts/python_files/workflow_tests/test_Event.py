from workflow.Event import Event, PushEvent
from typing import cast
import unittest


class EventTests(unittest.TestCase):
  def test_events(self):
    push: PushEvent = Event('push', {'branches': ['master', 'development']})
    self.assertTrue(isinstance(push, PushEvent))
    self.assertEqual(push.name, 'push')
    self.assertListEqual(push.branches, ['master', 'development'])
    