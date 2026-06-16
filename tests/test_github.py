from tools.github_tools import get_repo_structure

print("Fetching repo structure...")
files = get_repo_structure("Jayasreesthc/Psychegraph_Backend")

for f in files:
    print(f)