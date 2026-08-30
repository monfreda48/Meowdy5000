import requests
import json
import sys

if sys.stdout:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

url = 'https://api.github.com/repos/monfreda48/Meowdy5000/issues?state=all'
headers = {'Accept': 'application/vnd.github.v3+json'}

try:
    res = requests.get(url, headers=headers, timeout=10)
    print(f"Status Code: {res.status_code}")
    if res.status_code == 200:
        issues = res.json()
        print(f"Total Issues/Bug Reports Found: {len(issues)}\n")
        for i in issues:
            is_pull_request = 'pull_request' in i
            item_type = 'PR' if is_pull_request else 'ISSUE'
            print(f"[{item_type} #{i['number']}] ({i['state'].upper()}) - {i['title']}")
            print(f"Author: {i['user']['login']}")
            print(f"Created: {i['created_at']}")
            print(f"URL: {i['html_url']}")
            body = i.get('body') or 'No description provided.'
            print(f"Body:\n{body}\n")
            print("=" * 60)
    else:
        print("Response:", res.text)
except Exception as e:
    print("Error fetching GitHub issues:", e)
