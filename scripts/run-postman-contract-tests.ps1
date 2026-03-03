param(
    [string]$CollectionPath = "postman/collections/board-third-party-library-api.contract-tests.postman_collection.json",
    [string]$EnvironmentPath = "postman/environments/board-third-party-library_local.postman_environment.json",
    [string]$BaseUrl = "https://localhost:7085",
    [ValidateSet("live", "mock")]
    [string]$ContractExecutionMode = "live",
    [string]$ReportPath = "postman-cli-reports/local-contract-tests.xml"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiRoot = (Resolve-Path (Join-Path $scriptDir "..")).Path

if (-not (Get-Command postman -ErrorAction SilentlyContinue)) {
    throw "Postman CLI is not installed or not on PATH. Install it, then rerun this script."
}

Push-Location $apiRoot
try {
    $reportDirectory = Split-Path -Parent $ReportPath
    if ($reportDirectory) {
        New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
    }

    & postman collection run $CollectionPath `
        --environment $EnvironmentPath `
        --env-var "baseUrl=$BaseUrl" `
        --env-var "contractExecutionMode=$ContractExecutionMode" `
        --insecure `
        --bail failure `
        --reporters cli,junit `
        --reporter-junit-export $ReportPath `
        --working-dir $apiRoot

    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
