import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const preparationLineage = sqliteTable("preparation_lineage", {
 id:text("id").primaryKey(),ownerId:text("owner_id").notNull(),sourceKind:text("source_kind").notNull(),sourceId:text("source_id").notNull(),targetLabelId:text("target_label_id").notNull(),relation:text("relation").notNull(),sourceSnapshot:text("source_snapshot").notNull(),reason:text("reason").notNull().default(""),scope:text("scope").notNull().default("partial"),createdAt:text("created_at").notNull(),createdById:text("created_by_id").notNull(),createdByName:text("created_by_name").notNull(),
},t=>[uniqueIndex("lineage_target").on(t.ownerId,t.targetLabelId),index("lineage_source").on(t.ownerId,t.sourceKind,t.sourceId)]);
export const readings = sqliteTable(
  "readings",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    initials: text("initials").notNull(),
    temperatures: text("temperatures").notNull(),
    thresholds: text("thresholds").notNull(),
    note: text("note").notNull().default(""),
    exception: integer("exception", { mode: "boolean" })
      .notNull()
      .default(false),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    createdById: text("created_by_id"),
    updatedById: text("updated_by_id"),
  },
  (table) => [uniqueIndex("readings_owner_date").on(table.ownerId, table.date)],
);
export const settings = sqliteTable("settings", {
  ownerId: text("owner_id").primaryKey(),
  thresholds: text("thresholds").notNull(),
  workbookUrl: text("workbook_url").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
export const registerMembers = sqliteTable(
  "register_members",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    userId: text("user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    status: text("status", { enum: ["pending", "active", "revoked"] })
      .notNull()
      .default("pending"),
    role: text("role", { enum: ["admin", "contributor"] })
      .notNull()
      .default("contributor"),
    revision: integer("revision").notNull().default(1),
    requestedAt: text("requested_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("register_members_owner_user").on(table.ownerId, table.userId),
  ],
);
export const preparationLabels = sqliteTable(
  "preparation_labels",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    productCode: text("product_code").notNull(),
    productName: text("product_name").notNull(),
    category: text("category").notNull().default("Préparations cuisinées"),
    processType: text("process_type").notNull().default("cold_preparation"),
    sourceState: text("source_state").notNull().default("fresh"),
    storageMode: text("storage_mode", {
      enum: ["refrigerated", "frozen"],
    }).notNull(),
    storageTemperature: integer("storage_temperature").notNull(),
    durationHours: integer("duration_hours").notNull(),
    preparedAt: text("prepared_at").notNull(),
    frozenAt: text("frozen_at"),
    expiresAt: text("expires_at").notNull(),
    operatorInitials: text("operator_initials").notNull(),
    lotCode: text("lot_code").notNull().default(""),
    quantity: text("quantity").notNull().default(""),
    packaging: text("packaging").notNull().default(""),
    note: text("note").notNull().default(""),
    supplierName: text("supplier_name").notNull().default(""),
    supplierLot: text("supplier_lot").notNull().default(""),
    supplierDeadline: text("supplier_deadline"),
    receivedAt: text("received_at"),
    openedAt: text("opened_at"),
    sourceLabelId: text("source_label_id"),
    cookingEndedAt: text("cooking_ended_at"),
    cookingTemperature: real("cooking_temperature"),
    coolingStartedAt: text("cooling_started_at"),
    coolingStartTemperature: real("cooling_start_temperature"),
    coolingEndedAt: text("cooling_ended_at"),
    coolingEndTemperature: real("cooling_end_temperature"),
    coolingMethod: text("cooling_method").notNull().default(""),
    coolingDurationMinutes: integer("cooling_duration_minutes"),
    coolingCompliant: integer("cooling_compliant", { mode: "boolean" }),
    thawingStartedAt: text("thawing_started_at"),
    thawingMethod: text("thawing_method").notNull().default(""),
    freezeMethod: text("freeze_method").notNull().default(""),
    freezerTemperature: real("freezer_temperature"),
    correctiveAction: text("corrective_action").notNull().default(""),
    controlStatus: text("control_status").notNull().default("not_applicable"),
    lifecycleStatus: text("lifecycle_status", {
      enum: ["active", "consumed", "discarded", "transformed_frozen"],
    })
      .notNull()
      .default("active"),
    lifecycleUpdatedAt: text("lifecycle_updated_at"),
    lifecycleUpdatedById: text("lifecycle_updated_by_id"),
    lifecycleUpdatedByName: text("lifecycle_updated_by_name"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedAt: text("updated_at"),
    updatedById: text("updated_by_id"),
    updatedByName: text("updated_by_name"),
    deletedAt: text("deleted_at"),
    deletedById: text("deleted_by_id"),
    deletedByName: text("deleted_by_name"),
  },
  (table) => [
    uniqueIndex("preparation_labels_owner_id").on(table.ownerId, table.id),
    index("preparation_labels_owner_expiry").on(
      table.ownerId,
      table.lifecycleStatus,
      table.expiresAt,
    ),
  ],
);

export const preparationLabelPhotos = sqliteTable(
  "preparation_label_photos",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    preparationLabelId: text("preparation_label_id").notNull(),
    purpose: text("purpose", { enum: ["supplier_evidence"] })
      .notNull()
      .default("supplier_evidence"),
    objectKey: text("object_key").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    contentSha256: text("content_sha256").notNull(),
    originalName: text("original_name").notNull().default(""),
    caption: text("caption").notNull().default(""),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("preparation_label_photos_object_key").on(table.objectKey),
    index("preparation_label_photos_label").on(
      table.ownerId,
      table.preparationLabelId,
      table.createdAt,
    ),
  ],
);

export const suppliers = sqliteTable(
  "suppliers",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    contactName: text("contact_name").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    notes: text("notes").notNull().default(""),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
    deletedAt: text("deleted_at"),
  },
  (table) => [uniqueIndex("suppliers_owner_id").on(table.ownerId, table.id)],
);

export const supplierLots = sqliteTable(
  "supplier_lots",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    supplierId: text("supplier_id").notNull(),
    ingredientName: text("ingredient_name").notNull(),
    supplierLot: text("supplier_lot").notNull(),
    receivedAt: text("received_at").notNull(),
    supplierDeadline: text("supplier_deadline"),
    quantity: text("quantity").notNull().default(""),
    storageMode: text("storage_mode").notNull().default("refrigerated"),
    storageTemperature: real("storage_temperature"),
    documentRef: text("document_ref").notNull().default(""),
    notes: text("notes").notNull().default(""),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("supplier_lots_owner_id").on(table.ownerId, table.id),
  ],
);

export const preparationSourceLots = sqliteTable(
  "preparation_source_lots",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    preparationLabelId: text("preparation_label_id").notNull(),
    supplierLotId: text("supplier_lot_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("preparation_source_lots_unique").on(
      table.ownerId,
      table.preparationLabelId,
      table.supplierLotId,
    ),
  ],
);

export const labelPrintEvents = sqliteTable(
  "label_print_events",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    preparationLabelId: text("preparation_label_id").notNull(),
    printedAt: text("printed_at").notNull(),
    printerModel: text("printer_model").notNull().default("T50M Pro"),
    transport: text("transport").notNull().default("web_serial_bluetooth"),
    copies: integer("copies").notNull().default(1),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
  },
  (table) => [
    uniqueIndex("label_print_events_owner_id").on(table.ownerId, table.id),
  ],
);

export const receptions = sqliteTable(
  "receptions",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    receptionCode: text("reception_code").notNull(),
    status: text("status", {
      enum: [
        "in_progress",
        "compliant",
        "compliant_after_probe",
        "non_compliant",
        "refused",
      ],
    })
      .notNull()
      .default("in_progress"),
    supplierId: text("supplier_id"),
    supplierName: text("supplier_name").notNull().default(""),
    deliveryNote: text("delivery_note").notNull().default(""),
    orderNumber: text("order_number").notNull().default(""),
    driverName: text("driver_name").notNull().default(""),
    generalNotes: text("general_notes").notNull().default(""),
    validationPinHash: text("validation_pin_hash"),
    pinUsed: integer("pin_used", { mode: "boolean" }).notNull().default(false),
    validatedAt: text("validated_at"),
    validatedById: text("validated_by_id"),
    validatedByName: text("validated_by_name"),
    validationDevice: text("validation_device").notNull().default(""),
    driverCompany: text("driver_company").notNull().default(""),
    driverInitials: text("driver_initials").notNull().default(""),
    driverSignature: text("driver_signature"),
    driverSignedAt: text("driver_signed_at"),
    driverRefusedSign: integer("driver_refused_sign", { mode: "boolean" })
      .notNull()
      .default(false),
    driverRefusalComment: text("driver_refusal_comment").notNull().default(""),
    driverRecordedById: text("driver_recorded_by_id"),
    driverRecordedByName: text("driver_recorded_by_name"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedAt: text("updated_at"),
    updatedById: text("updated_by_id"),
    updatedByName: text("updated_by_name"),
  },
  (table) => [
    uniqueIndex("receptions_owner_code").on(table.ownerId, table.receptionCode),
    index("receptions_owner_created").on(table.ownerId, table.createdAt),
    index("receptions_owner_supplier").on(table.ownerId, table.supplierId),
  ],
);

export const receptionProducts = sqliteTable(
  "reception_products",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    receptionId: text("reception_id").notNull(),
    productName: text("product_name").notNull(),
    category: text("category").notNull().default("Autres"),
    temperatureRegime: text("temperature_regime", {
      enum: ["refrigerated", "frozen", "ambient"],
    }).notNull(),
    quantity: text("quantity").notNull().default(""),
    unit: text("unit").notNull().default("kg"),
    supplierLot: text("supplier_lot").notNull().default(""),
    deadlineType: text("deadline_type", {
      enum: ["dlc", "ddm", "none"],
    })
      .notNull()
      .default("none"),
    deadlineDate: text("deadline_date"),
    storageTemperature: real("storage_temperature"),
    maxTemperature: real("max_temperature"),
    packagingCompliant: integer("packaging_compliant", { mode: "boolean" }),
    visualCompliant: integer("visual_compliant", { mode: "boolean" }),
    cleanlinessCompliant: integer("cleanliness_compliant", {
      mode: "boolean",
    }),
    humidityAbsent: integer("humidity_absent", { mode: "boolean" }),
    pestsAbsent: integer("pests_absent", { mode: "boolean" }),
    productCompliant: integer("product_compliant", { mode: "boolean" }),
    selectedForMeasurement: integer("selected_for_measurement", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    suggestedForMeasurement: integer("suggested_for_measurement", {
      mode: "boolean",
    })
      .notNull()
      .default(false),
    riskLevel: text("risk_level", { enum: ["normal", "high"] })
      .notNull()
      .default("normal"),
    irTemperature: real("ir_temperature"),
    probeTemperature: real("probe_temperature"),
    measurementMethod: text("measurement_method").notNull().default(""),
    remeasureTemperature: real("remeasure_temperature"),
    observations: text("observations").notNull().default(""),
    decisionType: text("decision_type"),
    concernedQuantity: text("concerned_quantity").notNull().default(""),
    nonConformityReason: text("non_conformity_reason").notNull().default(""),
    nonConformityComment: text("non_conformity_comment").notNull().default(""),
    correctiveAction: text("corrective_action").notNull().default(""),
    finalDecision: text("final_decision").notNull().default(""),
    supplierLotId: text("supplier_lot_id"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedAt: text("updated_at"),
    updatedById: text("updated_by_id"),
    updatedByName: text("updated_by_name"),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("reception_products_reception").on(table.ownerId, table.receptionId),
    index("reception_products_lot").on(table.ownerId, table.supplierLot),
  ],
);

export const receptionPhotos = sqliteTable(
  "reception_photos",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    receptionId: text("reception_id").notNull(),
    productId: text("product_id"),
    kind: text("kind", {
      enum: ["delivery_note", "product", "thermometer", "label", "other"],
    }).notNull(),
    mimeType: text("mime_type").notNull(),
    dataUrl: text("data_url").notNull(),
    caption: text("caption").notNull().default(""),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("reception_photos_reception").on(table.ownerId, table.receptionId),
  ],
);

export const receptionAuditEvents = sqliteTable(
  "reception_audit_events",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    receptionId: text("reception_id").notNull(),
    entityType: text("entity_type", {
      enum: ["reception", "product", "photo", "validation", "signature"],
    }).notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action", {
      enum: ["created", "updated", "deleted", "validated", "signed"],
    }).notNull(),
    fieldName: text("field_name").notNull().default(""),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    changedAt: text("changed_at").notNull(),
    changedById: text("changed_by_id").notNull(),
    changedByName: text("changed_by_name").notNull(),
  },
  (table) => [
    index("reception_audit_reception").on(
      table.ownerId,
      table.receptionId,
      table.changedAt,
    ),
  ],
);

export const ingredientCatalog = sqliteTable(
  "ingredient_catalog",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    legacyCode: text("legacy_code").notNull(),
    displayName: text("display_name").notNull(),
    shortName: text("short_name").notNull(),
    category: text("category").notNull().default("Autres"),
    productType: text("product_type").notNull().default("frais"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    quickEnabled: integer("quick_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    favorite: integer("favorite", { mode: "boolean" })
      .notNull()
      .default(false),
    displayOrder: integer("display_order").notNull().default(1000),
    preparationDays: text("preparation_days").notNull().default("[]"),
    defaultOperation: text("default_operation").notNull(),
    storageMode: text("storage_mode", {
      enum: ["refrigerated", "frozen", "ambient"],
    })
      .notNull()
      .default("refrigerated"),
    storageTemperature: real("storage_temperature"),
    defaultBacs: integer("default_bacs").notNull().default(1),
    defaultLabels: integer("default_labels").notNull().default(1),
    labelFormat: text("label_format", {
      enum: ["50x30", "30x20", "50x80"],
    })
      .notNull()
      .default("50x30"),
    technicalDescription: text("technical_description").notNull().default(""),
    allergens: text("allergens").notNull().default(""),
    preparationProcedure: text("preparation_procedure").notNull().default(""),
    handlingRules: text("handling_rules").notNull().default(""),
    usageCount: integer("usage_count").notNull().default(0),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
    updatedById: text("updated_by_id"),
    updatedByName: text("updated_by_name"),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    uniqueIndex("ingredient_catalog_owner_code").on(
      table.ownerId,
      table.legacyCode,
    ),
    index("ingredient_catalog_quick").on(
      table.ownerId,
      table.quickEnabled,
      table.displayOrder,
    ),
  ],
);

export const productBarcodes = sqliteTable(
  "product_barcodes",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    code: text("code").notNull(),
    sampleValue: text("sample_value").notNull().default(""),
    format: text("format").notNull().default("inconnu"),
    ingredientId: text("ingredient_id").notNull(),
    supplierId: text("supplier_id"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedAt: text("updated_at"),
    updatedById: text("updated_by_id"),
    updatedByName: text("updated_by_name"),
  },
  (table) => [
    uniqueIndex("product_barcodes_owner_code").on(table.ownerId, table.code),
    index("product_barcodes_ingredient").on(table.ownerId, table.ingredientId),
  ],
);

export const barcodeProducts = sqliteTable(
  "barcode_products",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    barcode: text("barcode").notNull(),
    barcodeNormalized: text("barcode_normalized").notNull(),
    productName: text("product_name").notNull(),
    productNameFr: text("product_name_fr").notNull().default(""),
    brand: text("brand").notNull().default(""),
    quantity: text("quantity").notNull().default(""),
    imageUrl: text("image_url").notNull().default(""),
    ingredients: text("ingredients").notNull().default(""),
    allergens: text("allergens").notNull().default(""),
    categories: text("categories").notNull().default(""),
    countries: text("countries").notNull().default(""),
    source: text("source", {
      enum: ["internal", "open_food_facts", "manual"],
    })
      .notNull()
      .default("manual"),
    ingredientId: text("ingredient_id"),
    externalLastUpdate: text("external_last_update"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedAt: text("updated_at").notNull(),
    updatedById: text("updated_by_id").notNull(),
    updatedByName: text("updated_by_name").notNull(),
  },
  (table) => [
    uniqueIndex("barcode_products_owner_normalized").on(
      table.ownerId,
      table.barcodeNormalized,
    ),
    index("barcode_products_ingredient").on(table.ownerId, table.ingredientId),
  ],
);

export const ingredientOperationRules = sqliteTable(
  "ingredient_operation_rules",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    operationType: text("operation_type", {
      enum: [
        "opened",
        "sliced",
        "cut",
        "portioned",
        "thawed",
        "internal_preparation",
        "transferred",
      ],
    }).notNull(),
    durationHours: integer("duration_hours").notNull(),
    storageMode: text("storage_mode", {
      enum: ["refrigerated", "frozen", "ambient"],
    }).notNull(),
    storageTemperature: real("storage_temperature"),
    requiresSourceLot: integer("requires_source_lot", { mode: "boolean" })
      .notNull()
      .default(true),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
  },
  (table) => [
    uniqueIndex("ingredient_operation_unique").on(
      table.ownerId,
      table.ingredientId,
      table.operationType,
    ),
  ],
);

export const traceabilityAuditEvents = sqliteTable(
  "traceability_audit_events",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    fieldName: text("field_name").notNull().default(""),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    reason: text("reason").notNull().default(""),
    changedAt: text("changed_at").notNull(),
    changedById: text("changed_by_id").notNull(),
    changedByName: text("changed_by_name").notNull(),
  },
  (table) => [
    index("traceability_audit_entity").on(
      table.ownerId,
      table.entityType,
      table.entityId,
      table.changedAt,
    ),
  ],
);

export const internalPreparations = sqliteTable(
  "internal_preparations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    preparationCode: text("preparation_code").notNull(),
    ingredientId: text("ingredient_id").notNull(),
    ingredientName: text("ingredient_name").notNull(),
    shortName: text("short_name").notNull(),
    operationType: text("operation_type").notNull(),
    preparedAt: text("prepared_at").notNull(),
    durationHours: integer("duration_hours").notNull(),
    expiresAt: text("expires_at").notNull(),
    storageMode: text("storage_mode").notNull(),
    storageTemperature: real("storage_temperature"),
    bacCount: integer("bac_count").notNull(),
    labelCount: integer("label_count").notNull(),
    status: text("status", {
      enum: [
        "prepared",
        "expired",
        "discarded",
        "consumed",
        "transformed_frozen",
      ],
    })
      .notNull()
      .default("prepared"),
    operatorInitials: text("operator_initials").notNull(),
    notes: text("notes").notNull().default(""),
    manualSourceLot: text("manual_source_lot").notNull().default(""),
    manualSourceReason: text("manual_source_reason").notNull().default(""),
    technicalSnapshot: text("technical_snapshot").notNull().default("{}"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedAt: text("updated_at"),
    updatedById: text("updated_by_id"),
    updatedByName: text("updated_by_name"),
    deletedAt: text("deleted_at"),
    deletedById: text("deleted_by_id"),
    deletedByName: text("deleted_by_name"),
  },
  (table) => [
    uniqueIndex("internal_preparations_owner_code").on(
      table.ownerId,
      table.preparationCode,
    ),
    index("internal_preparations_owner_created").on(
      table.ownerId,
      table.createdAt,
    ),
    index("internal_preparations_ingredient").on(
      table.ownerId,
      table.ingredientId,
      table.preparedAt,
    ),
    index("internal_preparations_owner_expiry").on(
      table.ownerId,
      table.status,
      table.expiresAt,
    ),
  ],
);

export const internalPreparationSourceLots = sqliteTable(
  "internal_preparation_source_lots",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    preparationId: text("preparation_id").notNull(),
    supplierLotId: text("supplier_lot_id").notNull(),
    quantityUsed: text("quantity_used").notNull().default(""),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("internal_preparation_source_unique").on(
      table.ownerId,
      table.preparationId,
      table.supplierLotId,
    ),
  ],
);

export const preparationBacs = sqliteTable(
  "preparation_bacs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    preparationId: text("preparation_id").notNull(),
    bacCode: text("bac_code").notNull(),
    bacIndex: integer("bac_index").notNull(),
    status: text("status", {
      enum: [
        "active",
        "expired",
        "discarded",
        "consumed",
        "transformed_frozen",
      ],
    })
      .notNull()
      .default("active"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
  },
  (table) => [
    uniqueIndex("preparation_bacs_owner_code").on(
      table.ownerId,
      table.bacCode,
    ),
    uniqueIndex("preparation_bacs_index").on(
      table.ownerId,
      table.preparationId,
      table.bacIndex,
    ),
  ],
);

export const physicalLabels = sqliteTable(
  "physical_labels",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    labelCode: text("label_code").notNull(),
    shortToken: text("short_token").notNull(),
    preparationId: text("preparation_id").notNull(),
    bacId: text("bac_id").notNull(),
    labelFormat: text("label_format", {
      enum: ["50x30", "30x20", "50x80"],
    })
      .notNull()
      .default("50x30"),
    status: text("status", {
      enum: [
        "to_print",
        "printing",
        "printed",
        "print_error",
        "expired",
        "discarded",
        "consumed",
        "transformed_frozen",
      ],
    })
      .notNull()
      .default("to_print"),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedAt: text("updated_at"),
  },
  (table) => [
    uniqueIndex("physical_labels_owner_code").on(table.ownerId, table.labelCode),
    uniqueIndex("physical_labels_token").on(table.shortToken),
    index("physical_labels_preparation").on(
      table.ownerId,
      table.preparationId,
    ),
  ],
);

export const printJobs = sqliteTable(
  "print_jobs",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    status: text("status", {
      enum: ["pending", "printing", "completed", "partial", "failed"],
    })
      .notNull()
      .default("pending"),
    printerModel: text("printer_model").notNull().default("T50M Pro"),
    transport: text("transport").notNull().default("web_serial_bluetooth"),
    requestedAt: text("requested_at").notNull(),
    completedAt: text("completed_at"),
    requestedById: text("requested_by_id").notNull(),
    requestedByName: text("requested_by_name").notNull(),
  },
  (table) => [index("print_jobs_owner_requested").on(table.ownerId, table.requestedAt)],
);

export const printJobItems = sqliteTable(
  "print_job_items",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    printJobId: text("print_job_id").notNull(),
    physicalLabelId: text("physical_label_id").notNull(),
    position: integer("position").notNull(),
    status: text("status", {
      enum: ["pending", "transmitting", "printed", "failed"],
    })
      .notNull()
      .default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    errorCode: text("error_code").notNull().default(""),
    errorMessage: text("error_message").notNull().default(""),
    settingsSnapshot: text("settings_snapshot").notNull().default("{}"),
    transmissionId: text("transmission_id").notNull().default(""),
  },
  (table) => [
    uniqueIndex("print_job_items_position").on(
      table.ownerId,
      table.printJobId,
      table.position,
    ),
    index("print_job_items_label").on(table.ownerId, table.physicalLabelId),
  ],
);

export const labelPrintAttempts = sqliteTable(
  "label_print_attempts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    physicalLabelId: text("physical_label_id").notNull(),
    printJobId: text("print_job_id").notNull(),
    printJobItemId: text("print_job_item_id").notNull(),
    transmissionId: text("transmission_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    outcome: text("outcome", { enum: ["started", "printed", "failed"] })
      .notNull()
      .default("started"),
    startedAt: text("started_at").notNull(),
    completedAt: text("completed_at"),
    errorCode: text("error_code").notNull().default(""),
    errorMessage: text("error_message").notNull().default(""),
    settingsSnapshot: text("settings_snapshot").notNull().default("{}"),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
  },
  (table) => [
    uniqueIndex("label_print_attempts_transmission").on(
      table.ownerId,
      table.transmissionId,
    ),
    index("label_print_attempts_label").on(
      table.ownerId,
      table.physicalLabelId,
      table.startedAt,
    ),
  ],
);

export const printerDiagnosticReports = sqliteTable(
  "printer_diagnostic_reports",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    context: text("context").notNull(),
    message: text("message").notNull().default(""),
    connected: integer("connected", { mode: "boolean" }),
    transportInfo: text("transport_info").notNull().default("{}"),
    userAgent: text("user_agent").notNull().default(""),
    eventsJson: text("events_json").notNull().default("[]"),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
  },
  (table) => [
    index("printer_diagnostic_owner_created").on(
      table.ownerId,
      table.createdAt,
    ),
  ],
);

export const dailySequences = sqliteTable(
  "daily_sequences",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    sequenceDate: text("sequence_date").notNull(),
    kind: text("kind").notNull(),
    nextValue: integer("next_value").notNull().default(1),
  },
  (table) => [
    uniqueIndex("daily_sequences_unique").on(
      table.ownerId,
      table.sequenceDate,
      table.kind,
    ),
  ],
);

export const hygieneRecords = sqliteTable(
  "hygiene_records",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    recordType: text("record_type", { enum: ["cleaning", "fryer"] })
      .notNull(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    operatorInitials: text("operator_initials").notNull(),
    generalNotes: text("general_notes").notNull().default(""),
    status: text("status", { enum: ["draft", "validated"] })
      .notNull()
      .default("draft"),
    signature: text("signature"),
    validatedAt: text("validated_at"),
    validatedById: text("validated_by_id"),
    validatedByName: text("validated_by_name"),
    revision: integer("revision").notNull().default(1),
    createdAt: text("created_at").notNull(),
    createdById: text("created_by_id").notNull(),
    createdByName: text("created_by_name").notNull(),
    updatedAt: text("updated_at"),
    updatedById: text("updated_by_id"),
    updatedByName: text("updated_by_name"),
  },
  (table) => [
    uniqueIndex("hygiene_records_owner_type_date").on(
      table.ownerId,
      table.recordType,
      table.date,
    ),
    index("hygiene_records_owner_date").on(
      table.ownerId,
      table.date,
      table.recordType,
    ),
  ],
);

export const hygieneChecks = sqliteTable(
  "hygiene_checks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    recordId: text("record_id").notNull(),
    checkCode: text("check_code").notNull(),
    label: text("label").notNull(),
    frequency: text("frequency").notNull(),
    protocol: text("protocol").notNull(),
    optional: integer("optional", { mode: "boolean" })
      .notNull()
      .default(false),
    state: text("state", {
      enum: ["pending", "done", "not_applicable", "issue"],
    })
      .notNull()
      .default("pending"),
    observation: text("observation").notNull().default(""),
    sortOrder: integer("sort_order").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("hygiene_checks_record_code").on(
      table.ownerId,
      table.recordId,
      table.checkCode,
    ),
    index("hygiene_checks_record_order").on(
      table.ownerId,
      table.recordId,
      table.sortOrder,
    ),
  ],
);
