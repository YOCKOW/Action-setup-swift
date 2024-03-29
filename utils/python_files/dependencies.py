from enum import Enum, auto
import os
from pathlib import Path
import re
import sys
import subprocess
from typing import Callable, Dict, FrozenSet, List, Optional, Set

sys.path.append(str(Path(__file__).resolve().parent))
import repository_path as path

class _DepCache:
  class _Type(Enum):
    production = auto()
    development = auto()
    development_only = auto()

  __cache: Dict[_Type, FrozenSet[str]] = dict()

  @classmethod
  def _extract_package_name(Self, line: str) -> Optional[str]:
    name = line
    name = re.sub(r'^[\s\u2500-\u257F]+(?:UNMET (?:OPTIONAL | PEER )?DEPENDENCY)?\s*', '', name)
    if name == line:
      return None
    name = re.sub(r'@\d+(?:\.\d+)+(\s+deduped\s*)?$', '', name)
    name = re.sub(r'@(?:\^|\>=)\d+(?:\.\d+)+(?:\s*\|\|\s*(?:\^|\>=)\d+(?:\.\d+)+\s*)*$', '', name) # UNMET OPTIONAL|PEER DEPENDENCY
    return name

  @classmethod
  def __lines(Self, prod: bool = True) -> List[str]:
    config = '--omit=dev' if prod else '--include=dev'
    completed = subprocess.run(['npm', 'list', config, '--depth', '2147483647'], cwd=path.REPOSITORY_ROOT, stdout=subprocess.PIPE)
    if completed.returncode != 0: raise SystemError('`npm list` failed.')
    return completed.stdout.decode('utf-8').splitlines()

  @classmethod
  def __dependencies(Self, prod: bool = True) -> Set[str]:
    lines = Self.__lines(prod)
    deps: Set[str] = set()
    for line in lines:
      package_name = Self._extract_package_name(line)
      if package_name: deps.add(package_name)
    return deps

  @classmethod
  def dependencies(Self, kind: _Type) -> FrozenSet[str]:
    if kind not in Self.__cache:
      if kind == Self._Type.production: Self.__cache[kind] = frozenset(Self.__dependencies(prod=True))
      elif kind == Self._Type.development: Self.__cache[kind] = frozenset(Self.__dependencies(prod=False))
      else: Self.__cache[kind] = frozenset(Self.dependencies(Self._Type.development).difference(Self.dependencies(Self._Type.production)))
    return Self.__cache[kind]

class _GitCache:
  __tracking_modules: Set[str] = set()

  @classmethod
  def tracking_modules(Self) -> FrozenSet[str]:
    if len(Self.__tracking_modules) == 0:
      completed = subprocess.run(['git', 'ls-files'], cwd=path.NODE_MODULES_DIRECTORY, stdout=subprocess.PIPE)
      if completed.returncode != 0: raise SystemError('`git ls-files` failed.')
      files: List[str] = completed.stdout.decode('utf-8').splitlines()
      for file in files:
        if '/' not in file: continue
        dirname = re.sub(r'/[^/]+$', '', file)
        if re.search(r'/(?:\.bin|bin|(?:lib|node_modules|plugins|test)(/.+)?)$', dirname) != None: continue
        Self.__tracking_modules.add(dirname)
    return frozenset(Self.__tracking_modules)


def for_production() -> FrozenSet[str]:
  """ Returns dependencies for production. """
  return _DepCache.dependencies(_DepCache._Type.production)

def for_development() -> FrozenSet[str]:
  """ Returns dependencies for development. """
  return _DepCache.dependencies(_DepCache._Type.development)

def for_development_only() -> FrozenSet[str]:
  """ Returns dependencies that are used for development but not used for production. """
  return _DepCache.dependencies(_DepCache._Type.development_only)

def package_is_installed(name: str) -> bool:
  """ Returns whether or not the package named `name` is installed. """
  return path.NODE_MODULES_DIRECTORY.joinpath(name).is_dir()

def package_is_tracked(name: str) -> bool:
  """ Returns whether or not the package named `name` is tracked by git. """
  return name in _GitCache.tracking_modules()

def package_has_untracked_files(name: str) -> bool:
  """ Returns whether or not the package named `name` has untracked file(s). """
  package_dir: Path = path.NODE_MODULES_DIRECTORY.joinpath(name)
  if not package_dir.is_dir():
    return True
  all_files: Set[Path] = set(
    map(
      lambda f: f.relative_to(path.NODE_MODULES_DIRECTORY),
      filter(
        lambda f: not f.is_dir(),
        package_dir.glob('./**/*')
      )
    )
  )
  for file in all_files:
    completed = subprocess.run(['git', 'ls-files', '--error-unmatch', str(file)], cwd=path.NODE_MODULES_DIRECTORY, stdout=subprocess.DEVNULL)
    if completed.returncode != 0:
      return True

  return False


# Tests
if __name__ == '__main__':
  import unittest
  class DependenciesTests(unittest.TestCase):
    def test_extract_package_name(self):
      self.assertIsNone(_DepCache._extract_package_name('Action-setup-swift@1.0.5-dev /path/to/repository'))
      self.assertEqual(_DepCache._extract_package_name('├── @actions/core@1.1.3'), '@actions/core')
      self.assertEqual(_DepCache._extract_package_name('│ │ │ │   └── os-name@3.1.0 deduped'), 'os-name')
      self.assertEqual(_DepCache._extract_package_name('│ │ │ │ ├── @babel/core@7.11.6 deduped'), '@babel/core')
      self.assertEqual(_DepCache._extract_package_name('│ └─┬ @octokit/rest@16.43.2'), '@octokit/rest')
      self.assertEqual(_DepCache._extract_package_name('│   │   └── @types/node@12.19.13 deduped'), '@types/node')
      self.assertEqual(_DepCache._extract_package_name('│ │ │ │   │ └── UNMET OPTIONAL DEPENDENCY utf-8-validate@^5.0.2'), 'utf-8-validate')
      self.assertEqual(_DepCache._extract_package_name('│ │ │ ├── UNMET OPTIONAL DEPENDENCY node-notifier@^8.0.1 || ^9.0.0 || ^10.0.0'), 'node-notifier')
      self.assertEqual(_DepCache._extract_package_name('│ │ │ └── UNMET OPTIONAL DEPENDENCY ts-node@>=9.0.0'), 'ts-node')


    def test_dependencies(self):
      self.assertTrue("@actions/core" in for_production())
      self.assertTrue("typescript" in for_development())
      self.assertFalse("semver" in for_development_only())

  class GitTrackingTests(unittest.TestCase):
    def test_installed(self):
      self.assertTrue(package_is_installed('@actions/exec'))

    def test_tracked(self):
      self.assertTrue(package_is_tracked('@actions/github'))
      self.assertFalse(package_is_tracked('@types/semver'))

  unittest.main()
