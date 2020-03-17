import os
from pathlib import Path

__pythonFiles_directory = Path(__file__).resolve().parent
__utils_directory = __pythonFiles_directory.parent

REPOSITORY_ROOT: Path = __utils_directory.parent
WORKFLOWS_DIRECTORY: Path = REPOSITORY_ROOT.joinpath('.github/workflows')
NODE_MODULES_DIRECTORY: Path = REPOSITORY_ROOT.joinpath('node_modules')

if __name__ == '__main__':
  print(f'Repository Root: {str(REPOSITORY_ROOT)}')
  print(f'"workflows" directory: {str(WORKFLOWS_DIRECTORY)}')
  print(f'"node_modules" directory: {str(NODE_MODULES_DIRECTORY)}')
