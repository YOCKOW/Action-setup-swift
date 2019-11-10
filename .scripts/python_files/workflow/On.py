from typing import Any, Dict, List, Union
from workflow.Event import Event
from workflow.util import dump_yaml_string, dump_yaml_list

class On:
  def __init__(self, value: Any):
    if isinstance(value, str):
      self.__events: str = value
    elif isinstance(value, list):
      self.__events: List[str] = list(map(lambda element: str(element), value))
    elif isinstance(value, dict):
      self.__events: List[Event] = list()
      for key, data in value.items():
        self.__events.append(Event(key, data))
      sort_keys: Dict[str, int] = {
        'push': 0,
        'pull_request': 1,
      }
      self.__events.sort(key=lambda event: sort_keys.get(event.name, 9999))
    else:
      raise ValueError("Unexpected value for `on`")
  
  @property
  def events(self) -> Union[str, List[str], List[Event]]:
    return self.__events

  def yaml_string(self) -> str:
    if isinstance(self.__events, str):
      return f"on: {dump_yaml_string(self.__events)}\n"
    if isinstance(self.__events, list) and isinstance(self.__events[0], str):
      return f"on: {dump_yaml_list(self.__events, flow_style=True)}\n"
    
    result = "on:\n"
    for event in self.__events:
      result += event.yaml_string()
    return result
  