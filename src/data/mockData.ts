// Mock data layer — replace with Supabase queries later

export interface BusinessObjectNode {
  id: string;
  name: string;
  category: string;
  description: string;
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

export const nodes: BusinessObjectNode[] = [
  { id: "worker", name: "Worker", category: "HCM", description: "Represents a person who works for an organization." },
  { id: "position", name: "Position", category: "HCM", description: "A specific role within an organization's structure." },
  { id: "organization", name: "Organization", category: "HCM", description: "A grouping of workers and positions." },
  { id: "job_profile", name: "Job Profile", category: "HCM", description: "Template defining a job's requirements and compensation." },
  { id: "compensation", name: "Compensation", category: "Payroll", description: "Pay and benefits associated with a worker." },
  { id: "benefit_plan", name: "Benefit Plan", category: "Benefits", description: "Insurance or retirement plan offered to workers." },
  { id: "pay_group", name: "Pay Group", category: "Payroll", description: "Grouping of workers for payroll processing." },
  { id: "cost_center", name: "Cost Center", category: "Finance", description: "An organizational unit used to track costs." },
  { id: "location", name: "Location", category: "HCM", description: "Physical location or site of an organization." },
  { id: "supervisory_org", name: "Supervisory Organization", category: "HCM", description: "Hierarchy of management and reporting." },
  { id: "time_off", name: "Time Off", category: "Time Tracking", description: "Leave and absence tracking for workers." },
  { id: "payroll_result", name: "Payroll Result", category: "Payroll", description: "Output of a payroll calculation run." },
];

export const edges: BusinessObjectEdge[] = [
  { id: "e1", source: "worker", target: "position", relationship: "fills" },
  { id: "e2", source: "worker", target: "organization", relationship: "belongs to" },
  { id: "e3", source: "worker", target: "compensation", relationship: "receives" },
  { id: "e4", source: "worker", target: "benefit_plan", relationship: "enrolled in" },
  { id: "e5", source: "worker", target: "time_off", relationship: "requests" },
  { id: "e6", source: "position", target: "job_profile", relationship: "uses" },
  { id: "e7", source: "position", target: "supervisory_org", relationship: "reports to" },
  { id: "e8", source: "organization", target: "cost_center", relationship: "funded by" },
  { id: "e9", source: "organization", target: "location", relationship: "located at" },
  { id: "e10", source: "compensation", target: "pay_group", relationship: "processed by" },
  { id: "e11", source: "pay_group", target: "payroll_result", relationship: "generates" },
  { id: "e12", source: "supervisory_org", target: "organization", relationship: "part of" },
  { id: "e13", source: "job_profile", target: "compensation", relationship: "defines" },
];

export const fields: BusinessObjectField[] = [
  // Worker fields
  { id: "f1", business_object_id: "worker", name: "Worker ID", report_field_type: "Text", related_business_object: null, category: "Identification" },
  { id: "f2", business_object_id: "worker", name: "Legal Name", report_field_type: "Text", related_business_object: null, category: "Personal" },
  { id: "f3", business_object_id: "worker", name: "Hire Date", report_field_type: "Date", related_business_object: null, category: "Employment" },
  { id: "f4", business_object_id: "worker", name: "Position", report_field_type: "Reference", related_business_object: "position", category: "Employment" },
  { id: "f5", business_object_id: "worker", name: "Manager", report_field_type: "Reference", related_business_object: "worker", category: "Employment" },
  { id: "f6", business_object_id: "worker", name: "Email Address", report_field_type: "Text", related_business_object: null, category: "Contact" },
  { id: "f7", business_object_id: "worker", name: "Worker Type", report_field_type: "Enum", related_business_object: null, category: "Employment" },
  // Position fields
  { id: "f8", business_object_id: "position", name: "Position ID", report_field_type: "Text", related_business_object: null, category: "Identification" },
  { id: "f9", business_object_id: "position", name: "Position Title", report_field_type: "Text", related_business_object: null, category: "Details" },
  { id: "f10", business_object_id: "position", name: "Job Profile", report_field_type: "Reference", related_business_object: "job_profile", category: "Details" },
  { id: "f11", business_object_id: "position", name: "Supervisory Org", report_field_type: "Reference", related_business_object: "supervisory_org", category: "Hierarchy" },
  { id: "f12", business_object_id: "position", name: "Available Date", report_field_type: "Date", related_business_object: null, category: "Details" },
  // Organization fields
  { id: "f13", business_object_id: "organization", name: "Organization ID", report_field_type: "Text", related_business_object: null, category: "Identification" },
  { id: "f14", business_object_id: "organization", name: "Organization Name", report_field_type: "Text", related_business_object: null, category: "Details" },
  { id: "f15", business_object_id: "organization", name: "Organization Type", report_field_type: "Enum", related_business_object: null, category: "Details" },
  { id: "f16", business_object_id: "organization", name: "Cost Center", report_field_type: "Reference", related_business_object: "cost_center", category: "Finance" },
  // Compensation fields
  { id: "f17", business_object_id: "compensation", name: "Base Pay", report_field_type: "Currency", related_business_object: null, category: "Pay" },
  { id: "f18", business_object_id: "compensation", name: "Pay Frequency", report_field_type: "Enum", related_business_object: null, category: "Pay" },
  { id: "f19", business_object_id: "compensation", name: "Currency", report_field_type: "Text", related_business_object: null, category: "Pay" },
  { id: "f20", business_object_id: "compensation", name: "Pay Group", report_field_type: "Reference", related_business_object: "pay_group", category: "Pay" },
  // Other objects get fewer fields for brevity
  { id: "f21", business_object_id: "job_profile", name: "Profile Name", report_field_type: "Text", related_business_object: null, category: "Details" },
  { id: "f22", business_object_id: "job_profile", name: "Job Family", report_field_type: "Text", related_business_object: null, category: "Classification" },
  { id: "f23", business_object_id: "job_profile", name: "Management Level", report_field_type: "Enum", related_business_object: null, category: "Classification" },
  { id: "f24", business_object_id: "benefit_plan", name: "Plan Name", report_field_type: "Text", related_business_object: null, category: "Details" },
  { id: "f25", business_object_id: "benefit_plan", name: "Plan Type", report_field_type: "Enum", related_business_object: null, category: "Details" },
  { id: "f26", business_object_id: "pay_group", name: "Pay Group Name", report_field_type: "Text", related_business_object: null, category: "Details" },
  { id: "f27", business_object_id: "pay_group", name: "Run Category", report_field_type: "Enum", related_business_object: null, category: "Processing" },
  { id: "f28", business_object_id: "cost_center", name: "Cost Center Code", report_field_type: "Text", related_business_object: null, category: "Identification" },
  { id: "f29", business_object_id: "cost_center", name: "Cost Center Name", report_field_type: "Text", related_business_object: null, category: "Details" },
  { id: "f30", business_object_id: "location", name: "Location Name", report_field_type: "Text", related_business_object: null, category: "Details" },
  { id: "f31", business_object_id: "location", name: "Country", report_field_type: "Text", related_business_object: null, category: "Address" },
  { id: "f32", business_object_id: "supervisory_org", name: "Org Name", report_field_type: "Text", related_business_object: null, category: "Details" },
  { id: "f33", business_object_id: "supervisory_org", name: "Manager", report_field_type: "Reference", related_business_object: "worker", category: "Hierarchy" },
  { id: "f34", business_object_id: "time_off", name: "Time Off Type", report_field_type: "Enum", related_business_object: null, category: "Details" },
  { id: "f35", business_object_id: "time_off", name: "Balance", report_field_type: "Numeric", related_business_object: null, category: "Tracking" },
  { id: "f36", business_object_id: "payroll_result", name: "Pay Period", report_field_type: "Date", related_business_object: null, category: "Details" },
  { id: "f37", business_object_id: "payroll_result", name: "Gross Pay", report_field_type: "Currency", related_business_object: null, category: "Results" },
  { id: "f38", business_object_id: "payroll_result", name: "Net Pay", report_field_type: "Currency", related_business_object: null, category: "Results" },
];

// Helper to get connected nodes for a given node
export function getConnectedNodeIds(nodeId: string): string[] {
  const connected = new Set<string>();
  edges.forEach((e) => {
    if (e.source === nodeId) connected.add(e.target);
    if (e.target === nodeId) connected.add(e.source);
  });
  return Array.from(connected);
}

export function getFieldsForObject(objectId: string): BusinessObjectField[] {
  return fields.filter((f) => f.business_object_id === objectId);
}

export function getNodeById(id: string): BusinessObjectNode | undefined {
  return nodes.find((n) => n.id === id);
}
