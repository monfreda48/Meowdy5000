import os
import time
import subprocess
from pathlib import Path
from google import genai
from google.genai import types
from google.genai.errors import APIError

def run_powershell(command: str) -> str:
    """Executes a PowerShell command on the local Windows machine and returns stdout/stderr."""
    print(f"\n[Gemini requests execution]:\n  {command}")
    confirm = input("Run this command? [y/N]: ").strip().lower()
    if confirm != 'y':
        return "Execution cancelled by user."

    try:
        result = subprocess.run(
            ["powershell.exe", "-NoProfile", "-Command", command],
            capture_output=True,
            text=True,
            timeout=180
        )
        output = result.stdout
        if result.stderr:
            output += f"\nSTDERR:\n{result.stderr}"
        return output if output.strip() else "(Command executed with no output)"
    except Exception as e:
        return f"Execution error: {str(e)}"

def read_file(filepath: str, start_line: int = 1, max_lines: int = 150) -> str:
    """Reads lines from a local file with line numbering. Defaults to 150 lines starting at start_line."""
    path = Path(filepath)
    if not path.is_absolute():
        path = Path.cwd() / path
    if not path.exists():
        return f"Error: File '{filepath}' does not exist."

    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()

        start_idx = max(1, start_line) - 1
        end_idx = start_idx + max_lines
        selected = lines[start_idx:end_idx]

        if not selected:
            return f"(File has {len(lines)} lines; no lines in requested range)"

        numbered = [f"{i + start_idx + 1:4d} | {line}" for i, line in enumerate(selected)]
        header = f"--- {path.name} (Lines {start_idx + 1} to {min(len(lines), end_idx)} of {len(lines)}) ---\n"
        return header + "".join(numbered)
    except Exception as e:
        return f"Error reading file '{filepath}': {str(e)}"

def replace_in_file(filepath: str, target_text: str, replacement_text: str) -> str:
    """Replaces exact target_text with replacement_text in a file. Ideal for precise code updates."""
    path = Path(filepath)
    if not path.is_absolute():
        path = Path.cwd() / path
    if not path.exists():
        return f"Error: File '{filepath}' does not exist."

    try:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

        if target_text not in content:
            return f"Error: Target text not found in '{filepath}'. Check whitespace and line breaks."

        print(f"\n[Gemini requests edit in {path.name}]:")
        preview_old = target_text[:160] + ("..." if len(target_text) > 160 else "")
        preview_new = replacement_text[:160] + ("..." if len(replacement_text) > 160 else "")
        print(f"--- TARGET ---\n{preview_old}")
        print(f"--- REPLACEMENT ---\n{preview_new}")

        confirm = input(f"Apply edit to '{path.name}'? [y/N]: ").strip().lower()
        if confirm != 'y':
            return "Edit cancelled by user."

        new_content = content.replace(target_text, replacement_text, 1)
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)

        return f"Successfully updated '{filepath}'."
    except Exception as e:
        return f"Error editing '{filepath}': {str(e)}"

def write_file(filepath: str, content: str) -> str:
    """Creates or overwrites a file with the provided content."""
    path = Path(filepath)
    if not path.is_absolute():
        path = Path.cwd() / path

    print(f"\n[Gemini requests file write to {path.name} ({len(content)} chars)]")
    confirm = input(f"Write/overwrite '{filepath}'? [y/N]: ").strip().lower()
    if confirm != 'y':
        return "Write cancelled by user."

    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote '{filepath}'."
    except Exception as e:
        return f"Error writing file '{filepath}': {str(e)}"

client = genai.Client()

system_prompt = (
    "You are an expert DevOps and full-stack engineer working on Meowdy5000 (Marvel Rivals tracker). "
    "Working directory: C:\\Users\\User\\desktop\\rivalstracker.\n\n"
    "Tools available:\n"
    "- read_file: inspect source code with line numbers before modifying.\n"
    "- replace_in_file: surgical string replacement for edits.\n"
    "- write_file: create or overwrite small files.\n"
    "- run_powershell: run git commands, npm builds, and docker container operations.\n\n"
    "Always plan your action concisely before executing tools."
)

chat = client.chats.create(
    model="gemini-3.6-flash",
    config=types.GenerateContentConfig(
        system_instruction=system_prompt,
        tools=[run_powershell, read_file, replace_in_file, write_file],
        temperature=0.2,
    )
)

print("\n=== Gemini Autonomous Agent Ready (Type 'exit' to quit) ===")
while True:
    try:
        user_input = input("\nYou: ").strip()
        if user_input.lower() in ['exit', 'quit']:
            break
        if not user_input or len(user_input) < 2:
            continue

        response = chat.send_message(user_input)
        print(f"\nGemini: {response.text}")
    except KeyboardInterrupt:
        print("\nExiting...")
        break
    except APIError as e:
        if "429" in str(e):
            print("\nRate limit reached (Free Tier RPM). Pausing 25 seconds...")
            time.sleep(25)
            print("Ready again. Please retry your request.")
        else:
            print(f"\nAPI Error: {e}")
    except Exception as err:
        print(f"\nError: {err}")
