from workflow.util import indent, dump_yaml_list, dump_yaml_string
import unittest

class WorkflowUtilTests(unittest.TestCase):
  def test_dump_string(self):
    self.assertEqual(dump_yaml_string('macOS-latest'), 'macOS-latest')
    self.assertEqual(dump_yaml_string('${{ matrix.os }}'), '${{ matrix.os }}')
    self.assertEqual(dump_yaml_string('5.1'), '"5.1"')
    self.assertEqual(dump_yaml_string('5.1.1'), '5.1.1')
    self.assertEqual(dump_yaml_string("echo hello\necho world"), "|\n  echo hello\n  echo world")

  def test_dump_strings(self):
    strings = ['A', 'B', 'C']
    self.assertEqual(dump_yaml_list(strings, flow_style=True), '[A, B, C]')
    self.assertEqual(dump_yaml_list(strings, flow_style=False), "- A\n- B\n- C")
    indent1 = indent(1)
    self.assertEqual(dump_yaml_list(strings, flow_style=False, indent_level=1), f"\n{indent1}- A\n{indent1}- B\n{indent1}- C")
