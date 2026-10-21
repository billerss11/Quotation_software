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
  $resultFlagIndex = [Array]::IndexOf($Arguments, '--result-json')
  $reportPath = if ($resultFlagIndex -ge 0) {
    $Arguments[$resultFlagIndex + 1]
  } else {
    Join-Path $runDirectory "$Name.result.json"
  }
  if ($resultFlagIndex -lt 0) {
    $Arguments = $Arguments + @('--result-json', $reportPath)
  }
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

  # Packaged Windows GUI executables may not expose standard output.
  Assert-Condition (Test-Path -LiteralPath $reportPath) "$Name did not write its JSON report.`nSTDOUT:`n$stdout`nSTDERR:`n$stderr"
  $report = Get-Content -LiteralPath $reportPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($Arguments -notcontains 'api-info') {
    Assert-Condition ($report.exitCode -eq $ExpectedExitCode) "$Name report exit code did not match the process exit code."
  }
  return $report
}

function Assert-Pdf([string]$FilePath) {
  Assert-Condition (Test-Path -LiteralPath $FilePath) "Missing PDF: $FilePath"
  $bytes = [System.IO.File]::ReadAllBytes($FilePath)
  Assert-Condition ($bytes.Length -gt 4) "Empty PDF: $FilePath"
  $signature = [System.Text.Encoding]::ASCII.GetString($bytes, 0, 4)
  Assert-Condition ($signature -eq '%PDF') "Invalid PDF signature: $FilePath"
}

function Assert-Xlsx([string]$FilePath, [string]$Mode) {
  Assert-Condition (Test-Path -LiteralPath $FilePath) "Missing XLSX: $FilePath"
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::OpenRead($FilePath)
  try {
    foreach ($entryName in @('[Content_Types].xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/styles.xml')) {
      Assert-Condition ($null -ne $archive.GetEntry($entryName)) "XLSX is missing ${entryName}: $FilePath"
    }
    function Read-WorkbookXml([string]$EntryName) {
      $entry = $archive.GetEntry($EntryName)
      Assert-Condition ($null -ne $entry) "XLSX is missing ${EntryName}: $FilePath"
      $reader = [System.IO.StreamReader]::new($entry.Open())
      try {
        return ,([xml]$reader.ReadToEnd())
      } finally {
        $reader.Dispose()
      }
    }
    $workbook = Read-WorkbookXml 'xl/workbook.xml'
    $worksheet = Read-WorkbookXml 'xl/worksheets/sheet1.xml'
    $namespaceManager = [System.Xml.XmlNamespaceManager]::new($worksheet.NameTable)
    $namespaceManager.AddNamespace('s', 'http://schemas.openxmlformats.org/spreadsheetml/2006/main')
    $sheets = $workbook.SelectNodes('//s:sheets/s:sheet', $namespaceManager)
    if ($Mode -eq 'customer') {
      Assert-Condition ($sheets.Count -eq 1 -and $sheets[0].GetAttribute('state') -notin @('hidden', 'veryHidden')) "Customer XLSX must have one visible sheet: $FilePath"
      Assert-Condition ($worksheet.SelectNodes('//s:f', $namespaceManager).Count -eq 0) "Customer XLSX must contain values only: $FilePath"
      Assert-Condition ($null -eq $worksheet.SelectSingleNode('//s:sheetProtection', $namespaceManager)) "Customer XLSX must allow ordinary document edits: $FilePath"
    } else {
      Assert-Condition ($sheets.Count -eq 3) "Internal XLSX must have Pricing, Costs and calculation sheets: $FilePath"
      Assert-Condition ($sheets[2].GetAttribute('state') -eq 'veryHidden') "Internal calculation sheet must be hidden: $FilePath"
      foreach ($index in 1..3) {
        $part = Read-WorkbookXml "xl/worksheets/sheet$index.xml"
        Assert-Condition ($part.SelectNodes('//s:f', $namespaceManager).Count -gt 0) "Internal sheet $index contains no formulas: $FilePath"
        Assert-Condition ($null -ne $part.SelectSingleNode('//s:sheetProtection', $namespaceManager)) "Internal sheet $index must protect formulas: $FilePath"
      }
    }
  } finally {
    $archive.Dispose()
  }
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
  $apiInfo = Invoke-AutomationCommand -Name 'api-info' -ExpectedExitCode 0 -Arguments @('--automation', 'api-info')
  Assert-Condition ([version]$apiInfo.apiVersion -ge [version]'2.3.0') 'The automation API is older than 2.3.0.'
  foreach ($outputKind in @('quotation-pdf', 'goods-receipt-pdf', 'quotation-json', 'quotation-customer-xlsx', 'quotation-internal-xlsx')) {
    Assert-Condition ($apiInfo.supportedOutputs -contains $outputKind) "API information does not advertise $outputKind."
  }

  $unicodeInput = Join-Path $unicodeDirectory "$customerText$quotationText.json"
  $unicodeQuotation = Get-Content -LiteralPath $goodsReceiptFixture -Raw -Encoding utf8 | ConvertFrom-Json
  $unicodeQuotation.quotation.header.projectName = $unicodeProjectName
  $unicodeQuotation | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $unicodeInput -Encoding utf8

  $quotationPdf = Join-Path $unicodeDirectory "$quotationText$([char]0x5355).pdf"
  $goodsReceiptPdf = Join-Path $unicodeDirectory "$goodsReceiptText.pdf"
  $customerXlsx = Join-Path $unicodeDirectory "$customerText$quotationText.xlsx"
  $internalXlsx = Join-Path $unicodeDirectory "$quotationText-internal.xlsx"
  $normalizedJson = Join-Path $unicodeDirectory "$normalizedText.json"
  $renderResult = Join-Path $unicodeDirectory "$resultText.json"
  $progressJson = Join-Path $unicodeDirectory "$progressText.json"
  $renderReport = Invoke-AutomationCommand -Name 'render-unicode' -ExpectedExitCode 0 -Arguments @(
    '--automation', 'render', '--input', $unicodeInput,
    '--quotation-pdf', $quotationPdf,
    '--goods-receipt-pdf', $goodsReceiptPdf,
    '--quotation-customer-xlsx', $customerXlsx,
    '--quotation-internal-xlsx', $internalXlsx,
    '--output-json', $normalizedJson,
    '--result-json', $renderResult,
    '--progress-json', $progressJson,
    '--no-network'
  )
  Assert-Pdf $quotationPdf
  Assert-Pdf $goodsReceiptPdf
  Assert-Xlsx $customerXlsx 'customer'
  Assert-Xlsx $internalXlsx 'internal'
  foreach ($outputKind in @('quotation-customer-xlsx', 'quotation-internal-xlsx')) {
    $outputReport = @($renderReport.outputs | Where-Object { $_.kind -eq $outputKind })
    Assert-Condition ($outputReport.Count -eq 1) "Render report is missing $outputKind."
    Assert-Condition ($outputReport[0].sizeBytes -gt 0 -and $outputReport[0].sha256 -eq (Get-Sha256 $outputReport[0].filePath)) "Render report has invalid $outputKind metadata."
  }
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

  $blankNumberInput = Join-Path $runDirectory 'blank-number.json'
  $blankNumberQuotation = Get-Content -LiteralPath $goodsReceiptFixture -Raw -Encoding utf8 | ConvertFrom-Json
  $blankNumberQuotation.quotation.header.quotationNumber = ' '
  $blankNumberQuotation | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $blankNumberInput -Encoding utf8
  $blankNumberValidation = Invoke-AutomationCommand -Name 'validate-blank-number' -ExpectedExitCode 0 -Arguments @(
    '--automation', 'validate', '--input', $blankNumberInput, '--no-network'
  )
  Assert-Condition $blankNumberValidation.ok 'Validation must allow an incomplete quotation number.'

  foreach ($outputFlag in @('quotation-pdf', 'goods-receipt-pdf', 'output-json', 'quotation-customer-xlsx', 'quotation-internal-xlsx')) {
    $outputExtension = if ($outputFlag -eq 'output-json') { 'json' } elseif ($outputFlag.EndsWith('xlsx')) { 'xlsx' } else { 'pdf' }
    $blankNumberOutput = Join-Path $runDirectory "blank-number-$outputFlag.$outputExtension"
    $blankNumberReport = Invoke-AutomationCommand -Name "blank-number-$outputFlag" -ExpectedExitCode 3 -Arguments @(
      '--automation', 'render', '--input', $blankNumberInput,
      "--$outputFlag", $blankNumberOutput, '--no-network'
    )
    Assert-Condition ($blankNumberReport.errors[0].code -eq 'invalid_argument') 'Blank number did not return invalid_argument.'
    Assert-Condition ($blankNumberReport.errors[0].fieldPath -eq 'quotation.header.quotationNumber') 'Blank number returned the wrong field path.'
    Assert-Condition (-not (Test-Path -LiteralPath $blankNumberOutput)) 'Blank number wrote a document output.'
  }

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

  foreach ($mode in @('customer', 'internal')) {
    $existingXlsx = Join-Path $runDirectory "existing-$mode.xlsx"
    'keep-me' | Set-Content -LiteralPath $existingXlsx -Encoding utf8
    $existingHash = Get-Sha256 $existingXlsx
    $existingXlsxReport = Invoke-AutomationCommand -Name "existing-$mode-xlsx" -ExpectedExitCode 5 -Arguments @(
      '--automation', 'render', '--input', $quotationFixture,
      "--quotation-$mode-xlsx", $existingXlsx, '--no-network'
    )
    Assert-Condition ($existingXlsxReport.errors[0].code -eq 'output_exists') 'Existing XLSX returned the wrong code.'
    Assert-Condition ((Get-Sha256 $existingXlsx) -eq $existingHash) 'Existing XLSX was modified without --force.'
    $forcedXlsxReport = Invoke-AutomationCommand -Name "forced-$mode-xlsx" -ExpectedExitCode 0 -Arguments @(
      '--automation', 'render', '--input', $quotationFixture,
      "--quotation-$mode-xlsx", $existingXlsx, '--no-network', '--force'
    )
    Assert-Condition $forcedXlsxReport.ok 'Forced XLSX export failed.'
    Assert-Xlsx $existingXlsx $mode
  }

  $collisionXlsx = Join-Path $runDirectory 'collision.xlsx'
  $collisionReport = Invoke-AutomationCommand -Name 'xlsx-path-collision' -ExpectedExitCode 2 -Arguments @(
    '--automation', 'render', '--input', $quotationFixture,
    '--quotation-customer-xlsx', $collisionXlsx, '--quotation-internal-xlsx', $collisionXlsx, '--no-network'
  )
  Assert-Condition ($collisionReport.errors[0].code -eq 'duplicate_output_path') 'Excel path collision returned the wrong code.'
  Assert-Condition (-not (Test-Path -LiteralPath $collisionXlsx)) 'Excel path collision wrote an output.'

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
  $batchCustomerXlsx = Join-Path $runDirectory 'batch-customer.xlsx'
  $batchInternalXlsx = Join-Path $runDirectory 'batch-internal.xlsx'
  [pscustomobject]@{
    schemaVersion = 1
    jobs = @(
      [pscustomobject]@{ id = 'validate-1'; command = 'validate'; input = $quotationFixture; noNetwork = $true },
      [pscustomobject]@{
        id = 'excel-2'; command = 'render'; input = $unicodeInput; noNetwork = $true
        quotationCustomerXlsx = 'batch-customer.xlsx'; quotationInternalXlsx = 'batch-internal.xlsx'
      }
    )
  } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $manifestPath -Encoding utf8
  $batchReport = Invoke-AutomationCommand -Name 'batch' -ExpectedExitCode 0 -Arguments @(
    '--automation', 'batch', '--manifest', $manifestPath, '--result-json', $batchResultPath
  )
  Assert-Condition ($batchReport.summary.total -eq 2 -and $batchReport.summary.succeeded -eq 2) 'Batch summary is incorrect.'
  Assert-Xlsx $batchCustomerXlsx 'customer'
  Assert-Xlsx $batchInternalXlsx 'internal'
  Assert-Condition ($batchReport.jobs[1].outputs.Count -eq 2) 'Batch Excel output reports are missing.'

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
