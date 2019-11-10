from typing import Any, Dict, List, Optional
from workflow.util import indent, dump_yaml_list, dump_yaml_string

class Matrix:
  def __init__(self, matrix: Dict[str, Any]):
    self.__include: Optional[List[Dict[str, Any]]] = None
    self.__exclude: Optional[List[Dict[str, Any]]] = None
    self.__configurations: Dict[str, List[Any]] = {}
    for key, value in matrix.items():
      if key == 'include':
        self.__include = value
      elif key == 'exclude':
        self.__exclude = value
      else:
        self.__configurations[key] = value
  
  @property
  def include(self) -> Optional[List[Dict[str, Any]]]:
    return self.__include
  
  @property
  def exclude(self) -> Optional[List[Dict[str, Any]]]:
    return self.__exclude

  @property
  def configurations(self) -> Dict[str, List[Any]]:
    return self.__configurations

  def yaml_string(self) -> str:
    result = ''

    if self.include is not None:
      result += f"{indent(4)}include: {dump_yaml_list(self.include, indent_level=4)}\n"

    if self.exclude is not None:
      result += f"{indent(4)}include: {dump_yaml_list(self.exclude, indent_level=4)}\n"

    if len(self.configurations) > 0:
      for key, options in self.configurations.items():
        result += f"{indent(4)}{dump_yaml_string(key)}:{dump_yaml_list(options, flow_style=False, indent_level=5)}\n"

    return result
        