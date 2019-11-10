from typing import Any, Dict, List, Optional
from workflow.util import indent, dump_yaml_list

class Event:
  def __new__(Self, key: str, data: Dict[str, List[str]]):
    classes: Dict[str, type] = {
      'push': PushEvent,
      'pull_request': PullRequestEvent,
    }
    if key not in classes: raise ValueError(f'Event named "{key}" is not supported yet.')
    the_class = classes[key]
    return the_class.__new__(the_class, data)

  @property
  def name(self) -> str:
    raise "This method must be overriden."
  
  def yaml_string(self) -> str:
    raise "This method must be overriden."

class _PushPREvent(Event):
  def __new__(Self, data: Dict[str, List[str]]):
    return Self.__initialize(data)
  
  @classmethod
  def __initialize(Self, data: Dict[str, List[str]]) -> Any:
    self = object.__new__(Self)
    self.__branches: Optional(List[str]) = None
    self.__tags: Optional(List[str]) = None
    for key, somelist in data.items():
      if key == 'branches' and len(somelist) > 0:
        self.__branches = list(map(lambda element: str(element), somelist))
      elif key == 'tags' and len(somelist) > 0:
        self.__tags = list(map(lambda element: str(element), somelist))
      else:
        raise ValueError("Invalid Event Data.")
    if self.__branches is None and self.__tags is None:
      raise ValueError("Branches or Tags are required.")
    return self
    

  @property
  def branches(self) -> Optional[List[str]]:
    return self.__branches

  @property
  def tags(self) -> Optional[List[str]]:
    return self.__tags

  def yaml_string(self) -> str:
    result = f"{indent(1)}{self.name}:\n"
    if self.__branches is not None:
      result += f"{indent(2)}branches:"
      result += dump_yaml_list(self.__branches, indent_level=3)
      result += "\n"
    if self.__tags is not None:
      result += f"{indent(2)}tags:"
      result += dump_yaml_list(self.__tags, indent_level=3)
      result += "\n"
    return result

class PushEvent(_PushPREvent):
  __name = 'push'

  @property
  def name(self) -> str:
    return type(self).__name

class PullRequestEvent(_PushPREvent):
  __name = 'pull_request'

  @property
  def name(self) -> str:
    return type(self).__name

