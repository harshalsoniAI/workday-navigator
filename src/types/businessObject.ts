export interface BusinessObjectNode {
  id: string;
  name: string;
  category: string;
  description: string;
  /** True until a row exists in business_object_nodes for this id */
  isStub?: boolean;
}

export interface BusinessObjectEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
}

export interface BusinessObjectField {
  id: string;
  business_object_id: string;
  name: string;
  report_field_type: string;
  related_business_object: string | null;
  category: string;
}
