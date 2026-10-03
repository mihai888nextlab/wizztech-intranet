import { pgTable, serial, varchar, text, timestamp, time, date, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  /**
   * "member" | "volunteer". A volunteer is an outsider who helps at events;
   * every route they may reach is allow-listed in `src/lib/volunteers.ts`.
   */
  accountType: varchar("account_type", { length: 20 }).notNull().default("member"),
  /**
   * The jobs this person holds, in any combination — running the volunteers
   * and creating events are different jobs that often land on the same person.
   * Empty for a plain member. See `TEAM_ROLES` in `src/lib/roles.ts`.
   */
  roles: varchar("roles", { length: 30 }).array().notNull().default([]),
  /**
   * Set when somebody else chose this person's PIN — a volunteer starts on
   * 0000, which everyone knows — and cleared once they pick their own.
   */
  mustChangePin: boolean("must_change_pin").notNull().default(false),
  /**
   * Which sides of the team a volunteer helps on — several, often: the person
   * filming the match is frequently the one writing the post about it. Empty
   * until they or a coordinator pick. See `VOLUNTEER_DEPARTMENTS`.
   */
  departments: varchar("departments", { length: 20 }).array().notNull().default([]),
  /**
   * The payload behind a volunteer's badge QR: a random token rather than the
   * user id, so a scanned code cannot be guessed or counted up to. Null until
   * the badge is first drawn — see `ensureBadgeCode`.
   */
  badgeCode: varchar("badge_code", { length: 32 }).unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  location: varchar("location", { length: 200 }),
  /**
   * Volunteers only see the events ticked for them; the team sees every event.
   * Defaults to false so a new event is team-only until someone says otherwise.
   */
  forVolunteers: boolean("for_volunteers").notNull().default(false),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const announcements = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  /** Markdown source, rendered on the client. */
  description: text("description").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Document requests referenced by an announcement, so a post can say "upload
 * these" and show the member their own status inline.
 */
export const announcementDocuments = pgTable("announcement_documents", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
  requestId: integer("request_id").notNull().references(() => fileRequests.id, { onDelete: "cascade" }),
}, (table) => ({
  announcementRequestUnique: uniqueIndex("announcement_document_unique").on(table.announcementId, table.requestId),
}));

/** A request from an admin for each targeted member to upload one file. */
export const fileRequests = pgTable("file_requests", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  /** Markdown source, rendered on the client. */
  description: text("description"),
  /** "all" targets every member; "selected" uses fileRequestAssignees. */
  audience: varchar("audience", { length: 20 }).notNull().default("all"),
  dueDate: date("due_date"),
  maxSizeMb: integer("max_size_mb").notNull().default(10),
  /** Comma-separated MIME types; null falls back to DEFAULT_ALLOWED_TYPES. */
  allowedTypes: varchar("allowed_types", { length: 300 }),
  /** Null while the request is still accepting uploads. */
  closedAt: timestamp("closed_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const fileRequestAssignees = pgTable("file_request_assignees", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => fileRequests.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({
  requestUserUnique: uniqueIndex("file_request_assignee_unique").on(table.requestId, table.userId),
}));

/**
 * One current file per member per request. Re-uploading replaces the row, and
 * the superseded object is deleted from storage by the submissions handler.
 */
export const fileSubmissions = pgTable("file_submissions", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => fileRequests.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  /** "submitted" | "approved" | "rejected" */
  status: varchar("status", { length: 20 }).notNull().default("submitted"),
  reviewNote: text("review_note"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
}, (table) => ({
  requestUserUnique: uniqueIndex("file_submission_unique").on(table.requestId, table.userId),
}));

/**
 * A request for members to fill in structured fields instead of uploading a
 * file. Mirrors fileRequests, with the fields table carrying the questions.
 */
export const formRequests = pgTable("form_requests", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  /** Markdown source, rendered on the client. */
  description: text("description"),
  /** "all" targets every member; "selected" uses formRequestAssignees. */
  audience: varchar("audience", { length: 20 }).notNull().default("all"),
  dueDate: date("due_date"),
  /** Null while the request is still accepting answers. */
  closedAt: timestamp("closed_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** One question on a form request. */
export const formRequestFields = pgTable("form_request_fields", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => formRequests.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 200 }).notNull(),
  /** "text" | "number" | "date" | "select" */
  type: varchar("type", { length: 20 }).notNull().default("text"),
  required: boolean("required").notNull().default(true),
  placeholder: varchar("placeholder", { length: 200 }),
  /** JSON array of choices for select fields; null for other types. */
  options: text("options"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const formRequestAssignees = pgTable("form_request_assignees", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => formRequests.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => ({
  requestUserUnique: uniqueIndex("form_request_assignee_unique").on(table.requestId, table.userId),
}));

/**
 * One completed form per member per request. Re-submitting replaces the row,
 * and the old values are deleted by the submissions handler.
 */
export const formSubmissions = pgTable("form_submissions", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => formRequests.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** "submitted" | "approved" | "rejected" */
  status: varchar("status", { length: 20 }).notNull().default("submitted"),
  reviewNote: text("review_note"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (table) => ({
  requestUserUnique: uniqueIndex("form_submission_unique").on(table.requestId, table.userId),
}));

export const formSubmissionValues = pgTable("form_submission_values", {
  id: serial("id").primaryKey(),
  submissionId: integer("submission_id").notNull().references(() => formSubmissions.id, { onDelete: "cascade" }),
  fieldId: integer("field_id").notNull().references(() => formRequestFields.id, { onDelete: "cascade" }),
  value: text("value").notNull(),
}, (table) => ({
  submissionFieldUnique: uniqueIndex("form_submission_value_unique").on(table.submissionId, table.fieldId),
}));

/**
 * Form requests referenced by an announcement, so a post can say "fill these
 * in" and show the member their own status inline.
 */
export const announcementForms = pgTable("announcement_forms", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
  requestId: integer("request_id").notNull().references(() => formRequests.id, { onDelete: "cascade" }),
}, (table) => ({
  announcementRequestUnique: uniqueIndex("announcement_form_unique").on(table.announcementId, table.requestId),
}));

/**
 * Files an admin attaches to an announcement, stored in the bucket. Unlike
 * linked requests, these are reference material — a PDF to read or complete —
 * not something members submit back.
 */
export const announcementFiles = pgTable("announcement_files", {
  id: serial("id").primaryKey(),
  announcementId: integer("announcement_id").notNull().references(() => announcements.id, { onDelete: "cascade" }),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  signedInAt: timestamp("signed_in_at").defaultNow().notNull(),
}, (table) => ({
  userEventUnique: uniqueIndex("user_event_unique").on(table.userId, table.eventId),
}));

/**
 * One award of points to a volunteer. The total is the sum of the rows, so a
 * mistake is undone by deleting the row or by a negative correction, and the
 * volunteer can always see why their score is what it is.
 */
export const volunteerPoints = pgTable("volunteer_points", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Negative for corrections. */
  amount: integer("amount").notNull(),
  reason: varchar("reason", { length: 200 }).notNull(),
  /** The event the points were earned at, if any. */
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  awardedBy: integer("awarded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * One row per browser, not per person: a member with a phone and a laptop has
 * two, and both get notified. The row's existence is the preference — turning
 * notifications off deletes it, so there is no separate settings table.
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** Push service URLs run long, so text rather than varchar. */
  endpoint: text("endpoint").notNull(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  userAgent: varchar("user_agent", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => ({
  endpointUnique: uniqueIndex("push_subscription_endpoint_unique").on(table.endpoint),
}));

export const labSessions = pgTable("lab_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkIn: timestamp("check_in").defaultNow().notNull(),
  checkOut: timestamp("check_out"),
  durationMinutes: integer("duration_minutes"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/*
  Team finances. Every entry belongs to one FTC season and one category, so a
  season can be summed, charted and compared against the next one.
*/

/** An FTC competition season — the bucket every finance entry falls into. */
export const financeSeasons = pgTable("finance_seasons", {
  id: serial("id").primaryKey(),
  /** How the team says it out loud, e.g. "2025-26 DECODE". */
  name: varchar("name", { length: 100 }).unique().notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  /** Exactly one season is current; setting a new one clears the others. */
  isCurrent: boolean("is_current").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * A heading in the ledger. Categories belong to one side of it — "Sponsorship"
 * is never an expense — so the entry form can offer only the ones that fit.
 */
export const financeCategories = pgTable("finance_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
  /** "income" | "expense" */
  kind: varchar("kind", { length: 10 }).notNull(),
  /** 1-5, indexing the --chart-N CSS tokens so charts stay theme-aware. */
  colorIndex: integer("color_index").notNull().default(1),
  /** Set instead of deleting once entries reference it, so old seasons still read correctly. */
  archivedAt: timestamp("archived_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  nameKindUnique: uniqueIndex("finance_category_unique").on(table.name, table.kind),
}));

/**
 * One movement of money. Amounts are integers in minor units throughout — a
 * float would quietly lose bani over a season's worth of rows.
 */
export const financeEntries = pgTable("finance_entries", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").notNull().references(() => financeSeasons.id),
  categoryId: integer("category_id").notNull().references(() => financeCategories.id),
  /** "income" | "expense". Denormalised from the category so totals need no join. */
  kind: varchar("kind", { length: 10 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  /** Who paid us, or who we paid. */
  counterparty: varchar("counterparty", { length: 120 }),
  note: text("note"),
  occurredOn: date("occurred_on").notNull(),
  /** Minor units of `currency` — bani for RON, cents for EUR and USD. */
  amountMinor: integer("amount_minor").notNull(),
  /** "RON" | "EUR" | "USD" */
  currency: varchar("currency", { length: 3 }).notNull().default("RON"),
  /**
   * RON per 1 unit of `currency`, times a million (1_000_000 for RON itself).
   * Frozen when the entry is written, so today's exchange rate can never move
   * what last season's part order cost.
   */
  rateToRonMicros: integer("rate_to_ron_micros").notNull().default(1_000_000),
  /**
   * amountMinor converted to bani, recomputed on every write. Every total and
   * chart sums this one column, so a row and the total it feeds cannot disagree.
   * Integer bani caps a single entry near 21M RON, well past an FTC team's scale.
   */
  amountRonBani: integer("amount_ron_bani").notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Paperwork backing an entry: the proforma that was quoted, the invoice that
 * was paid, the contract that was signed. Stored in the bucket like every other
 * upload, and readable only by treasurers.
 */
export const financeDocuments = pgTable("finance_documents", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull().references(() => financeEntries.id, { onDelete: "cascade" }),
  /** "proforma" | "invoice" | "contract" | "receipt" | "other" */
  kind: varchar("kind", { length: 20 }).notNull().default("other"),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  attendance: many(attendance),
  labSessions: many(labSessions),
  createdEvents: many(events),
  announcements: many(announcements),
  // No reverse relations for file submissions on purpose: that table has two
  // foreign keys into users (author and reviewer), which would make a `many`
  // here ambiguous. Submissions are always queried from the request side.
}));

export const fileRequestsRelations = relations(fileRequests, ({ one, many }) => ({
  author: one(users, {
    fields: [fileRequests.createdBy],
    references: [users.id],
  }),
  assignees: many(fileRequestAssignees),
  submissions: many(fileSubmissions),
  announcements: many(announcementDocuments),
}));

export const fileRequestAssigneesRelations = relations(fileRequestAssignees, ({ one }) => ({
  request: one(fileRequests, {
    fields: [fileRequestAssignees.requestId],
    references: [fileRequests.id],
  }),
  user: one(users, {
    fields: [fileRequestAssignees.userId],
    references: [users.id],
  }),
}));

export const fileSubmissionsRelations = relations(fileSubmissions, ({ one }) => ({
  request: one(fileRequests, {
    fields: [fileSubmissions.requestId],
    references: [fileRequests.id],
  }),
  user: one(users, {
    fields: [fileSubmissions.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [fileSubmissions.reviewedBy],
    references: [users.id],
  }),
}));

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  author: one(users, {
    fields: [announcements.createdBy],
    references: [users.id],
  }),
  documents: many(announcementDocuments),
  forms: many(announcementForms),
  files: many(announcementFiles),
}));

export const formRequestsRelations = relations(formRequests, ({ one, many }) => ({
  author: one(users, {
    fields: [formRequests.createdBy],
    references: [users.id],
  }),
  fields: many(formRequestFields),
  assignees: many(formRequestAssignees),
  submissions: many(formSubmissions),
  announcements: many(announcementForms),
}));

export const formRequestFieldsRelations = relations(formRequestFields, ({ one, many }) => ({
  request: one(formRequests, {
    fields: [formRequestFields.requestId],
    references: [formRequests.id],
  }),
  values: many(formSubmissionValues),
}));

export const formRequestAssigneesRelations = relations(formRequestAssignees, ({ one }) => ({
  request: one(formRequests, {
    fields: [formRequestAssignees.requestId],
    references: [formRequests.id],
  }),
  user: one(users, {
    fields: [formRequestAssignees.userId],
    references: [users.id],
  }),
}));

export const formSubmissionsRelations = relations(formSubmissions, ({ one, many }) => ({
  request: one(formRequests, {
    fields: [formSubmissions.requestId],
    references: [formRequests.id],
  }),
  user: one(users, {
    fields: [formSubmissions.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [formSubmissions.reviewedBy],
    references: [users.id],
  }),
  values: many(formSubmissionValues),
}));

export const formSubmissionValuesRelations = relations(formSubmissionValues, ({ one }) => ({
  submission: one(formSubmissions, {
    fields: [formSubmissionValues.submissionId],
    references: [formSubmissions.id],
  }),
  field: one(formRequestFields, {
    fields: [formSubmissionValues.fieldId],
    references: [formRequestFields.id],
  }),
}));

export const announcementFormsRelations = relations(announcementForms, ({ one }) => ({
  announcement: one(announcements, {
    fields: [announcementForms.announcementId],
    references: [announcements.id],
  }),
  request: one(formRequests, {
    fields: [announcementForms.requestId],
    references: [formRequests.id],
  }),
}));

export const announcementFilesRelations = relations(announcementFiles, ({ one }) => ({
  announcement: one(announcements, {
    fields: [announcementFiles.announcementId],
    references: [announcements.id],
  }),
}));

export const announcementDocumentsRelations = relations(announcementDocuments, ({ one }) => ({
  announcement: one(announcements, {
    fields: [announcementDocuments.announcementId],
    references: [announcements.id],
  }),
  request: one(fileRequests, {
    fields: [announcementDocuments.requestId],
    references: [fileRequests.id],
  }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, { fields: [events.createdBy], references: [users.id] }),
  attendance: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(users, { fields: [attendance.userId], references: [users.id] }),
  event: one(events, { fields: [attendance.eventId], references: [events.id] }),
}));

export const labSessionsRelations = relations(labSessions, ({ one }) => ({
  user: one(users, { fields: [labSessions.userId], references: [users.id] }),
}));

export const financeSeasonsRelations = relations(financeSeasons, ({ many }) => ({
  entries: many(financeEntries),
}));

export const financeCategoriesRelations = relations(financeCategories, ({ many }) => ({
  entries: many(financeEntries),
}));

export const financeEntriesRelations = relations(financeEntries, ({ one, many }) => ({
  season: one(financeSeasons, {
    fields: [financeEntries.seasonId],
    references: [financeSeasons.id],
  }),
  category: one(financeCategories, {
    fields: [financeEntries.categoryId],
    references: [financeCategories.id],
  }),
  author: one(users, {
    fields: [financeEntries.createdBy],
    references: [users.id],
  }),
  documents: many(financeDocuments),
}));

export const financeDocumentsRelations = relations(financeDocuments, ({ one }) => ({
  entry: one(financeEntries, {
    fields: [financeDocuments.entryId],
    references: [financeEntries.id],
  }),
}));
