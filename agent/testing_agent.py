# agent/testing_agent.py — Agent setup using Google ADK with Groq + GitHub + Jira tools

import os
from dotenv import load_dotenv
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import FunctionTool
from agent.prompts import SYSTEM_PROMPT
from tools.github_tools import get_repo_structure, fetch_file
from tools.jira_tools import create_jira_ticket, get_jira_ticket

load_dotenv()

# litellm needs this to connect to Groq
os.environ["GROQ_API_KEY"] = os.getenv("GROQ_API_KEY", "")

def build_agent():
    agent = Agent(
        model="groq/llama-3.3-70b-versatile",
        name="testing_agent",
        instruction=SYSTEM_PROMPT,
        tools=[
            FunctionTool(get_repo_structure),
            FunctionTool(fetch_file),
            FunctionTool(create_jira_ticket),
            FunctionTool(get_jira_ticket),
        ],
    )
    return agent

def get_runner():
    agent = build_agent()
    session_service = InMemorySessionService()
    runner = Runner(
        agent=agent,
        app_name="testing_agent",
        session_service=session_service
    )
    return runner