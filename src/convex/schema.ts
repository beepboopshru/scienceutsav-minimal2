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
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      organization: v.optional(v.string()),
      createdBy: v.id("users"),
    }).index("by_created_by", ["createdBy"]),

    // Kit assignments to clients
    assignments: defineTable({
      clientId: v.id("clients"),
      kitId: v.id("kits"),
      quantity: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("fulfilled"),
        v.literal("cancelled")
      ),
      notes: v.optional(v.string()),
      createdBy: v.id("users"),
      fulfilledAt: v.optional(v.number()),
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
      sourceItemId: v.id("inventory"),
      sourceQuantity: v.number(),
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
      .index("by_source_item", ["sourceItemId"])
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
  },
  {
    schemaValidation: false,
  },
);

export default schema;