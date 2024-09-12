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
ssh -p23 u417661-sub1@u417661.your-storagebox.de "find . -type f -name '${DBNAME}_*.sql.gz' -mtime +${RETENTION_DAYS_REMOTE} -exec rm {} \;"

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Backup complete"
