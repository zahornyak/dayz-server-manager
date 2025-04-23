#!/bin/bash

# Backup Cleanup Script for DayZ Server Manager based on creation time patterns
# This script deletes backups based on their creation time

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
        
        # Extract timestamp from directory name
        # Format: mpmissions_YYYY-MM-DD-HH-MM
        if [[ "$dir_name" =~ mpmissions_[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}-([0-9]{1,2})-([0-9]{1,2}) ]]; then
            HOUR=${BASH_REMATCH[1]}
            MINUTE=${BASH_REMATCH[2]}
            
            # Determine backup type based on time pattern
            if [[ $MINUTE == 00 && $HOUR == 00 ]]; then
                # Daily backup at midnight (00:00)
                MAX_AGE=$DAILY_RETENTION
                TYPE="daily"
            elif [[ $MINUTE == 00 ]]; then
                # Hourly backup (minute = 00, any hour)
                MAX_AGE=$HOURLY_RETENTION
                TYPE="hourly"
            else
                # All other backups are considered frequent (every 5 minutes)
                MAX_AGE=$FREQUENT_RETENTION
                TYPE="frequent"
            fi
            
            # Delete if older than max age
            if [ $AGE_MINUTES -gt $MAX_AGE ]; then
                echo "Deleting $TYPE backup: $dir_name (Age: $AGE_MINUTES minutes)"
                rm -rf "$backup_dir"
            else
                echo "Keeping $TYPE backup: $dir_name (Age: $AGE_MINUTES minutes)"
            fi
        else
            echo "Skipping directory with unrecognized format: $dir_name"
        fi
    fi
done

echo "Backup cleanup completed at $(date)" 