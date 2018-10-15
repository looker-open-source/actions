export interface Row {
  [fieldName: string]: Cell | PivotCell
}

export interface Cell {
  [key: string]: any
  value: any
  rendered?: string
  html?: string
  links?: Link[]
}

export interface PivotCell {
  [pivotKey: string]: Cell
}

export interface Pivot {
  key: string
  is_total: boolean
  data: { [key: string]: string }
  metadata: { [key: string]: { [key: string]: string } }
}

export interface Link {
  label: string
  type: string
  type_label: string
  url: string
}

export interface FilterData {
  add: string
  field: string
  rendered: string
}
