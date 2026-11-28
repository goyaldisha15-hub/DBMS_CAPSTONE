# Creates the healthcare_db database and loads all SQL scripts (run from the dbms_capstone folder).
# WARNING: 01_schema.sql drops and recreates healthcare_db.
param([string]$Password = "Capstone123")
$mysql = "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe"
foreach ($f in "01_schema","02_sample_data","04_procedures_triggers","06_indexes_reports","02b_more_data") {
  Write-Host "Running $f.sql"
  Get-Content "sql\$f.sql" -Raw | & $mysql -u root "-p$Password"
}
& $mysql -u root "-p$Password" -e "USE healthcare_db; SHOW TABLES; SELECT bill_id, total_amount, status FROM bill;"
