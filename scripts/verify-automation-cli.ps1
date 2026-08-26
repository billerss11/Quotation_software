[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ExecutablePath,
  [switch]$KeepArtifacts
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedExecutable = (Resolve-Path -LiteralPath $ExecutablePath).Path
if ([System.IO.Path]::GetExtension($resolvedExecutable) -ne '.exe') {
  throw 'ExecutablePath must point to a packaged Windows .exe file.'
}

$fixtureDirectory = Join-Path $projectRoot 'output\qa\automation-smoke'
$quotationFixture = Join-Path $fixtureDirectory 'fabricated-quotation.json'
$goodsReceiptFixture = Join-Path $fixtureDirectory 'fabricated-quotation-with-gr.json'
if (-not (Test-Path -LiteralPath $quotationFixture) -or -not (Test-Path -LiteralPath $goodsReceiptFixture)) {
  throw 'Automation smoke fixtures are missing.'
}

$runDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "quotation-automation-$([guid]::NewGuid())"
$quotationText = -join @([char]0x62A5, [char]0x4EF7)
$automationText = -join @([char]0x81EA, [char]0x52A8, [char]0x5316)
$customerText = -join @([char]0x5BA2, [char]0x6237)
$pumpGroupText = -join @([char]0x6CF5, [char]0x7EC4)
$goodsReceiptText = -join @([char]0x6536, [char]0x8D27, [char]0x5355)
$normalizedText = -join @([char]0x6807, [char]0x51C6, [char]0x5316, [char]0x62A5, [char]0x4EF7)
$resultText = -join @([char]0x6267, [char]0x884C, [char]0x7ED3, [char]0x679C)
$progressText = -join @([char]0x8FDB, [char]0x5EA6)
$unicodeProjectName = "$automationText$pumpGroupText$quotationText"
$unicodeDirectory = Join-Path $runDirectory "$quotationText $automationText"
New-Item -ItemType Directory -Path $unicodeDirectory -Force | Out-Null

function Assert-Condition([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Invoke-AutomationCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][int]$ExpectedExitCode
  )

  $stdoutPath = Join-Path $runDirectory "$Name.stdout.log"
  $stderrPath = Join-Path $runDirectory "$Name.stderr.log"
  $processArguments = $Arguments | ForEach-Object {
    if ($_ -match '[\s"]') { '"' + $_.Replace('"', '\"') + '"' } else { $_ }
  }
  $process = Start-Process `
    -FilePath $resolvedExecutable `
    -ArgumentList $processArguments `
    -WorkingDirectory $runDirectory `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -Wait `
    -PassThru

  $stdout = if (Test-Path -LiteralPath $stdoutPath) {
    Get-Content -LiteralPath $stdoutPath -Raw -Encoding utf8
  } else { '' }
  $stderr = if (Test-Path -LiteralPath $stderrPath) {
    Get-Content -LiteralPath $stderrPath -Raw -Encoding utf8
  } else { '' }

  if ($process.ExitCode -ne $ExpectedExitCode) {
    throw "$Name returned exit code $($process.ExitCode), expected $ExpectedExitCode.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
  }

  $reportLine = @($stdout -split "`r?`n" | Where-Object { $_.Trim().Length -gt 0 })[-1]
  $report = $reportLine | ConvertFrom-Json
  Assert-Condition ($report.exitCode -eq $ExpectedExitCode) "$Name report exit code did not match the process exit code."
  return $report
}

function Assert-Pdf([string]$FilePath) {
  Assert-Condition (Test-Path -LiteralPath $FilePath) "Missing PDF: $FilePath"
  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  Assert-Condition ($bytes.Length -gt 4) "Empty PDF: $FilePath"
  $signature = [System.Text.Encoding]::ASCII.GetString($bytes, 0, 4)
  Assert-Condition ($signature -eq '%PDF') "Invalid PDF signature: $FilePath"
}

function Get-Sha256([string]$FilePath) {
  $stream = [System.IO.File]::OpenRead($FilePath)
  $sha256 = [System.Security.Cryptography.SHA256]::Create()
  try {
    return ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '')
  } finally {
    $sha256.Dispose()
    $stream.Dispose()
  }
}

try {
  $unicodeInput = Join-Path $unicodeDirectory "$customerText$quotationText.json"
  $unicodeQuotation = Get-Content -LiteralPath $goodsReceiptFixture -Raw -Encoding utf8 | ConvertFrom-Json
  $unicodeQuotation.quotation.header.projectName = $unicodeProjectName
  $unicodeQuotation | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $unicodeInput -Encoding utf8

  $quotationPdf = Join-Path $unicodeDirectory "$quotationText$([char]0x5355).pdf"
  $goodsReceiptPdf = Join-Path $unicodeDirectory "$goodsReceiptText.pdf"
  $normalizedJson = Join-Path $unicodeDirectory "$normalizedText.json"
  $renderResult = Join-Path $unicodeDirectory "$resultText.json"
  $progressJson = Join-Path $unicodeDirectory "$progressText.json"
  $renderReport = Invoke-AutomationCommand -Name 'render-unicode' -ExpectedExitCode 0 -Arguments @(
    '--automation', 'render', '--input', $unicodeInput,
    '--quotation-pdf', $quotationPdf,
    '--goods-receipt-pdf', $goodsReceiptPdf,
    '--output-json', $normalizedJson,
    '--result-json', $renderResult,
    '--progress-json', $progressJson,
    '--no-network'
  )
  Assert-Pdf $quotationPdf
  Assert-Pdf $goodsReceiptPdf
  Assert-Condition $renderReport.ok 'Unicode render report was not successful.'
  Assert-Condition ((Get-Content -LiteralPath $renderResult -Raw -Encoding utf8 | ConvertFrom-Json).ok) 'Saved render report is invalid.'
  Assert-Condition ((Get-Content -LiteralPath $progressJson -Raw -Encoding utf8 | ConvertFrom-Json).status -eq 'completed') 'Progress did not finish as completed.'
  Assert-Condition ((Get-Content -LiteralPath $normalizedJson -Raw -Encoding utf8 | ConvertFrom-Json).quotation.header.projectName -eq $unicodeProjectName) 'Unicode quotation content was not preserved.'

  $invalidInput = Join-Path $runDirectory 'invalid-schema.json'
  '{"schemaVersion":999,"app":"quotation-software","exportedAt":"2026-08-26T00:00:00.000Z","quotation":{}}' | Set-Content -LiteralPath $invalidInput -Encoding utf8
  $invalidReport = Invoke-AutomationCommand -Name 'invalid-schema' -ExpectedExitCode 3 -Arguments @(
    '--automation', 'validate', '--input', $invalidInput
  )
  Assert-Condition ($invalidReport.errors[0].code -eq 'unsupported_schema') 'Invalid schema did not return unsupported_schema.'

  $missingReceiptReport = Invoke-AutomationCommand -Name 'missing-goods-receipt' -ExpectedExitCode 6 -Arguments @(
    '--automation', 'render', '--input', $quotationFixture,
    '--goods-receipt-pdf', (Join-Path $runDirectory 'missing-receipt.pdf'),
    '--no-network'
  )
  Assert-Condition ($missingReceiptReport.errors[0].code -eq 'goods_receipt_missing') 'Missing goods receipt returned the wrong code.'

  $existingPdf = Join-Path $runDirectory 'existing.pdf'
  'keep-me' | Set-Content -LiteralPath $existingPdf -Encoding utf8
  $existingReport = Invoke-AutomationCommand -Name 'existing-output' -ExpectedExitCode 5 -Arguments @(
    '--automation', 'render', '--input', $quotationFixture,
    '--quotation-pdf', $existingPdf,
    '--no-network'
  )
  Assert-Condition ($existingReport.errors[0].code -eq 'output_exists') 'Existing output returned the wrong code.'
  Assert-Condition ((Get-Content -LiteralPath $existingPdf -Raw -Encoding utf8).Trim() -eq 'keep-me') 'Existing output was modified.'

  $rateFailureInput = Join-Path $runDirectory 'rate-failure.json'
  $rateFailureQuotation = Get-Content -LiteralPath $quotationFixture -Raw -Encoding utf8 | ConvertFrom-Json
  $rateFailureQuotation.quotation.header.currency = 'XSU'
  $rateFailureQuotation.quotation.exchangeRates = [pscustomobject]@{ XSU = 1; USD = 1 }
  function Set-UnsupportedCostCurrency($Rows) {
    foreach ($row in $Rows) {
      if ($null -ne $row.PSObject.Properties['costCurrency']) { $row.costCurrency = 'XSU' }
      if ($null -ne $row.PSObject.Properties['children']) { Set-UnsupportedCostCurrency $row.children }
    }
  }
  Set-UnsupportedCostCurrency $rateFailureQuotation.quotation.majorItems
  $rateFailureQuotation | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $rateFailureInput -Encoding utf8
  $rateFailureHashBefore = Get-Sha256 $rateFailureInput
  $rateFailureOutput = Join-Path $runDirectory 'rate-failure-output.json'
  $rateFailureReport = Invoke-AutomationCommand -Name 'rate-failure' -ExpectedExitCode 4 -Arguments @(
    '--automation', 'render', '--input', $rateFailureInput,
    '--output-json', $rateFailureOutput,
    '--refresh-exchange-rates'
  )
  Assert-Condition ($rateFailureReport.errors[0].code -eq 'network_failed') 'Exchange-rate failure returned the wrong code.'
  Assert-Condition ((Get-Sha256 $rateFailureInput) -eq $rateFailureHashBefore) 'Exchange-rate failure modified the input.'
  Assert-Condition (-not (Test-Path -LiteralPath $rateFailureOutput)) 'Exchange-rate failure wrote normalized output.'

  $timeoutReport = Invoke-AutomationCommand -Name 'renderer-timeout' -ExpectedExitCode 6 -Arguments @(
    '--automation', 'validate', '--input', $quotationFixture, '--timeout-ms', '1'
  )
  Assert-Condition ($timeoutReport.errors[0].code -eq 'automation_timeout') 'Renderer timeout returned the wrong code.'

  $cancelFile = Join-Path $runDirectory 'stop.cancel'
  $cancelProgress = Join-Path $runDirectory 'cancel-progress.json'
  New-Item -ItemType File -Path $cancelFile | Out-Null
  $cancelReport = Invoke-AutomationCommand -Name 'cancel' -ExpectedExitCode 6 -Arguments @(
    '--automation', 'validate', '--input', $quotationFixture,
    '--cancel-file', $cancelFile, '--progress-json', $cancelProgress
  )
  Assert-Condition ($cancelReport.errors[0].code -eq 'automation_canceled') 'Cancellation returned the wrong code.'
  Assert-Condition ((Get-Content -LiteralPath $cancelProgress -Raw -Encoding utf8 | ConvertFrom-Json).status -eq 'canceled') 'Cancellation progress did not finish as canceled.'

  $manifestPath = Join-Path $runDirectory 'jobs.json'
  $batchResultPath = Join-Path $runDirectory 'batch-result.json'
  [pscustomobject]@{
    schemaVersion = 1
    jobs = @(
      [pscustomobject]@{ id = 'validate-1'; command = 'validate'; input = $quotationFixture; noNetwork = $true },
      [pscustomobject]@{ id = 'validate-2'; command = 'validate'; input = $unicodeInput; noNetwork = $true }
    )
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestPath -Encoding utf8
  $batchReport = Invoke-AutomationCommand -Name 'batch' -ExpectedExitCode 0 -Arguments @(
    '--automation', 'batch', '--manifest', $manifestPath, '--result-json', $batchResultPath
  )
  Assert-Condition ($batchReport.summary.total -eq 2 -and $batchReport.summary.succeeded -eq 2) 'Batch summary is incorrect.'

  if ($KeepArtifacts) {
    Write-Output "Automation CLI release verification passed. Artifacts: $runDirectory"
  } else {
    Write-Output 'Automation CLI release verification passed.'
  }
} finally {
  if (-not $KeepArtifacts -and (Test-Path -LiteralPath $runDirectory)) {
    Remove-Item -LiteralPath $runDirectory -Recurse -Force
  }
}
