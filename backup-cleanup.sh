#!/bin/bash

# Backup Cleanup Script for DayZ Server Manager based on backup types in folder name
# This script deletes backups based on their type identifier in the name

# Configure paths
BACKUP_DIR="/path/to/your/backups"  # Change this to your backup directory

# Configure retention periods (in minutes)
FREQUENT_RETENTION=300    # 5 hours (300 minutes)
HOURLY_RETENTION=720      # 12 hours (720 minutes)
DAILY_RETENTION=20160     # 14 days (20160 minutes)

# Get current timestamp
CURRENT_TIME=$(date +%s)

# Process all backup directories
for backup_dir in "$BACKUP_DIR"/mpmissions_*; do
    if [ -d "$backup_dir" ]; then
        # Extract the directory name
        dir_name=$(basename "$backup_dir")
        
        # Get the creation time
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            CREATED=$(stat -f "%m" "$backup_dir")
        else
            # Linux
            CREATED=$(stat -c "%Y" "$backup_dir")
        fi
        
        # Calculate age in minutes
        AGE_MINUTES=$(( (CURRENT_TIME - CREATED) / 60 ))
        
        # Determine backup type based on the folder name
        if [[ "$dir_name" == *"-5min-backup"* ]]; then
            MAX_AGE=$FREQUENT_RETENTION
            TYPE="frequent (5min)"
        elif [[ "$dir_name" == *"-hourly-backup"* ]]; then
            MAX_AGE=$HOURLY_RETENTION
            TYPE="hourly"
        elif [[ "$dir_name" == *"-daily-backup"* ]]; then
            MAX_AGE=$DAILY_RETENTION
            TYPE="daily"
        elif [[ "$dir_name" == *"-mission-file-edit"* || "$dir_name" == *"-file-edit"* || "$dir_name" == *"-pre-restore"* ]]; then
            # Special handling for file edit backups - keep for 1 day
            MAX_AGE=1440  # 24 hours (1440 minutes)
            TYPE="file-edit"
        else
            # Default to daily retention for unrecognized backups
            MAX_AGE=$DAILY_RETENTION
            TYPE="unknown (default to daily)"
        fi
        
        # Delete if older than max age
        if [ $AGE_MINUTES -gt $MAX_AGE ]; then
            echo "Deleting $TYPE backup: $dir_name (Age: $AGE_MINUTES minutes)"
            rm -rf "$backup_dir"
        else
            echo "Keeping $TYPE backup: $dir_name (Age: $AGE_MINUTES minutes)"
        fi
    fi
done

echo "Backup cleanup completed at $(date)" 