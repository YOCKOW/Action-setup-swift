from copy import deepcopy
import re
from typing import Any, Dict, List, Optional, Set, Union
from warnings import warn
from workflow.Job import Job
from workflow.On import On
from workflow.util import dump_yaml_string

class Workflow:
  """
  Represents GitHub Actions Workflow.
  NOT FOR UNIVERSAL USE.
  """

  def __init__(self, workflow: Dict[str, Any]):
    workflow = deepcopy(workflow)

    if 'name' not in workflow: raise ValueError("`name` is required.")
    self.__name: str = workflow['name']
    
    if 'on' not in workflow: raise ValueError("`on` is required.")
    self.__on: On = On(workflow['on'])

    if 'jobs' not in workflow: raise ValueError("`jobs` is required.")
    jobs: Dict[str, Any] = workflow['jobs']
    if not isinstance(jobs, dict): raise ValueError("`jobs` must be an instance of `dict`.")
    self.__jobs: List[Job] = list()
    for job_id, job_data in jobs.items():
      self.__jobs.append(Job(str(job_id), job_data))

    supported: Set[str] = set(['name', 'on', 'jobs'])
    keys = set(workflow.keys())
    if keys != supported:
      warn(f"Some properties ({', '.join(list(keys.difference(supported)))}) are not supported.")

  def yaml_string(self) -> str:
    result = ''
    # name
    result += f"name: {dump_yaml_string(self.__name, force_flow_style=False)}\n"
    # on
    result += self.__on.yaml_string()
    # jobs
    result += "jobs:\n"
    for job in sorted(self.__jobs, key=lambda job: job.id):
      result += job.yaml_string()

    # remove empty lines
    return "\n".join(filter(lambda line: not re.match(r'^\s*$', line), result.splitlines())) + "\n"
    

