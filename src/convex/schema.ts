import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// User roles for the system
export const ROLES = {
  ADMIN: "admin",
  CONTENT: "content",
  RESEARCH_DEVELOPMENT: "research_development",
  OPERATIONS: "operations",
  INVENTORY: "inventory",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.CONTENT),
  v.literal(ROLES.RESEARCH_DEVELOPMENT),
  v.literal(ROLES.OPERATIONS),
  v.literal(ROLES.INVENTORY),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      isApproved: v.optional(v.boolean()),
    }).index("email", ["email"]),

    // Educational programs
    programs: defineTable({
      name: v.string(),
      slug: v.optional(v.string()),
      description: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      categories: v.optional(v.array(v.string())),
      usesVariants: v.optional(v.boolean()),
      status: v.optional(v.union(v.literal("active"), v.literal("archived"))),
      createdBy: v.id("users"),
    })
      .index("by_created_by", ["createdBy"])
      .index("by_status", ["status"])
      .index("by_slug", ["slug"]),

    // Kit specifications
    kits: defineTable({
      name: v.string(),
      programId: v.id("programs"),
      serialNumber: v.optional(v.string()),
      serialNumbers: v.optional(v.array(v.string())),
      type: v.optional(v.string()),
      cstemVariant: v.optional(v.union(v.literal("explorer"), v.literal("discoverer"))),
      category: v.optional(v.string()),
      description: v.optional(v.string()),
      remarks: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      images: v.optional(v.array(v.string())),
      fileIds: v.optional(v.array(v.id("_storage"))),
      kitImageFiles: v.optional(v.array(v.union(
        v.object({ type: v.literal("storage"), storageId: v.id("_storage") }),
        v.object({ type: v.literal("link"), name: v.string(), url: v.string() })
      ))),
      laserFiles: v.optional(v.array(v.union(
        v.object({ type: v.literal("storage"), storageId: v.id("_storage") }),
        v.object({ type: v.literal("link"), name: v.string(), url: v.string() })
      ))),
      componentFiles: v.optional(v.array(v.union(
        v.object({ type: v.literal("storage"), storageId: v.id("_storage") }),
        v.object({ type: v.literal("link"), name: v.string(), url: v.string() })
      ))),
      workbookFiles: v.optional(v.array(v.union(
        v.object({ type: v.literal("storage"), storageId: v.id("_storage") }),
        v.object({ type: v.literal("link"), name: v.string(), url: v.string() })
      ))),
      stockCount: v.number(),
      lowStockThreshold: v.optional(v.number()),
      status: v.optional(v.union(
        v.literal("active"), 
        v.literal("archived"),
        v.literal("in_stock"),
        v.literal("assigned"),
        v.literal("to_be_made")
      )),
      tags: v.optional(v.array(v.string())),
      notes: v.optional(v.string()),
      isStructured: v.optional(v.boolean()),
      packingRequirements: v.optional(v.string()),
      spareKits: v.optional(v.array(v.object({
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
        notes: v.optional(v.string()),
      }))),
      bulkMaterials: v.optional(v.array(v.object({
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
        notes: v.optional(v.string()),
      }))),
      miscellaneous: v.optional(v.array(v.object({
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
        notes: v.optional(v.string()),
      }))),
      components: v.optional(
        v.array(
          v.object({
            inventoryItemId: v.id("inventory"),
            quantityPerKit: v.number(),
            unit: v.string(),
            wastageNotes: v.optional(v.string()),
            comments: v.optional(v.string()),
          })
        )
      ),
      createdBy: v.optional(v.id("users")),
    })
      .index("by_program", ["programId"])
      .index("by_created_by", ["createdBy"])
      .index("by_status", ["status"])
      .index("by_type", ["type"])
      .index("by_category", ["category"]),

    // Kit components (packets, spare materials, bulk materials, misc)
    kitComponents: defineTable({
      kitId: v.id("kits"),
      type: v.union(
        v.literal("packet"),
        v.literal("spare"),
        v.literal("bulk"),
        v.literal("miscellaneous")
      ),
      name: v.string(),
      quantity: v.number(),
      unit: v.optional(v.string()),
      notes: v.optional(v.string()),
    }).index("by_kit", ["kitId"]),

    // Clients database
    clients: defineTable({
      name: v.string(),
      email: v.optional(v.string()),
      contact: v.optional(v.string()),
      organization: v.optional(v.string()),
      address: v.optional(v.string()),
      type: v.optional(v.union(v.literal("monthly"), v.literal("one_time"))),
      notes: v.optional(v.string()),
      salesPerson: v.optional(v.string()),
      pointsOfContact: v.optional(v.array(v.object({
        name: v.string(),
        designation: v.optional(v.string()),
        phone: v.optional(v.string()),
        email: v.optional(v.string()),
      }))),
      gradeAttendance: v.optional(v.object({
        grade1: v.optional(v.number()),
        grade2: v.optional(v.number()),
        grade3: v.optional(v.number()),
        grade4: v.optional(v.number()),
        grade5: v.optional(v.number()),
        grade6: v.optional(v.number()),
        grade7: v.optional(v.number()),
        grade8: v.optional(v.number()),
        grade9: v.optional(v.number()),
        grade10: v.optional(v.number()),
        grade11: v.optional(v.number()),
        grade12: v.optional(v.number()),
      })),
      createdBy: v.id("users"),
    }).index("by_created_by", ["createdBy"]),

    // Kit assignments to clients
    assignments: defineTable({
      clientId: v.id("clients"),
      kitId: v.id("kits"),
      quantity: v.number(),
      grade: v.optional(v.union(
        v.literal("1"), v.literal("2"), v.literal("3"), v.literal("4"), v.literal("5"),
        v.literal("6"), v.literal("7"), v.literal("8"), v.literal("9"), v.literal("10")
      )),
      status: v.union(
        v.literal("assigned"),
        v.literal("packed"),
        v.literal("dispatched")
      ),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      dispatchedAt: v.optional(v.number()),
    })
      .index("by_client", ["clientId"])
      .index("by_kit", ["kitId"])
      .index("by_status", ["status"])
      .index("by_created_by", ["createdBy"]),

    // Inventory materials
    inventory: defineTable({
      name: v.string(),
      description: v.optional(v.string()),
      type: v.union(
        v.literal("raw"),
        v.literal("pre_processed"),
        v.literal("finished"),
        v.literal("sealed_packet")
      ),
      quantity: v.number(),
      unit: v.string(),
      minStockLevel: v.optional(v.number()),
      location: v.optional(v.string()),
      notes: v.optional(v.string()),
      vendorId: v.optional(v.id("vendors")),
      subcategory: v.optional(v.string()),
    })
      .index("by_type", ["type"])
      .index("by_vendor", ["vendorId"])
      .index("by_subcategory", ["subcategory"]),

    // Inventory categories for organizing materials
    inventoryCategories: defineTable({
      name: v.string(),
      value: v.string(),
      categoryType: v.union(
        v.literal("raw_material"),
        v.literal("pre_processed")
      ),
    })
      .index("by_value", ["value"])
      .index("by_category_type", ["categoryType"]),

    // Material processing jobs
    processingJobs: defineTable({
      name: v.string(),
      sources: v.array(
        v.object({
          sourceItemId: v.id("inventory"),
          sourceQuantity: v.number(),
        })
      ),
      targets: v.array(
        v.object({
          targetItemId: v.id("inventory"),
          targetQuantity: v.number(),
        })
      ),
      status: v.union(
        v.literal("in_progress"),
        v.literal("completed")
      ),
      processedBy: v.optional(v.string()),
      processedByType: v.optional(v.union(v.literal("vendor"), v.literal("service"), v.literal("in_house"))),
      notes: v.optional(v.string()),
      completedAt: v.optional(v.number()),
      completedBy: v.optional(v.id("users")),
      createdBy: v.id("users"),
    })
      .index("by_status", ["status"])
      .index("by_created_by", ["createdBy"]),

    // Vendor purchase bills
    billRecords: defineTable({
      vendorId: v.id("vendors"),
      billNumber: v.string(),
      billDate: v.number(),
      totalAmount: v.number(),
      items: v.array(
        v.object({
          materialId: v.id("inventory"),
          quantity: v.number(),
          unitPrice: v.number(),
        })
      ),
      billFileUrl: v.optional(v.string()),
      createdBy: v.id("users"),
    })
      .index("by_vendor", ["vendorId"])
      .index("by_created_by", ["createdBy"]),

    // Vendor contacts
    vendors: defineTable({
      name: v.string(),
      organization: v.optional(v.string()),
      contactPerson: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      gstn: v.optional(v.string()),
      notes: v.optional(v.string()),
      inventoryItems: v.optional(v.array(v.id("inventory"))),
      itemPrices: v.optional(
        v.array(
          v.object({
            itemId: v.id("inventory"),
            averagePrice: v.number(),
          })
        )
      ),
      createdBy: v.id("users"),
    }).index("by_created_by", ["createdBy"]),

    // Service providers
    services: defineTable({
      name: v.string(),
      serviceType: v.string(),
      contactPerson: v.optional(v.string()),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
    }).index("by_created_by", ["createdBy"]),

    // Vendor imports/bills
    vendorImports: defineTable({
      vendorId: v.id("vendors"),
      billNumber: v.string(),
      billDate: v.string(),
      billImageId: v.optional(v.id("_storage")),
      items: v.array(
        v.object({
          inventoryId: v.id("inventory"),
          quantity: v.number(),
          unitPrice: v.number(),
        })
      ),
      totalAmount: v.number(),
      createdBy: v.id("users"),
    })
      .index("by_vendor", ["vendorId"])
      .index("by_created_by", ["createdBy"]),

    // Laser files for kits
    laserFiles: defineTable({
      kitId: v.id("kits"),
      fileName: v.string(),
      fileType: v.union(
        v.literal("laser"),
        v.literal("component"),
        v.literal("workbook"),
        v.literal("kitImage")
      ),
      storageId: v.optional(v.id("_storage")),
      externalLink: v.optional(v.string()),
      notes: v.optional(v.string()),
      uploadedBy: v.id("users"),
      uploadedAt: v.number(),
    })
      .index("by_kit", ["kitId"])
      .index("by_file_type", ["fileType"])
      .index("by_uploaded_by", ["uploadedBy"]),

    // Activity logs for audit trail
    activityLogs: defineTable({
      userId: v.id("users"),
      actionType: v.string(),
      details: v.string(),
      performedBy: v.optional(v.id("users")),
    })
      .index("by_user", ["userId"])
      .index("by_action_type", ["actionType"]),

    // User permissions for granular access control
    userPermissions: defineTable({
      userId: v.id("users"),
      permissions: v.object({
        dashboard: v.optional(v.object({ view: v.boolean() })),
        kits: v.optional(v.object({
          view: v.boolean(),
          create: v.boolean(),
          edit: v.boolean(),
          delete: v.boolean(),
          editStock: v.boolean(),
          uploadImages: v.boolean(),
        })),
        clients: v.optional(v.object({
          view: v.boolean(),
          create: v.boolean(),
          edit: v.boolean(),
          delete: v.boolean(),
        })),
        assignments: v.optional(v.object({
          view: v.boolean(),
          create: v.boolean(),
          edit: v.boolean(),
          delete: v.boolean(),
          pack: v.boolean(),
          dispatch: v.boolean(),
        })),
        inventory: v.optional(v.object({
          view: v.boolean(),
          create: v.boolean(),
          edit: v.boolean(),
          delete: v.boolean(),
          editStock: v.boolean(),
          createCategories: v.boolean(),
          importData: v.boolean(),
        })),
        vendors: v.optional(v.object({
          view: v.boolean(),
          create: v.boolean(),
          edit: v.boolean(),
          delete: v.boolean(),
        })),
        services: v.optional(v.object({
          view: v.boolean(),
          create: v.boolean(),
          edit: v.boolean(),
          delete: v.boolean(),
        })),
        laserFiles: v.optional(v.object({
          view: v.boolean(),
          upload: v.boolean(),
          delete: v.boolean(),
        })),
        reports: v.optional(v.object({
          view: v.boolean(),
          download: v.boolean(),
        })),
        adminZone: v.optional(v.object({
          view: v.boolean(),
          manageUsers: v.boolean(),
          manageRoles: v.boolean(),
          managePermissions: v.boolean(),
          approveUsers: v.boolean(),
          deleteUsers: v.boolean(),
          clearAssignments: v.boolean(),
          viewActivityLogs: v.boolean(),
          deleteActivityLogs: v.boolean(),
        })),
      }),
    }).index("by_user", ["userId"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;