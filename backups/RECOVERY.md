# Database Recovery Guide

This document explains how to restore the `g2g_bonus_db` database from a backup file.

## Prerequisites
- MariaDB/MySQL installed and running.
- Access to the `backups/` directory containing `.sql.zip` files.
- Command-line access (PowerShell or CMD).

## Restoration Steps

### 1. Locate the Backup
Find the most recent successful backup in the `backups/` folder (e.g., `backup_g2g_bonus_db_2025-01-13_0200.sql.zip`).

### 2. Extract the SQL File
Extract the `.sql` file from the `.zip` archive.

### 3. Restore via Command Line
Open PowerShell and run the following command (adjust paths as necessary):

```powershell
# Navigate to the MariaDB bin directory
cd "C:\Program Files\MariaDB 12.1\bin"

# Run the restore command
# Replace [PASSWORD] with your actual password
# WARNING: This will overwrite existing data!
cat "C:\path\to\your\extracted_backup.sql" | .\mariadb.exe -u root -p g2g_bonus_db
```

*Note: If you have a database password, add `-p` after `root`.*

### 4. Verify Restoration
Log in to the application and check if the most recent data (Audit logs, Payments) is present.

---

## Setting up Automated Backups
To run the backup script automatically:
1. Open **Windows Task Scheduler**.
2. Create a **Basic Task** named "G2G_DB_Backup".
3. Trigger: **Daily** (e.g., 2:00 AM).
4. Action: **Start a program**.
5. Program/script: `powershell.exe`
6. Add arguments: `-ExecutionPolicy Bypass -File "C:\xampp\htdocs\g2g-bonus-payment\scripts\backup_db.ps1"`
