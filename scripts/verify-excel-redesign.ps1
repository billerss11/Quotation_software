<#
.SYNOPSIS
Recalculate and exercise generated quotation fixtures in a private native Excel instance.
.EXAMPLE
powershell -NoProfile -File scripts/verify-excel-redesign.ps1 -Directory output/qa/excel-redesign
.NOTES
Reads manifest.json and never opens a fixture directly. Every baseline/scenario uses
a disposable copy. Results and edited copies remain in a new native-excel-* folder.
Manifest shape: { workbooks: [{ file, baseline, locked, unlocked, scenarios }] }.
Workbook protected defaults to true; set false for ordinary customer sheets.
Assertions/lock references use { sheet, cell, value }; error:true expects an Excel error.
Scenario steps support edits, assertions, sort, and reopen. An edit with value:null
clears the cell; paste:true uses native Copy/PasteSpecial(values).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$Directory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$checks = [System.Collections.Generic.List[object]]::new()
$originals = [System.Collections.Generic.List[object]]::new()
$excel = $null
$workbook = $null
$runDirectory = $null
$startedUtc = [DateTime]::UtcNow
$startedAt = $startedUtc.ToString('o')
$excelVersion = $null
$copyNumber = 0

function Get-OptionalValue($Object, [string]$Name) {
    $property = $Object.PSObject.Properties[$Name]
    if ($null -ne $property) { return $property.Value }
}

function Release-ComReference($Object) {
    if ($null -ne $Object -and [Runtime.InteropServices.Marshal]::IsComObject($Object)) {
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($Object)
    }
}

function Add-Check([string]$Context, [string]$Name, [bool]$Passed, $Expected, $Actual) {
    [void]$script:checks.Add([pscustomobject]@{
        context = $Context
        name = $Name
        status = $(if ($Passed) { 'pass' } else { 'fail' })
        expected = $Expected
        actual = $Actual
    })
}

function Get-CellRange($Book, $Reference) {
    $sheet = $null
    try {
        $sheet = $Book.Worksheets.Item([string]$Reference.sheet)
        return ,$sheet.Range([string]$Reference.cell)
    }
    finally { Release-ComReference $sheet }
}

function Read-Cell($Range) {
    $isError = [bool]$script:excel.WorksheetFunction.IsError($Range)
    return [pscustomobject]@{
        value = $(if ($isError) { [string]$Range.Text } else { $Range.Value2 })
        text = [string]$Range.Text
        error = $isError
    }
}

function Test-EqualValue($Expected, $Actual) {
    if ($null -eq $Expected) {
        return ($null -eq $Actual -or ($Actual -is [string] -and $Actual.Length -eq 0))
    }
    if ($Expected -is [ValueType] -and $Expected -isnot [bool]) {
        if ($Actual -isnot [ValueType] -or $Actual -is [bool]) { return $false }
        return [Math]::Abs([double]$Expected - [double]$Actual) -le 0.00000001
    }
    return [object]::Equals($Expected, $Actual)
}

function Assert-Cells($Book, $Assertions, [string]$Context) {
    foreach ($assertion in @($Assertions)) {
        if ($null -eq $assertion) { continue }
        $range = $null
        try {
            $range = Get-CellRange $Book $assertion
            $actual = Read-Cell $range
            $expectsError = [bool](Get-OptionalValue $assertion 'error')
            $expected = Get-OptionalValue $assertion 'value'
            $passed = if ($expectsError) {
                $actual.error -and ($null -eq $expected -or (Test-EqualValue $expected $actual.value))
            }
            else { -not $actual.error -and (Test-EqualValue $expected $actual.value) }
            if ([bool](Get-OptionalValue $assertion 'readable')) {
                $passed = $passed -and ($actual.text -notmatch '^#+$')
            }
            Add-Check $Context "$($assertion.sheet)!$($assertion.cell)" $passed `
                ([pscustomobject]@{ value = $expected; error = $expectsError }) $actual
        }
        finally { Release-ComReference $range }
    }
}

function Assert-Protection($Book, $References, [bool]$ExpectedLocked, [string]$Context, [bool]$ExpectedProtected = $true) {
    foreach ($reference in @($References)) {
        if ($null -eq $reference) { continue }
        $sheet = $null
        $range = $null
        try {
            $sheet = $Book.Worksheets.Item([string]$reference.sheet)
            $range = $sheet.Range([string]$reference.cell)
            $actual = [pscustomobject]@{ locked = $range.Locked; protected = [bool]$sheet.ProtectContents }
            $passed = ($actual.locked -is [bool]) -and $actual.locked -eq $ExpectedLocked -and $actual.protected -eq $ExpectedProtected
            Add-Check $Context "protection $($reference.sheet)!$($reference.cell)" $passed `
                ([pscustomobject]@{ locked = $ExpectedLocked; protected = $ExpectedProtected }) $actual
        }
        finally {
            Release-ComReference $range
            Release-ComReference $sheet
        }
    }
}

function Recalculate-Excel {
    # This call is synchronous. Hidden Excel can retain xlPending (2) afterward
    # even when dependent values have recalculated; cell assertions verify them.
    [void]$script:excel.CalculateFullRebuild()
}

function Set-CellValue($Range, $Value) {
    # Separate typed call sites avoid PowerShell caching one COM setter argument
    # type and rejecting a later edit of another type (for example text then -1).
    if ($Value -is [string]) { $Range.Value2 = [string]$Value }
    else { $Range.Value2 = [double]$Value }
}

function Apply-Edits($Book, $Edits) {
    foreach ($edit in @($Edits)) {
        if ($null -eq $edit) { continue }
        $range = $null
        $scratch = $null
        $sourceSheet = $null
        $source = $null
        try {
            $range = Get-CellRange $Book $edit
            if ($null -eq $edit.value) { [void]$range.ClearContents() }
            elseif ([bool](Get-OptionalValue $edit 'paste')) {
                $scratch = $script:excel.Workbooks.Add(-4167) # xlWBATWorksheet
                $sourceSheet = $scratch.Worksheets.Item(1)
                $source = $sourceSheet.Range('A1')
                Set-CellValue $source $edit.value
                [void]$source.Copy()
                [void]$range.PasteSpecial(-4163) # xlPasteValues, preserving validation/formatting
            }
            else { Set-CellValue $range $edit.value }
        }
        finally {
            # Windows PowerShell may bind this property to an enum which omits
            # Excel's documented zero/off value. Preserve that COM enum type.
            $copyMode = $script:excel.CutCopyMode
            if ($copyMode -is [Enum]) {
                $script:excel.CutCopyMode = [Enum]::ToObject($copyMode.GetType(), 0)
            }
            else { $script:excel.CutCopyMode = 0 }
            if ($null -ne $scratch) { [void]$scratch.Close($false) }
            Release-ComReference $source
            Release-ComReference $sourceSheet
            Release-ComReference $scratch
            Release-ComReference $range
        }
    }
}

function Read-SortState($Book, $Specification) {
    $sheet = $null
    $records = [System.Collections.Generic.Dictionary[string, object]]::new([StringComparer]::Ordinal)
    $order = [System.Collections.Generic.List[string]]::new()
    try {
        $sheet = $Book.Worksheets.Item([string]$Specification.sheet)
        for ($row = [int]$Specification.firstRow; $row -le [int]$Specification.lastRow; $row++) {
            $cell = $null
            try {
                $cell = $sheet.Cells.Item($row, [int]$Specification.idColumn)
                $id = [Convert]::ToString($cell.Value2, [Globalization.CultureInfo]::InvariantCulture)
            }
            finally { Release-ComReference $cell }
            if ([string]::IsNullOrWhiteSpace($id) -or $records.ContainsKey($id)) {
                throw "Sort fixture requires a nonblank unique ID in row $row; found '$id'."
            }
            $metrics = @{}
            foreach ($column in $Specification.resultColumns) {
                $cell = $null
                try {
                    $cell = $sheet.Cells.Item($row, [int]$column)
                    $metrics[[string]$column] = Read-Cell $cell
                }
                finally { Release-ComReference $cell }
            }
            $records.Add($id, $metrics)
            [void]$order.Add($id)
        }
        return [pscustomobject]@{ records = $records; order = $order.ToArray() }
    }
    finally { Release-ComReference $sheet }
}

function Assert-SortState($Book, $Specification, $Before, [string]$Context) {
    $after = Read-SortState $Book $Specification
    Add-Check $Context 'sort ID count' ($Before.records.Count -eq $after.records.Count) $Before.records.Count $after.records.Count
    foreach ($id in $Before.order) {
        $exists = $after.records.ContainsKey($id)
        Add-Check $Context "sort retains ID $id" $exists $true $exists
        if (-not $exists) { continue }
        foreach ($column in $Specification.resultColumns) {
            $expected = $Before.records[$id][[string]$column]
            $actual = $after.records[$id][[string]$column]
            $passed = $expected.error -eq $actual.error -and (Test-EqualValue $expected.value $actual.value)
            Add-Check $Context "sort ID $id column $column" $passed $expected $actual
        }
    }
    return ,$after.order
}

function Sort-Worksheet($Book, $Specification, [string]$Context) {
    $before = Read-SortState $Book $Specification
    $sheet = $null
    $sort = $null
    $fields = $null
    $field = $null
    $range = $null
    $key = $null
    try {
        $sheet = $Book.Worksheets.Item([string]$Specification.sheet)
        [void]$sheet.Unprotect()
        $sort = $sheet.Sort
        $fields = $sort.SortFields
        [void]$fields.Clear()
        $key = $sheet.Range([string]$Specification.key)
        $field = $fields.Add($key, 0, 1) # xlSortOnValues, xlAscending
        $range = $sheet.Range([string]$Specification.range)
        [void]$sort.SetRange($range)
        $sort.Header = 1 # xlYes
        $sort.MatchCase = $false
        $sort.Orientation = 1 # xlTopToBottom
        [void]$sort.Apply()
    }
    finally {
        Release-ComReference $key
        Release-ComReference $range
        Release-ComReference $field
        Release-ComReference $fields
        Release-ComReference $sort
        Release-ComReference $sheet
    }
    Recalculate-Excel
    $afterOrder = Assert-SortState $Book $Specification $before $Context
    $moved = [string]::Join('|', $before.order) -cne [string]::Join('|', $afterOrder)
    Add-Check $Context 'native sort moved rows' $moved 'different ID order' `
        ([pscustomobject]@{ before = $before.order; after = $afterOrder })
    return $before
}

function New-FixtureCopy([string]$Source) {
    $script:copyNumber++
    $destination = Join-Path $script:runDirectory ('{0:D3}-{1}' -f $script:copyNumber, [IO.Path]::GetFileName($Source))
    Copy-Item -LiteralPath $Source -Destination $destination
    return $destination
}

try {
    $fixtureDirectory = (Resolve-Path -LiteralPath $Directory).ProviderPath
    if (-not (Test-Path -LiteralPath $fixtureDirectory -PathType Container)) { throw 'Directory must be a folder.' }
    $manifest = Get-Content -LiteralPath (Join-Path $fixtureDirectory 'manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $configurations = @(Get-OptionalValue $manifest 'workbooks')
    if ($configurations.Count -eq 0) { throw 'manifest.json must contain at least one workbook.' }
    $runDirectory = Join-Path $fixtureDirectory ('native-excel-{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss'), [Guid]::NewGuid().ToString('N').Substring(0, 8))
    [void](New-Item -ItemType Directory -Path $runDirectory)

    foreach ($configuration in $configurations) {
        $filename = [string]$configuration.file
        if ([IO.Path]::GetFileName($filename) -cne $filename -or [IO.Path]::GetExtension($filename) -ine '.xlsx') {
            throw "Fixture must be an .xlsx filename in Directory: '$filename'."
        }
        $path = Join-Path $fixtureDirectory $filename
        [void]$originals.Add([pscustomobject]@{ path = $path; hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash })
    }

    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    $excel.EnableEvents = $false
    $excel.AskToUpdateLinks = $false
    $excel.AutomationSecurity = 3 # msoAutomationSecurityForceDisable
    $excelVersion = [string]$excel.Version

    foreach ($configuration in $configurations) {
        $filename = [string]$configuration.file
        $sourcePath = Join-Path $fixtureDirectory $filename
        $cases = @([pscustomobject]@{ name = 'baseline'; baseline = $true; steps = @() })
        $cases += @(Get-OptionalValue $configuration 'scenarios')
        foreach ($case in $cases) {
            if ($null -eq $case) { continue }
            $context = "$filename / $($case.name)"
            $copyPath = New-FixtureCopy $sourcePath
            try {
                $workbook = $excel.Workbooks.Open($copyPath, 0, $false)
                $excel.Calculation = -4105 # xlCalculationAutomatic
                Recalculate-Excel
                if ([bool](Get-OptionalValue $case 'baseline')) {
                    Assert-Cells $workbook (Get-OptionalValue $configuration 'baseline') $context
                    $protectionSetting = Get-OptionalValue $configuration 'protected'
                    $expectedProtection = if ($null -eq $protectionSetting) { $true } else { [bool]$protectionSetting }
                    Assert-Protection $workbook (Get-OptionalValue $configuration 'locked') $true $context $expectedProtection
                    Assert-Protection $workbook (Get-OptionalValue $configuration 'unlocked') $false $context $expectedProtection
                }
                else {
                    $stepNumber = 0
                    foreach ($step in $case.steps) {
                        $stepNumber++
                        $stepContext = "$context / step $stepNumber"
                        Apply-Edits $workbook (Get-OptionalValue $step 'edits')
                        Recalculate-Excel
                        $sortSpecification = Get-OptionalValue $step 'sort'
                        $sortBaseline = $null
                        if ($null -ne $sortSpecification) {
                            $sortBaseline = Sort-Worksheet $workbook $sortSpecification $stepContext
                        }
                        $assertions = Get-OptionalValue $step 'assertions'
                        Assert-Cells $workbook $assertions $stepContext
                        if ([bool](Get-OptionalValue $step 'reopen')) {
                            [void]$workbook.Save()
                            [void]$workbook.Close($false)
                            Release-ComReference $workbook
                            $workbook = $null
                            $workbook = $excel.Workbooks.Open($copyPath, 0, $false)
                            Recalculate-Excel
                            Assert-Cells $workbook $assertions "$stepContext / reopened"
                            if ($null -ne $sortBaseline) {
                                [void](Assert-SortState $workbook $sortSpecification $sortBaseline "$stepContext / reopened")
                            }
                        }
                    }
                }
                [void]$workbook.Save()
                Add-Check $context 'scenario completed' $true $true ([pscustomobject]@{ file = $copyPath })
            }
            catch {
                Add-Check $context 'scenario completed' $false $true ([pscustomobject]@{
                    message = $_.Exception.Message
                    stack = $_.ScriptStackTrace
                })
            }
            finally {
                if ($null -ne $workbook) {
                    try { [void]$workbook.Close($false) }
                    finally { Release-ComReference $workbook; $workbook = $null }
                }
            }
        }
    }
}
catch { Add-Check 'harness' 'execution' $false $true $_.Exception.Message }
finally {
    if ($null -ne $workbook) {
        try { [void]$workbook.Close($false) }
        catch { Add-Check 'cleanup' 'close workbook' $false $true $_.Exception.Message }
        finally { Release-ComReference $workbook; $workbook = $null }
    }
    if ($null -ne $excel) {
        try { [void]$excel.Quit() }
        catch { Add-Check 'cleanup' 'quit private Excel' $false $true $_.Exception.Message }
        finally { Release-ComReference $excel; $excel = $null }
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    foreach ($original in $originals) {
        try {
            $currentHash = (Get-FileHash -LiteralPath $original.path -Algorithm SHA256).Hash
            Add-Check 'isolation' ([IO.Path]::GetFileName($original.path)) ($original.hash -ceq $currentHash) $original.hash $currentHash
        }
        catch { Add-Check 'isolation' $original.path $false $original.hash $_.Exception.Message }
    }
}

$failed = @($checks | Where-Object { $_.status -eq 'fail' }).Count
$result = [pscustomobject]@{
    status = $(if ($failed -eq 0) { 'pass' } else { 'fail' })
    startedAt = $startedAt
    finishedAt = [DateTime]::UtcNow.ToString('o')
    durationSeconds = [Math]::Round(([DateTime]::UtcNow - $startedUtc).TotalSeconds, 2)
    excelVersion = $excelVersion
    directory = $runDirectory
    passed = $checks.Count - $failed
    failed = $failed
    checks = $checks.ToArray()
}
$json = $result | ConvertTo-Json -Depth 12
if ($null -ne $runDirectory) {
    [IO.File]::WriteAllText((Join-Path $runDirectory 'verification-results.json'), $json, [Text.UTF8Encoding]::new($false))
}
Write-Output $json
if ($failed -gt 0) { exit 1 }
exit 0
