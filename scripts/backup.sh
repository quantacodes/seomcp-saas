#!/bin/bash
# SQLite backup script - run via cron daily

DATA_DIR="/var/lib/seomcp"
BACKUP_DIR="/var/backups/seomcp"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Create backup
sqlite3 "$DATA_DIR/data.db" ".backup '$BACKUP_DIR/data_$DATE.db'"

# Keep only last 7 days
find "$BACKUP_DIR" -name "data_*.db" -mtime +7 -delete

echo "✅ Backup created: $BACKUP_DIR/data_$DATE.db"
