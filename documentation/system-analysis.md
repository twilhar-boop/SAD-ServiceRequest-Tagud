# System Analysis and Design — ICT Service Request Management System

## 1. Problem Statement

The university's ICT office currently receives technical support requests through
verbal reports, text messages, and social media, with no single record of what
was asked for or by whom. Because these channels are disconnected, requests are
often forgotten, duplicated, or left untracked until the requester follows up
again. Staff have no simple way to see how many concerns are open, in progress,
or resolved at any given time. This system centralizes request intake into one
authenticated, searchable log so the ICT office can record, monitor, and update
service requests consistently, with a dashboard that gives an at-a-glance view
of current workload. *(98 words)*

## 2. Actors

**Primary actor: System User (ICT Personnel / Requester-facing staff)**

A single actor role is used for this exercise. Any authenticated user may view
all requests (to support shared visibility of ICT workload) but may only edit
or delete records they personally created, enforced through Supabase Row Level
Security rather than through application-level role checks.

## 3. Use Case Diagram

```
                     ┌───────────────────────────────┐
                     │     ICT Service Request        │
                     │            System               │
                     │                                  │
   ┌──────┐          │   ○ Login                        │
   │      │──────────┼──►                                │
   │      │──────────┼──►   ○ View Dashboard              │
   │      │──────────┼──►   ○ Create Request              │
   │ User │──────────┼──►   ○ View Requests                │
   │      │──────────┼──►   ○ Search Request                │
   │      │──────────┼──►   ○ Filter Requests                │
   │      │──────────┼──►   ○ Update Request                  │
   │      │──────────┼──►   ○ Delete Request                   │
   │      │──────────┼──►   ○ Logout                            │
   └──────┘          │                                  │
                     └───────────────────────────────┘
```

**Use case notes**

| Use Case | Precondition | Notes |
|---|---|---|
| Login | Account exists in Supabase Auth | BR-07 gates every other use case |
| View Dashboard | Logged in | Reads aggregate counts from `service_requests` |
| Create Request | Logged in | Status forced to `Pending` (BR-06) |
| View Requests | Logged in | RLS `SELECT` policy allows all authenticated users |
| Search Request | Logged in | Client-side filter on requester name / description |
| Filter Requests | Logged in | Client-side filter on status and priority |
| Update Request | Logged in, owns the record | RLS `UPDATE` policy checks `auth.uid() = user_id` |
| Delete Request | Logged in, owns the record | Confirmation dialog required (BR-08) |
| Logout | Logged in | Clears Supabase session |

## 4. Simple ERD

```
USER                              SERVICE_REQUEST
----------------                  ----------------------
user_id (PK)      1            M  id (PK)
email                 ─creates──► requester_name
                                   department
                                   category
                                   description
                                   priority
                                   status
                                   created_at
                                   user_id (FK → USER.user_id)
```

One `USER` (a Supabase `auth.users` row) creates many `SERVICE_REQUEST` rows.
`SERVICE_REQUEST.user_id` is a foreign key into `auth.users(id)`, matching the
table definition in `supabase/schema.sql`.

## 5. Business Rules Implemented

| Rule | Requirement | Where implemented |
|---|---|---|
| BR-01 | Requester name cannot be empty | `app.js: validateForm()` + `NOT NULL` |
| BR-02 | Department must be provided | `app.js: validateForm()` + `NOT NULL` |
| BR-03 | Category must be selected | `app.js: validateForm()` + `NOT NULL` |
| BR-04 | Description must contain sufficient information | `app.js: validateForm()` (min 10 chars) + `NOT NULL` |
| BR-05 | Priority must be Low, Medium, or High | `<select>` fixed options + `validateForm()` |
| BR-06 | New requests automatically receive Pending status | `app.js: createRequest()` hardcodes `status: "Pending"` |
| BR-07 | Users must log in before managing requests | `auth.js: requireAuth()` redirect guard on `index.html` |
| BR-08 | Confirmation must appear before deleting a record | `app.js: confirmDelete()` uses `window.confirm()` |
| BR-09 | Date requested must automatically be recorded | `created_at TIMESTAMPTZ DEFAULT NOW()` in schema |
| BR-10 | Unauthorized database modification should be prevented | Row Level Security policies in `supabase/schema.sql` |
