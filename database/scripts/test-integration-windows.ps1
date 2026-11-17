$ErrorActionPreference = 'Stop'

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$backendPath = Join-Path $repositoryRoot 'backend'
$nodeCandidates = @((Join-Path $env:ProgramFiles 'nodejs'))
$nodeCandidates += [Environment]::GetEnvironmentVariable('Path', 'User') -split ';'
$nodePath = $nodeCandidates | Where-Object { $_ -and (Test-Path (Join-Path $_ 'npm.cmd')) } | Select-Object -First 1
$environmentNames = @('DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'NODE_ENV', 'JWT_SECRET')
$previousEnvironment = @{}
$previousPath = $env:Path
$securePassword = $null
$passwordPointer = [IntPtr]::Zero
$randomGenerator = $null
$exitCode = 0

foreach ($name in $environmentNames) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

try {
    if (-not (Test-Path (Join-Path $backendPath 'package.json'))) {
        throw "Backend package.json not found at $backendPath"
    }

    if (Test-Path (Join-Path $nodePath 'npm.cmd')) {
        $env:Path = "$nodePath;$env:Path"
    }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        throw 'npm.cmd was not found. Install Node.js or reopen the terminal.'
    }

    $securePassword = Read-Host 'MySQL root password for localhost' -AsSecureString
    if ($securePassword.Length -eq 0) {
        throw 'A MySQL root password is required.'
    }

    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    $env:DB_HOST = '127.0.0.1'
    $env:DB_PORT = '3306'
    $env:DB_USER = 'root'
    $env:DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
    $env:DB_NAME = 'laundry_manager_test'
    $env:NODE_ENV = 'test'

    $randomBytes = New-Object byte[] 32
    $randomGenerator = [Security.Cryptography.RandomNumberGenerator]::Create()
    $randomGenerator.GetBytes($randomBytes)
    $env:JWT_SECRET = [Convert]::ToBase64String($randomBytes)

    Push-Location $backendPath
    try {
        & npm.cmd run test:integration
        if ($LASTEXITCODE -ne 0) {
            throw "Integration tests failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host 'Integration tests passed.'
}
catch {
    Write-Error -Message $_ -ErrorAction Continue
    $exitCode = 1
}
finally {
    if ($passwordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
    }
    if ($null -ne $securePassword) {
        $securePassword.Dispose()
    }
    if ($null -ne $randomGenerator) {
        $randomGenerator.Dispose()
    }
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], 'Process')
    }
    $env:Path = $previousPath
}

if ($exitCode -ne 0) {
    exit $exitCode
}
