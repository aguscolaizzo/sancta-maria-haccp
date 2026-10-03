export type LabelEvidencePhoto = {
  id: string;
  preparationLabelId: string;
  purpose: "supplier_evidence";
  mimeType: string;
  byteSize: number;
  contentSha256: string;
  originalName: string;
  caption: string;
  createdAt: string;
  createdByName: string;
  url: string;
};

export function labelEvidencePhotoFromRow(
  row: Record<string, unknown>,
): LabelEvidencePhoto {
  const labelId = String(row.preparation_label_id);
  const id = String(row.id);
  return {
    id,
    preparationLabelId: labelId,
    purpose: "supplier_evidence",
    mimeType: String(row.mime_type),
    byteSize: Number(row.byte_size),
    contentSha256: String(row.content_sha256),
    originalName: String(row.original_name ?? ""),
    caption: String(row.caption ?? ""),
    createdAt: String(row.created_at),
    createdByName: String(row.created_by_name),
    url: `/api/labels/${labelId}/photos/${id}`,
  };
}
