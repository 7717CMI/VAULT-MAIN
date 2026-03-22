// ============================================================
// INSIGHT VAULT - TypeScript Interfaces
// ============================================================

export interface User {
  userid: number
  name: string
  email: string
  role: string
  no_of_down: number
}

export interface Report {
  newsid: number
  reportstatus: number | null
  catid: number
  newssubject: string
  keyword: string
  forcastyear: string
  summary: string | null
  segmentation: string | null
  newsdate: string
  price_sul: number
  price_cul: number
  price_multi: number
  no_pages: number | null
  createddate: string
  modifieddate: string | null
  isactive: number
  customname: string
  meta_title: string | null
  pdfFile?: string
}

export interface ReportDynamic {
  id: number
  rid: number
  field_1: string | null
  disc_1: string | null
  field_2: string | null
  disc_2: string | null
  field_3: string | null
  disc_3: string | null
  field_4: string | null
  disc_4: string | null
  field_5: string | null
  disc_5: string | null
  field_6: string | null
  disc_6: string | null
  field_7: string | null
  disc_7: string | null
  field_8: string | null
  disc_8: string | null
  field_9: string | null
  disc_9: string | null
  field_10: string | null
  disc_10: string | null
  addeddate: string | null
  modifieddate: string | null
}

export interface ReportSection {
  title: string
  content: string
}

export interface Category {
  catId: number
  catName: string
  icon: string
}

export interface SessionData {
  uid: number
  name: string
  urole: string
  email: string
}

export interface AIInsightSection {
  title: string
  content: string
}

export interface SearchSuggestion {
  newsid: number
  keyword: string
}
