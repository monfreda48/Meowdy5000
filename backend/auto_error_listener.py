import sqlite3
import time
import json
import os

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
    if not os.path.exists(DB_PATH):
        return []
    
    processed = load_processed_ids()
    new_reports = []
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.execute('SELECT id, timestamp, error_message, stack_trace, user_notes, platform FROM error_reports ORDER BY id ASC')
        rows = cursor.fetchall()
        conn.close()
        
        for row in rows:
            report_id = row[0]
            if report_id not in processed:
                new_reports.append({
                    "id": report_id,
                    "timestamp": row[1],
                    "error": row[2],
                    "stack": row[3],
                    "notes": row[4],
                    "platform": row[5]
                })
    except Exception as e:
        print(f"Error querying error_reports table: {e}")
        
    return new_reports

if __name__ == "__main__":
    reports = check_unhandled_errors()
    if reports:
        print(f"[AutoErrorListener] {len(reports)} new error report(s) detected!")
        for r in reports:
            print(f"  -> ID #{r['id']}: [{r['platform']}] {r['error']}")
    else:
        print("[AutoErrorListener] All error reports processed. 0 new unhandled exceptions.")
