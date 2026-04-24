export interface SaveQuotationFileOptions {
  filePath?: string
  defaultPath?: string
  content: string
}

export type SaveQuotationFileResult =
  | {
      canceled: true
    }
  | {
      canceled: false
      filePath: string
    }

export type OpenQuotationFileResult =
  | {
      canceled: true
    }
  | {
      canceled: false
      filePath: string
      content: string
    }

export type OpenLineItemsCsvFileResult = OpenQuotationFileResult

export interface QuotationAppApi {
  getVersion(): Promise<string>
  saveQuotationFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  openQuotationFile(): Promise<OpenQuotationFileResult>
  openLineItemsCsvFile(): Promise<OpenLineItemsCsvFileResult>
  saveLineItemsCsvTemplateFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  saveCustomerLibraryFile(options: SaveQuotationFileOptions): Promise<SaveQuotationFileResult>
  openCustomerLibraryFile(): Promise<OpenQuotationFileResult>
}
