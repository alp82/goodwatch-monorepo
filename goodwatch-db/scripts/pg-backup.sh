#!/bin/bash

# Variables
DATE=$(date +"%Y-%m-%d_%H-%M")
BACKUP_DIR="/root/backup"
PGUSER="postgres"
DBNAME="goodwatch"
RETENTION_DAYS_LOCAL=2
RETENTION_DAYS_REMOTE=7
REMOTE_USER="u417661-sub1"
REMOTE_HOST="u417661.your-storagebox.de"
REMOTE_PORT=23

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Starting backup"

# Step 1: Create backup
pg_dump -U ${PGUSER} ${DBNAME} | gzip > ${BACKUP_DIR}/${DBNAME}_${DATE}.sql.gz

# Step 2: Transfer to Hetzner Storage Box
scp -P ${REMOTE_PORT} ${BACKUP_DIR}/${DBNAME}_${DATE}.sql.gz ${REMOTE_USER}@${REMOTE_HOST}:.

# Step 3: Retrieve list of remote files
echo "Retrieving list of remote files..."
REMOTE_FILE_LIST=$(ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "ls -1 ${DBNAME}_*.sql.gz")
echo "Remote files:"
echo "${REMOTE_FILE_LIST}"

# Step 4: Calculate which files to delete based on modification times
TODAY=$(date +%s)
FILES_TO_DELETE=()

for file in ${REMOTE_FILE_LIST}; do
  # Get the file modification time from the remote server (using BSD-compatible stat)
  FILE_TIME=$(ssh -p ${REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "stat -f %m $file")

  # Calculate the file's age in days
  FILE_AGE=$(( (TODAY - FILE_TIME) / 86400 ))

  # If the file is older than the retention period, mark it for deletion
  if [ ${FILE_AGE} -gt ${RETENTION_DAYS_REMOTE} ]; then
    FILES_TO_DELETE+=("$file")
  fi
done

# Step 5: Send deletion commands back to the remote server
if [ ${#FILES_TO_DELETE[@]} -eq 0 ]; then
  echo "No old files to delete."
else
  echo "Deleting old files on remote server:"
  for file in "${FILES_TO_DELETE[@]}"; do
    echo "Deleting $file"
    ssh -p ${}REMOTE_PORT} ${REMOTE_USER}@${REMOTE_HOST} "rm $file"
  done
fi

echo "[$(date +"%Y-%m-%d %H:%M:%S")] Backup complete"