# tools/github_tools.py — Read code from public GitHub repository

import os
from github import Github
from dotenv import load_dotenv
from agent.memory import update_last_file

load_dotenv()

_gh = Github()  # no token needed for public repos

BRANCH = os.getenv("GITHUB_BRANCH", "main")

def get_repo_structure(repo_name: str) -> list:
    """List all files in the repo."""
    repo = _gh.get_repo(repo_name)
    tree = repo.get_git_tree(BRANCH, recursive=True)
    return [item.path for item in tree.tree if item.type == "blob"]

def fetch_file(repo_name: str, file_path: str) -> str:
    """Fetch content of a specific file from the repo."""
    repo = _gh.get_repo(repo_name)
    file = repo.get_contents(file_path, ref=BRANCH)
    update_last_file(file_path)
    return file.decoded_content.decode("utf-8")