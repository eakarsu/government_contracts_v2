#!/usr/bin/env python3
"""
Fix corrupted database snapshot data
"""
import json

def fix_snapshot_data():
    """Remove corrupted entries from database snapshot"""
    
    with open('database_snapshots/complete_snapshot.json', 'r') as f:
        snapshot = json.load(f)
    
    # Fix user table data
    user_data = snapshot['tables']['user']['data']
    print(f"Original user entries: {len(user_data)}")
    
    # Remove invalid entries
    valid_entries = []
    for entry in user_data:
        if 'user' in entry and 'email' not in entry:
            print(f"Removing invalid entry: {entry}")
        else:
            valid_entries.append(entry)
    
    snapshot['tables']['user']['data'] = valid_entries
    snapshot['tables']['user']['row_count'] = len(valid_entries)
    print(f"Cleaned user entries: {len(valid_entries)}")
    
    # Save fixed snapshot
    with open('database_snapshots/complete_snapshot_fixed.json', 'w') as f:
        json.dump(snapshot, f, indent=2)
    
    print("Fixed snapshot saved as complete_snapshot_fixed.json")

if __name__ == "__main__":
    fix_snapshot_data()