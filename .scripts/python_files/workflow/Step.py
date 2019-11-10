from typing import Any, Dict, List, Optional
from warnings import warn
from workflow.util import indent, dump_yaml_string

class Step:
  def __init__(self, step_data: Dict[str, Any]):
    self.__env = None
    self.__id = None
    self.__if = None
    self.__name = None
    self.__run = None
    self.__shell = None
    self.__uses = None
    self.__with = None

    for key, info in step_data.items():
      if key == 'env':
        if not isinstance(info, dict): raise ValueError("Environment variables must be `dict`.")
        self.__env = {}
        for name, value in info.items():
          self.__env[str(name)] = str(value)
      elif key == 'id':
        self.__id = str(info)
      elif key == 'if':
        self.__if = str(info)
      elif key == 'name':
        self.__name = str(info)
      elif key == 'run':
        self.__run = str(info)
      elif key == 'shell':
        self.__shell = str(info)
      elif key == 'uses':
        self.__uses = str(info)
      elif key == 'with':
        if not isinstance(info, dict): raise ValueError("`with must be `dict`.")
        self.__with = {}
        for name, value in info.items():
          self.__with[str(name)] = str(value)
      else:
        warn(f"`jobs.<job_id>.steps.{key}` is not supported.")

  @property
  def environment_variables(self) -> Optional[Dict[str, str]]:
    return self.__env

  @property
  def id(self) -> Optional[str]:
    return self.__id

  @property
  def if_conditional(self) -> Optional[str]:
    return self.__if

  @property
  def name(self) -> Optional[str]:
    return self.__name

  @property
  def run(self) -> Optional[str]:
    return self.__run

  @property
  def shell(self) -> Optional[str]:
    return self.__shell

  @property
  def uses(self) -> Optional[str]:
    return self.__uses

  @property
  def parameters(self) -> Optional[Dict[str, str]]:
    return self.__with

  def yaml_string(self) -> str:
    lines: List[str] = []

    if self.id is not None: lines.append(f"id: {dump_yaml_string(self.id)}")
    if self.if_conditional is not None: lines.append(f"if: {dump_yaml_string(self.if_conditional)}")
    if self.name is not None: lines.append(f"name: {dump_yaml_string(self.name)}")
    if self.environment_variables is not None:
      lines.append("env:")
      for name, value in self.environment_variables.items():
        lines.append(f"{indent(1)}{dump_yaml_string(name)}: {dump_yaml_string(value)}")
    if self.shell is not None: lines.append(f"shell: {dump_yaml_string(self.shell)}")
    if self.run is not None: lines.append(f"run: {dump_yaml_string(self.run)}")
    if self.uses is not None: lines.append(f"uses: {dump_yaml_string(self.uses)}")
    if self.parameters is not None:
      lines.append("with:")
      for name, value in self.parameters.items():
        lines.append(f"{indent(1)}{dump_yaml_string(name)}: {dump_yaml_string(value)}")

    return f"\n{indent(3)}  ".join(sum(map(lambda line: line.splitlines(), lines), []))
