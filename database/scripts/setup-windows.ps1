$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$backendEnv = Join-Path $env:LOCALAPPDATA 'LaundryManager\backend.env'
$legacyEnv = Join-Path $projectRoot 'backend\.env'
$mysqlExe = Join-Path $env:ProgramFiles 'MySQL\MySQL Server 8.4\bin\mysql.exe'

if ((Test-Path $backendEnv) -or (Test-Path $legacyEnv)) {
    throw 'Ya existe una configuración local. No se modificó ni se sobrescribió.'
}
if (-not (Test-Path $mysqlExe)) {
    throw "No se encontró mysql.exe en la ruta esperada: $mysqlExe"
}

$schema = Get-Content (Join-Path $projectRoot 'database\schema.sql') -Raw
$seed = Get-Content (Join-Path $projectRoot 'database\seeds\development.sql') -Raw
$tempSql = Join-Path $env:TEMP ("laundry-setup-{0}.sql" -f [Guid]::NewGuid().ToString('N'))

try {
    $appBytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($appBytes)
    $appPassword = [Convert]::ToBase64String($appBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

    $appSql = @"
USE laundry_manager;
CREATE USER 'laundry_api'@'localhost' IDENTIFIED BY '$appPassword';
GRANT SELECT, INSERT, UPDATE ON laundry_manager.* TO 'laundry_api'@'localhost';
"@
    $sqlText = $schema + "`r`n" + $seed + "`r`n" + $appSql
    [IO.File]::WriteAllText($tempSql, $sqlText, (New-Object Text.UTF8Encoding($false)))
    $account = '{0}\{1}' -f $env:USERDOMAIN, $env:USERNAME
    & icacls.exe $tempSql /inheritance:r /grant:r "${account}:(F)" 'NT AUTHORITY\SYSTEM:(F)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'No se pudieron limitar los permisos del archivo temporal SQL.' }

    Write-Output 'Se aplicará el esquema y el catálogo de desarrollo. Introduce root en el prompt de MySQL; la contraseña no se mostrará.'
    $cmd = '/d /c ""{0}" --protocol=TCP --host=127.0.0.1 --user=root --password < "{1}""' -f $mysqlExe, $tempSql
    & $env:ComSpec $cmd
    if ($LASTEXITCODE -ne 0) {
        throw 'MySQL no pudo completar la configuración. Revisa el error anterior; no se creó backend\.env.'
    }

    $jwtBytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($jwtBytes)
    $jwtSecret = [Convert]::ToBase64String($jwtBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    $envText = @"
NODE_ENV=development
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=laundry_manager
DB_USER=laundry_api
DB_PASSWORD=$appPassword
JWT_SECRET=$jwtSecret
COOKIE_SECURE=false
"@
    $envDirectory = Split-Path $backendEnv -Parent
    New-Item -ItemType Directory -Path $envDirectory -Force | Out-Null
    [IO.File]::WriteAllText($backendEnv, $envText, (New-Object Text.UTF8Encoding($false)))
    & icacls.exe $backendEnv /inheritance:r /grant:r "${account}:(F)" 'NT AUTHORITY\SYSTEM:(F)' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'La configuración se guardó, pero no se pudieron restringir sus permisos. Revisa backend.env local.' }
    Write-Output 'Configuración terminada. Los secretos se guardaron en LocalAppData, fuera de la carpeta sincronizada del proyecto.'
}
finally {
    Remove-Item $tempSql -Force -ErrorAction SilentlyContinue
}
