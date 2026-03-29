export type BusinessObjectNodeRow = {
    business_object_name: string
    field_count: number
    related_object_count: number
    category_count: number
  }
  
  export type BusinessObjectEdgeRow = {
    source: string
    target: string
    edge_count: number
  }
  
  export type BusinessObjectFieldRow = {
    business_object_name: string
    field: string
    report_field_type: string | null
    related_business_object: string | null
    category: string | null
  }