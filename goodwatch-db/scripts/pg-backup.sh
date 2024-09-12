#!/bin/bash

# Variables
DATE=$(date +"%Y-%m-%d_%H-%M")
BACKUP_DIR="/root/backup"
PGUSER="postgres"
DBNAME="goodwatch"
RETENTION_DAYS_LOCAL=2
RETENTION_DAYS_REMOTE=7

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Starting backup"

# Create backup
pg_dump -U $PGUSER $DBNAME | gzip > $BACKUP_DIR/${DBNAME}_${DATE}.sql.gz

# Transfer to Hetzner Storage Box
scp -P 23 $BACKUP_DIR/${DBNAME}_${DATE}.sql.gz u417661-sub1@u417661.your-storagebox.de:.

# Cleanup: Remove local backups older than retention period
find $BACKUP_DIR -type f -name "${DBNAME}_*.sql.gz" -mtime +${RETENTION_DAYS_LOCAL} -exec rm {} \;

# Cleanup: Remove remote backups older than retention period (using SSH on the remote storage)
ssh -p23 u417661-sub1@u417661.your-storagebox.de "
DBNAME=${DBNAME}
RETENTION_DAYS_REMOTE=${RETENTION_DAYS_REMOTE}
TODAY=\$(date +%s)

# List files and filter for ones matching the backup pattern
for file in \$(ls \${DBNAME}_*.sql.gz); do
  # Get the modification time of the file
  FILE_TIME=\$(stat -c %Y \"\$file\")

  # Calculate the file's age in days
  FILE_AGE=\$(( (TODAY - FILE_TIME) / 86400 ))

  # If the file is older than the retention days, delete it
  if [ \$FILE_AGE -gt \$RETENTION_DAYS_REMOTE ]; then
    echo \"Deleting \$file (Age: \$FILE_AGE days)\"
    rm \"\$file\"
  fi
done
"

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Backup complete"
