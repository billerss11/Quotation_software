export interface CompanyProfile {
  companyName: string
  email: string
  phone: string
}

export interface CompanyProfileRecord extends CompanyProfile {
  id: string
  updatedAt: string
}

export interface LibraryNumberingState {
  lastIssuedYear: number | null
  lastIssuedSequence: number
}

export interface CustomerLibraryRecord {
  id: string
  updatedAt: string
  customerCompany: string
  contactPerson: string
  contactDetails: string
}

export interface ReusableLibraryData {
  companyProfiles: CompanyProfileRecord[]
  customers: CustomerLibraryRecord[]
  numbering: LibraryNumberingState
}
