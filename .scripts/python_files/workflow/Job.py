from typing import Any, Dict, List, Optional, Union
from warnings import warn
from workflow.Step import Step
from workflow.Strategy import Strategy
from workflow.util import indent, dump_yaml_string, dump_yaml_list

class Job:
  def __init__(self, job_id: str, job_data: Dict[str, Any]):
    self.__id = job_id

    if 'container' in job_data:
      warn("jobs.<job_id>.container is not supported yet.")

    if 'env' in job_data:
      env: Dict[str, str] = job_data['env']
      if not isinstance(env, dict): raise ValueError("`jobs.<job_id>.env` must be an instance of `dict`.")
      self.__env = {}
      for env_name, env_value in env.items():
        self.__env[str(env_name)] = str(env_value)
    else:
      self.__env = None

    self.__if = job_data.get('if', None)

    self.__name = job_data.get('name', None)

    if 'needs' in job_data:
      needs = job_data['needs']
      if isinstance(needs, str): self.__needs = needs
      elif isinstance(needs, list): self.__needs = list(map(lambda element: str(element), needs))
      else: raise ValueError("Invalid value for `jobs.<job_id>.needs`.")
    else:
      self.__needs = None

    if 'runs-on' in job_data:
      self.__runs_on = job_data['runs-on']
    else:
      raise ValueError("`jobs.<job_id>.runs-on` is required.")

    if 'services' in job_data:
      warn("jobs.<job_id>.services is not supported yet.")

    if 'steps' in job_data:
      self.__steps: List[Step] = list()
      for step in job_data['steps']:
        self.__steps.append(Step(step))
    else:
      self.__steps = None

    if 'strategy' in job_data:
      self.__strategy = Strategy(job_data['strategy'])
    else:
      self.__strategy = None

    if 'timeout-minutes' in job_data:
      self.__timeout_minutes = int(job_data['timeout-minutes'])
    else:
      self.__timeout_minutes = None


  @property
  def id(self) -> str:
    return self.__id

  @property
  def environment_variables(self) -> Optional[Dict[str, str]]:
    return self.__env

  @property
  def if_conditional(self) -> Optional[str]:
    return str(self.__if) if self.__if is not None else None

  @property
  def name(self) -> Optional[str]:
    return str(self.__name) if self.__name is not None else None

  @property
  def needs(self) -> Optional[Union[str, List[str]]]:
    return self.__needs

  @property
  def runs_on(self) -> str:
    return self.__runs_on

  @property
  def steps(self) -> Optional[List[Step]]:
    return self.__steps

  @property
  def strategy(self) -> Optional[Strategy]:
    return self.__strategy

  @property
  def timeout_minutes(self) -> Optional[int]:
    return self.__timeout_minutes

  def yaml_string(self) -> str:
    result = f"{indent(1)}{dump_yaml_string(self.id)}:\n"

    if self.if_conditional is not None:
      result += f"{indent(2)}if: {dump_yaml_string(self.if_conditional)}\n"

    if self.name is not None:
      result += f"{indent(2)}name: {dump_yaml_string(self.name)}\n"

    if self.needs is not None:
      result += f"{indent(2)}needs: "
      if isinstance(self.needs, str): result += dump_yaml_string(self.needs)
      elif isinstance(self.needs, list): result += dump_yaml_list(self.needs)
      result += "\n"

    if self.strategy is not None:
      result += f"{indent(2)}strategy:\n"
      result += self.strategy.yaml_string()

    result += f"{indent(2)}runs-on: {dump_yaml_string(self.runs_on)}\n"

    if self.environment_variables is not None:
      result += f"{indent(2)}env:\n"
      for name, value in self.environment_variables.items():
        result += f"{indent(3)}{dump_yaml_string(name)}: {dump_yaml_string(value)}\n"

    if self.timeout_minutes is not None:
      result += f"{indent(2)}timeout-minutes: {self.timeout_minutes}\n"

    if self.steps is not None:
      result += f"{indent(2)}steps:\n"
      for step in self.steps:
        result += f"{indent(3)}- {step.yaml_string()}\n"

    return result