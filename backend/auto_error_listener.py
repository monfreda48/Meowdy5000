import sqlite3
import time
import json
import os
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'stats.db')
PROCESSED_LOG = os.path.join(BASE_DIR, 'processed_errors.json')

def load_processed_ids():
    if os.path.exists(PROCESSED_LOG):
        try:
            with open(PROCESSED_LOG, 'r', encoding='utf-8') as f:
                return set(json.load(f))
        except Exception:
            return set()
    return set()

def save_processed_ids(ids_set):
    try:
        with open(PROCESSED_LOG, 'w', encoding='utf-8') as f:
            json.dump(list(ids_set), f)
    except Exception as e:
        print(f"Error saving processed IDs: {e}")

def check_unhandled_errors():
    processed = load_processed_ids()
    new_reports = []

    # 1. Check local SQLite telemetry database
    if os.path.exists(DB_PATH):
        try:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.execute('SELECT id, timestamp, error_message, stack_trace, user_notes, platform FROM error_reports ORDER BY id ASC')
            rows = cursor.fetchall()
            conn.close()
            
            for row in rows:
                report_id = f"db_{row[0]}"
                if report_id not in processed:
                    new_reports.append({
                        "id": report_id,
                        "timestamp": row[1],
                        "error": row[2],
                        "stack": row[3],
                        "notes": row[4],
                        "platform": row[5],
                        "source": "SQLite Telemetry DB"
                    })
        except Exception as e:
            print(f"Error querying error_reports table: {e}")

    # 2. Check GitHub Open Issues API
    try:
        req = urllib.request.Request(
            "https://api.github.com/repos/monfreda48/Meowdy5000/issues?state=open",
            headers={"User-Agent": "MeowdyErrorListener/1.0", "Accept": "application/vnd.github.v3+json"}
        )
        with urllib.request.urlopen(req, timeout=8) as response:
            if response.status == 200:
                issues = json.loads(response.read().decode('utf-8'))
                for issue in issues:
                    issue_id = f"gh_{issue.get('number')}"
                    if issue_id not in processed:
                        new_reports.append({
                            "id": issue_id,
                            "timestamp": issue.get('created_at', ''),
                            "error": issue.get('title', ''),
                            "stack": issue.get('body', ''),
                            "notes": f"GitHub Issue #{issue.get('number')} by @{issue.get('user', {}).get('login')}",
                            "platform": "GitHub Repository Issue",
                            "source": "GitHub REST API"
                        })
    except Exception as gh_err:
        print(f"Error querying GitHub Issues API: {gh_err}")

    return new_reports

if __name__ == "__main__":
    reports = check_unhandled_errors()
    if reports:
        print(f"[AutoErrorListener] {len(reports)} new error report(s) detected across SQLite & GitHub!")
        for r in reports:
            print(f"  -> ID #{r['id']} ({r['source']}): [{r['platform']}] {r['error']}")
            if r.get('notes'):
                print(f"     Notes: {r['notes']}")
    else:
        print("[AutoErrorListener] All error reports processed across SQLite DB & GitHub. 0 new unhandled exceptions.")
