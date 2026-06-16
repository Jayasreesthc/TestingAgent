import os
import re

MEMORY_FILE_PATH = os.path.join(".openclaw", "workspace", "MEMORY.md")

def _ensure_memory_file():
    os.makedirs(os.path.dirname(MEMORY_FILE_PATH), exist_ok=True)
    if not os.path.exists(MEMORY_FILE_PATH):
        with open(MEMORY_FILE_PATH, "w", encoding="utf-8") as f:
            f.write("# Memory\n\n- last_reviewed_file: None\n- last_jira_ticket: None\n")

def _read_memory() -> str:
    _ensure_memory_file()
    with open(MEMORY_FILE_PATH, "r", encoding="utf-8") as f:
        return f.read()

def _write_memory(content: str):
    _ensure_memory_file()
    with open(MEMORY_FILE_PATH, "w", encoding="utf-8") as f:
        f.write(content)

def update_last_file(file_path: str):
    content = _read_memory()
    pattern = r"(-\s*last_reviewed_file:\s*)(.*)"
    if re.search(pattern, content):
        content = re.sub(pattern, f"\\1{file_path}", content)
    else:
        content += f"- last_reviewed_file: {file_path}\n"
    _write_memory(content)

def update_last_ticket(ticket_id: str):
    content = _read_memory()
    pattern = r"(-\s*last_jira_ticket:\s*)(.*)"
    if re.search(pattern, content):
        content = re.sub(pattern, f"\\1{ticket_id}", content)
    else:
        content += f"- last_jira_ticket: {ticket_id}\n"
    _write_memory(content)
