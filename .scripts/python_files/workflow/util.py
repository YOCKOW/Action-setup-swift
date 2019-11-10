
import json
from numbers import Number, Real
import re
from typing import Any, List

INDENT_WIDTH: int = 2
def indent(indent_level: int) -> str:
  return " " * (INDENT_WIDTH * indent_level)

def __should_quote(string: str) -> bool:
  # special characters
  if re.search(r'[\u0000-\u001F\u0023\u002C\u003A]', string): return True
  if string[0] in [' ', '!', '"', '&', "'", '*', '-', '[', '{', '|']: return True
  if string.endswith(" "): return True

  # number
  if re.search(r'^\d+(,\d+)*(\.\d+)?$', string): return True
  if re.search(r'^0x[0-9A-Fa-f]+$', string): return True
  
  # boolean
  if {'true': True, 'yes': True, 'on': True, 'false': True, 'no': True, 'off': True}.get(string, False): return True

  # null
  if string == '~' or string == 'null': return True

  # date and time
  try: datetime.fromisoformat(string); return True
  except: pass

def dump_yaml_string(string: str, indent_level: int = 0, force_flow_style: bool = False) -> str:
  if len(string) == 0: return "''"
  
  numberOfLF = string.count("\n")
  if numberOfLF == 0:
    if __should_quote(string):
      return json.dumps(string, ensure_ascii=False)
    return string
  
  if force_flow_style or (numberOfLF == 1 and string.endswith("\n")):
    return json.dumps(string, ensure_ascii=False)
  result: str = ('|+' if string.endswith("\n") else '|') + "\n"
  result += "\n".join(map(lambda line: f"{indent(indent_level + 1)}{line}", string.splitlines()))
  return result

def dump_yaml_number(number: Number) -> str:
  if not isinstance(number, Real):
    raise ValueError("Not a real number.")
  return str(number)

def dump_yaml_boolean(boolean: bool) -> str:
  return 'true' if boolean else 'false'

def dump_yaml_list(list: List[Any], flow_style: bool = False, indent_level: int = 0) -> str:
  def _stringify(element: Any) -> str:
    nonlocal flow_style, indent_level
    if isinstance(element, bool): return dump_yaml_boolean(element)
    if isinstance(element, Number): return dump_yaml_number(element)
    return dump_yaml_string(str(element), indent_level=indent_level, force_flow_style=flow_style)

  if flow_style:
    return '[' + ', '.join(map(_stringify, list)) +  ']'
  
  joiner = f"\n{indent(indent_level)}- "
  return (joiner if indent_level > 0 else '- ') + joiner.join(map(_stringify, list))
