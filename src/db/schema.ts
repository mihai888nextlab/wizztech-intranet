import { pgTable, serial, varchar, text, timestamp, time, date, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"),
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
