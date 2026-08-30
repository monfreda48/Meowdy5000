---
name: rivals-telemetry
description: Real-time telemetry monitoring & SQLite error analysis for Meowdy 5000 Rivals Tracker
---

# Rivals Telemetry & Error Monitoring Skill

Use this skill when analyzing or debugging player search errors, client exceptions, or telemetry database records for Marvel Rivals Stat Tracker.

## Database Location
- Path: `c:/Users/User/Desktop/RivalsTracker/backend/stats.db`

## Primary Tables
- `error_reports`: Contains client & server unhandled stack traces, user notes, user agents, and timestamps.
- `player_history`: Contains historical player lookup snapshots (query, win_rate, kd_ratio, top_hero).

## Standard Inspection Flow
1. Query unhandled error reports:
   ```sql
   SELECT id, timestamp, error_message, stack_trace, user_notes, platform
   FROM error_reports
   ORDER BY id DESC LIMIT 10;
   ```
2. Verify resolution: Mark processed ID in `backend/processed_errors.json`.
