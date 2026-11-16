const FIELD_LABELS: Record<string, string> = {
  customerName: "Customer name",
  customerPhone: "Phone number",
  dateTime: "Appointment time",
  locationText: "Address",
  locationCoords: "Map location",
  deviceType: "Device type",
  deviceModel: "Device model",
  deviceIssue: "Problem description",
  urgency: "Urgency",
  status: "Status",
  technicianName: "Technician",
  diagnosedProblem: "Diagnosis",
  resolutionNotes: "Resolution notes",
  invoiceId: "Invoice",
  remarks: "Remarks",
  priorityNumber: "Priority"
};

export function changedJobFields(previous: Record<string, any>, updates: Record<string, any>): string[] {
  return Object.entries(updates).filter(([key, value]) => {
    if (!FIELD_LABELS[key]) return false;
    const before = previous[key];
    if (key === "locationCoords") return before?.lat !== value?.lat || before?.lng !== value?.lng;
    return (before ?? null) !== (value ?? null);
  }).map(([key]) => FIELD_LABELS[key]);
}
