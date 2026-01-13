# G2G Bonus Tracker - MariaDB Backup Script
# Performs a daily dump of the g2g_bonus_db and maintains a 7-day retention.

# --- Configuration ---
$DbName = "g2g_bonus_db"
$DbUser = "root"
$DbPass = "root@123" 
$BackupDir = Join-Path -Path $PSScriptRoot -ChildPath "..\backups"
$DumpBinary = "C:\Program Files\MariaDB 12.1\bin\mariadb-dump.exe"
$Date = Get-Date -Format "yyyy-MM-dd_HHmm"
$BackupFile = Join-Path -Path $BackupDir -ChildPath "backup_$DbName`_$Date.sql"
$RetentionDays = 7

# --- Ensure backup directory exists ---
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir
}

Write-Host "Starting MariaDB backup for $DbName..." -ForegroundColor Cyan

# --- Perform Dump ---
if (Test-Path $DumpBinary) {
    # Using --password to avoid prompt. Note: Plain text in script is discouraged for production.
    # The -p flag should not have a space before the password for compatibility.
    $DumpCmd = "& '$DumpBinary' -u $DbUser --password='$DbPass' $DbName > '$BackupFile'"
    Invoke-Expression $DumpCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ SQL dump created successfully." -ForegroundColor Green
        
        # --- Compress ---
        Compress-Archive -Path $BackupFile -DestinationPath "$BackupFile.zip"
        Remove-Item $BackupFile
        
        Write-Host "✅ Backup compressed to backup_$DbName`_$Date.sql.zip" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Error: MariaDB dump failed with exit code $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
}
else {
    Write-Host "❌ Error: MariaDB dump binary not found at $DumpBinary" -ForegroundColor Red
    exit 1
}

# --- Cleanup Old Backups (Retention) ---
Write-Host "Cleaning up backups older than $RetentionDays days..." -ForegroundColor Yellow
$OldBackups = Get-ChildItem -Path $BackupDir -Filter "*.zip" | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) }
if ($OldBackups) {
    $OldBackups | Remove-Item
    Write-Host "✅ Cleanup complete." -ForegroundColor Green
}
else {
    Write-Host "No old backups to clean up." -ForegroundColor Gray
}

Write-Host "Backup process finished." -ForegroundColor Cyan
