param(
  [Parameter(Mandatory = $true)][string]$DocumentPath,
  [Parameter(Mandatory = $true)][string]$PdfPath
)

$ErrorActionPreference = 'Stop'
$inputDocument = (Resolve-Path -LiteralPath $DocumentPath).Path
$outputPdf = [System.IO.Path]::GetFullPath($PdfPath)
$wordApplication = $null
$manualDocument = $null
try {
  $wordApplication = New-Object -ComObject Word.Application
  $wordApplication.Visible = $false
  $wordApplication.DisplayAlerts = 0
  $wordApplication.AutomationSecurity = 3
  $manualDocument = $wordApplication.Documents.Open($inputDocument, $false, $false, $false)
  $manualDocument.Fields.Update() | Out-Null
  foreach ($contents in $manualDocument.TablesOfContents) { $contents.Update() }
  $manualDocument.Repaginate()
  foreach ($contents in $manualDocument.TablesOfContents) { $contents.UpdatePageNumbers() }
  $manualDocument.Save()
  $manualDocument.ExportAsFixedFormat($outputPdf, 17)
  [pscustomobject]@{
    Document = $inputDocument
    Pages = $manualDocument.ComputeStatistics(2)
    Contents = $manualDocument.TablesOfContents.Count
    Images = $manualDocument.InlineShapes.Count
    Pdf = $outputPdf
  } | ConvertTo-Json -Compress
} finally {
  if ($null -ne $manualDocument) {
    $manualDocument.Close(0)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($manualDocument)
  }
  if ($null -ne $wordApplication) {
    $wordApplication.Quit(0)
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wordApplication)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
