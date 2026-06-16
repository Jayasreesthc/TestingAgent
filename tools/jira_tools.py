# tools/jira_tools.py — Create and read Jira tickets

import os
from jira import JIRA
from dotenv import load_dotenv
from agent.memory import update_last_ticket

load_dotenv()

def get_jira_client():
    return JIRA(
        server=os.getenv("JIRA_URL"),
        basic_auth=(os.getenv("JIRA_EMAIL"), os.getenv("JIRA_API_TOKEN"))
    )

def create_jira_ticket(summary: str, description: str, issue_type: str = "Task") -> str:
    """Create a new Jira ticket with summary and description."""
    jira = get_jira_client()
    issue = jira.create_issue(
        project=os.getenv("JIRA_PROJECT_KEY"),
        summary=summary,
        description=description,
        issuetype={"name": issue_type}
    )
    update_last_ticket(issue.key)
    return f"Ticket created: {issue.key} — {issue.permalink()}"

def get_jira_ticket(ticket_id: str) -> str:
    """Fetch details of an existing Jira ticket by ID."""
    jira = get_jira_client()
    issue = jira.issue(ticket_id)
    return (
        f"Ticket: {issue.key}\n"
        f"Summary: {issue.fields.summary}\n"
        f"Status: {issue.fields.status.name}\n"
        f"Description: {issue.fields.description}"
    )