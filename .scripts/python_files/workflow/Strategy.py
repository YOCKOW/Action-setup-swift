from typing import Any, Dict, Optional
from workflow.Matrix import Matrix
from workflow.util import indent, dump_yaml_boolean, dump_yaml_number

class Strategy:
  def __init__(self, strategy: Dict[str, Any]):
    if 'fail-fast' in strategy:
      self.__fail_fast = bool(strategy['fail-fast'])
    else:
      self.__fail_fast = None

    if 'max-parallel' in strategy:
      self.__max_parallel = int(strategy['max-parallel'])
    else:
      self.__max_parallel = None

    if 'matrix' in strategy:
      self.__matrix = Matrix(strategy['matrix'])
    else:
      self.__matrix = None
  
  @property
  def fail_fast(self) -> Optional[bool]:
    return self.__fail_fast
  
  @property
  def max_parallel(self) -> Optional[int]:
    return self.__max_parallel

  @property
  def matrix(self) -> Optional[Matrix]:
    return self.__matrix

  def yaml_string(self):
    result = ''

    if self.fail_fast is not None:
      result += f"{indent(3)}fail-fast: {dump_yaml_boolean(self.fail_fast)}\n"

    if self.max_parallel is not None:
      result += f"{indent(3)}max-parallel: {dump_yaml_number(self.max_parallel)}\n"

    if self.matrix is not None:
      result += f"{indent(3)}matrix:\n"
      result += self.matrix.yaml_string()


    return result