# BUILDNEX STUDIO – COMPLETE PHOTOGRAPHY & EVENT MANAGEMENT SAAS PLATFORM

## Project Overview

Act as a Senior SaaS Product Architect, Full-Stack Developer, Database Architect, UI/UX Designer, QA Engineer and DevOps Engineer.

I want to develop a complete, scalable, multi-tenant SaaS platform named **BuildNex Studio**.

BuildNex Studio is designed for:

- Photography Studios
- Wedding Photography Companies
- Event Management Companies
- Videography Studios
- Creative Production Agencies
- Freelance Photographers
- Photo and Video Editing Companies

The platform must manage the complete business lifecycle, from customer enquiry and event booking to crew assignment, event execution, photo uploads, QR gallery, customer selection, editing, final delivery, payment and business reporting.

This must be a real, production-ready SaaS application, not a static dashboard or UI prototype.

---

# PART 1 – EXISTING PROJECT ANALYSIS

Before writing any code, thoroughly analyze the existing repository.

Review:

1. Frontend architecture.
2. Backend architecture.
3. Database schema.
4. Existing authentication system.
5. Existing user roles and permissions.
6. Existing API endpoints.
7. Existing event management functionality.
8. Existing customer management functionality.
9. Existing quotation and payment functionality.
10. Existing file upload and storage implementation.
11. Existing UI components and design system.
12. Existing deployment configuration.

### Important instructions

- Do not create a completely new project.
- Do not replace the existing application architecture unnecessarily.
- Reuse existing functional components.
- Do not duplicate existing database tables or APIs.
- Preserve existing working features.
- Do not delete existing production data.
- Do not use dummy data as a replacement for real functionality.
- Identify missing modules and existing bugs.
- Prepare a development roadmap before implementation.
- Implement features phase by phase.

---

# PART 2 – SAAS FOUNDATION & TENANT MANAGEMENT

Build a proper multi-tenant architecture.

### Tenant Management

- Studio registration.
- Company profile.
- Studio name and logo.
- Company address.
- Contact details.
- Business registration details.
- Subscription plan.
- Account activation and suspension.
- Tenant-specific settings.
- Tenant-specific users.
- Tenant-specific data access.
- Tenant-specific file storage.
- Tenant-specific invoice settings.
- Tenant-specific branding.

### Subscription Management

- Free trial.
- Basic plan.
- Professional plan.
- Enterprise plan.
- Monthly subscription.
- Annual subscription.
- Subscription renewal.
- Upgrade and downgrade.
- Payment history.
- Subscription expiry.
- Usage limits.
- Feature restrictions.
- Subscription notifications.

### SaaS Super Admin

Create a separate platform-level super admin dashboard.

Features:

- Total registered studios.
- Active studios.
- Inactive studios.
- Trial accounts.
- Paid subscriptions.
- Subscription revenue.
- Plan management.
- Tenant management.
- Subscription management.
- Usage monitoring.
- Platform activity logs.
- Support ticket overview.
- System health overview.

Ensure strict tenant isolation. One studio must never access another studio's customers, events, galleries, employees, payments or documents.

---

# PART 3 – DASHBOARD MANAGEMENT

Create a professional studio dashboard.

### Dashboard Cards

- Total Enquiries.
- Upcoming Events.
- Confirmed Bookings.
- Completed Events.
- Pending Quotations.
- Pending Payments.
- Total Customers.
- Active Team Members.
- Available Photographers.
- Available Videographers.
- Total Assets.
- Assets Currently Assigned.
- Monthly Revenue.
- Monthly Expenses.
- Monthly Profit.
- Pending Photo Editing.
- Pending Customer Selections.
- Pending Deliveries.

### Dashboard Analytics

- Monthly revenue chart.
- Monthly expense chart.
- Event booking chart.
- Event category distribution.
- Customer growth chart.
- Crew utilization chart.
- Payment status chart.
- Event status overview.
- Recent activities.
- Upcoming event calendar.
- Pending tasks.
- Notifications.

Provide filters by date range, event type and studio branch where applicable.

---

# PART 4 – CUSTOMER & CRM MANAGEMENT

Create a complete Customer Relationship Management module.

### Customer Management

- Customer registration.
- Customer ID generation.
- Customer name.
- Contact number.
- Email.
- Address.
- Customer type.
- Customer source.
- Customer profile.
- Customer event history.
- Customer payment history.
- Customer documents.
- Internal notes.
- Customer communication history.

### Lead Management

- New lead creation.
- Lead source tracking.
- Google Maps leads.
- Website enquiries.
- Instagram enquiries.
- Facebook enquiries.
- WhatsApp enquiries.
- Referral leads.
- Lead assignment.
- Follow-up date.
- Follow-up reminders.
- Lead status.
- Lead conversion.
- Lost lead reason.

### CRM Pipeline

New Lead → Contacted → Follow-up → Interested → Quotation Sent → Negotiation → Confirmed → Lost.

### Communication

- Email notifications.
- WhatsApp integration where configured.
- SMS integration where configured.
- Customer communication history.
- Automated reminders.
- Booking confirmation messages.
- Payment reminders.

---

# PART 5 – EVENT MANAGEMENT

This is the core module of BuildNex Studio.

### Event Categories

- Wedding.
- Engagement.
- Reception.
- Pre-wedding Shoot.
- Birthday.
- Corporate Events.
- Baby Shower.
- Maternity Shoot.
- Newborn Photography.
- Outdoor Photography.
- Product Photography.
- Other Custom Events.

Allow studio owners to create custom event categories.

### Event Creation

- Event ID.
- Customer.
- Event title.
- Event category.
- Event date.
- Start time.
- End time.
- Venue.
- Event location.
- Event requirements.
- Number of event days.
- Number of photographers required.
- Number of videographers required.
- Event coordinator.
- Event notes.
- Attachments.

### Event Workflow

Enquiry Created → Availability Checking → Quotation Draft → Quotation Sent → Customer Approval → Agreement → Advance Payment → Booking Confirmed → Crew Assignment → Event Execution → Media Upload → QR Gallery → Customer Selection → Editing → Quality Review → Final Delivery → Final Payment → Event Closed.

### Event Calendar

- Daily calendar.
- Weekly calendar.
- Monthly calendar.
- Event availability.
- Booking conflicts.
- Crew availability.
- Event reminders.
- Calendar filters.

### Event Operations

- Event checklist.
- Event timeline.
- Task assignment.
- Crew assignment.
- Equipment assignment.
- Venue details.
- Event-day notes.
- Event status tracking.
- Event activity history.

Prevent conflicting event bookings according to the studio's configured availability rules.

---

# PART 6 – QUOTATION, PACKAGES & AGREEMENTS

### Package Management

Create configurable photography and event packages.

- Package name.
- Package description.
- Package price.
- Number of photographers.
- Number of videographers.
- Photography hours.
- Videography hours.
- Album details.
- Deliverables.
- Additional services.
- Package validity.

### Quotation Management

- Create quotation.
- Select customer.
- Select event.
- Select package.
- Add custom services.
- Add additional charges.
- Add discount.
- Tax configuration.
- Advance amount.
- Payment schedule.
- Total amount.
- Quotation expiry.
- Quotation PDF generation.
- Quotation approval status.

### Agreement Management

- Agreement templates.
- Customer information.
- Event details.
- Service details.
- Terms and conditions.
- Payment terms.
- Cancellation policy.
- Digital approval/signature integration where configured.
- Agreement document storage.

---

# PART 7 – HR & CREW MANAGEMENT

Build an HR system specifically for photography studios and event management businesses.

### Team Categories

- Photographer.
- Videographer.
- Cinematographer.
- Photo Editor.
- Video Editor.
- Album Designer.
- Drone Operator.
- Event Coordinator.
- Event Manager.
- Assistant Photographer.
- Lighting Technician.
- Production Assistant.
- Freelance Crew.

### Employee Management

- Employee ID.
- Employee profile.
- Personal details.
- Contact information.
- Emergency contact.
- Department.
- Designation.
- Employment type.
- Joining date.
- Skills.
- Experience.
- Portfolio.
- Daily rate.
- Hourly rate.
- Event-based rate.
- Salary details.
- Documents.
- Employment status.

### Skills & Portfolio

- Photography skills.
- Videography skills.
- Candid photography.
- Traditional photography.
- Cinematography.
- Drone operation.
- Photo editing.
- Video editing.
- Album design.
- Experience level.
- Portfolio links.
- Skill ratings.

### Crew Availability

- Daily availability.
- Weekly availability.
- Monthly availability.
- Leave dates.
- Freelance availability.
- Existing event assignments.
- Conflict detection.

### Event Crew Assignment

- Assign photographers.
- Assign videographers.
- Assign editors.
- Assign event coordinators.
- Assign assistants.
- Set reporting time.
- Set event responsibilities.
- Crew acceptance or rejection.
- Crew replacement.
- Assignment history.

### Attendance & Leave

- Check-in.
- Check-out.
- Event-based attendance.
- Working hours.
- Overtime.
- Late arrival.
- Leave applications.
- Leave approval.
- Leave history.

### Crew Payments

- Monthly salary.
- Daily payment.
- Hourly payment.
- Event-based payment.
- Overtime.
- Travel allowance.
- Food allowance.
- Advance payment.
- Pending payment.
- Payment history.

### Crew Performance

- Events completed.
- Attendance.
- Customer feedback.
- Work quality.
- Editing delivery time.
- Task completion.
- Manager feedback.

### Employee Portal

Crew members should be able to view their profiles, availability, assignments, event instructions, assigned tasks and payment history according to their permissions.

---

# PART 8 – ASSET MANAGEMENT

Build a complete equipment and inventory management system for photography studios.

### Asset Categories

- DSLR Cameras.
- Mirrorless Cameras.
- Video Cameras.
- Camera Lenses.
- Tripods.
- Gimbals.
- Drones.
- Lighting Equipment.
- Flash Units.
- Microphones.
- Audio Equipment.
- Memory Cards.
- Batteries.
- Computers.
- Editing Systems.
- Other Accessories.

### Asset Registration

- Asset ID.
- Asset name.
- Asset category.
- Brand.
- Model.
- Serial number.
- Purchase date.
- Purchase cost.
- Warranty expiry.
- Current condition.
- Asset location.
- Asset status.
- Asset images.
- Invoice documents.

### Asset Assignment

- Assign equipment to employee.
- Assign equipment to event.
- Issue date.
- Expected return date.
- Actual return date.
- Handover details.
- Return condition.
- Damage information.
- Missing asset tracking.

### Maintenance Management

- Maintenance schedule.
- Service history.
- Repair requests.
- Repair expenses.
- Warranty tracking.
- Equipment condition.
- Maintenance reminders.

### Asset Reports

- Total assets.
- Available assets.
- Assigned assets.
- Under-maintenance assets.
- Damaged assets.
- Lost assets.
- Asset purchase value.
- Asset maintenance expenses.
- Asset utilization.

Support QR/barcode identification where appropriate.

---

# PART 9 – TICKET & SUPPORT MANAGEMENT

Build an internal ticketing and issue-management system.

### Ticket Categories

- Customer Complaints.
- Booking Issues.
- Payment Issues.
- Event Issues.
- Crew Issues.
- Equipment Issues.
- Photo Editing Requests.
- Delivery Issues.
- Technical Issues.
- General Support.

### Ticket Creation

- Ticket ID.
- Ticket title.
- Description.
- Category.
- Priority.
- Customer.
- Event reference.
- Assigned employee.
- Attachments.
- Created date.
- Due date.
- Ticket status.

### Ticket Workflow

Open → Assigned → In Progress → Waiting for Response → Resolved → Closed.

### Ticket Features

- Ticket assignment.
- Internal comments.
- Customer comments where enabled.
- File attachments.
- Priority management.
- Status tracking.
- Escalation.
- Due-date reminders.
- Activity timeline.
- Ticket history.
- Resolution notes.
- Ticket reports.

Also provide a separate customer support ticket portal where customers can submit issues and track permitted ticket details.

If public event admission ticketing is needed, implement it as a separate optional submodule with ticket types, capacity, QR passes, attendee registration, check-in and refunds. Do not mix it with internal support tickets.

---

# PART 10 – FINANCE MANAGEMENT

Build a complete studio finance management system.

### Income Management

- Event booking income.
- Advance payments.
- Final payments.
- Additional service income.
- Album sales.
- Photo print sales.
- Other income.

### Expense Management

- Employee salary.
- Freelance crew payments.
- Travel expenses.
- Food expenses.
- Accommodation.
- Equipment purchases.
- Equipment maintenance.
- Office rent.
- Software subscriptions.
- Marketing expenses.
- Other business expenses.

### Payment Management

- Cash.
- Bank transfer.
- UPI.
- Payment gateway integration.
- Advance payment.
- Partial payment.
- Final payment.
- Refund.
- Outstanding balance.
- Payment receipt.
- Payment history.

### Invoice Management

- Invoice generation.
- Invoice numbering.
- Customer information.
- Service details.
- Tax configuration.
- Discount.
- Total amount.
- Payment status.
- PDF download.
- Invoice history.

### Financial Reports

- Daily revenue.
- Monthly revenue.
- Yearly revenue.
- Event-wise profit.
- Event-wise expenses.
- Customer outstanding payments.
- Crew payments.
- Asset expenses.
- Income vs expenses.
- Cash flow.
- Profit and loss summary.

Maintain proper transaction records. Do not duplicate payments or expenses when integrating with Event Management, Crew Management and E-commerce.

---

# PART 11 – E-COMMERCE MANAGEMENT

Build an integrated online store for photography studios.

The studio should be able to sell additional products and services to customers.

### Product Categories

- Photo Albums.
- Wedding Albums.
- Photo Frames.
- Photo Prints.
- Canvas Prints.
- Customized Gifts.
- Digital Photo Packages.
- Video Packages.
- Additional Editing Services.
- Photography Packages.
- Event Add-on Services.

### Product Management

- Product ID.
- Product name.
- Category.
- Description.
- Product images.
- Product variants.
- Size.
- Material.
- Price.
- Discount.
- Stock quantity.
- SKU.
- Product status.

### Online Store

- Studio-branded storefront.
- Product listing.
- Product detail page.
- Search.
- Filters.
- Shopping cart.
- Checkout.
- Customer information.
- Shipping address.
- Payment integration.
- Order confirmation.

### Order Management

- Order creation.
- Order ID.
- Customer details.
- Order items.
- Payment status.
- Order status.
- Processing.
- Printing.
- Packaging.
- Shipping.
- Delivered.
- Cancelled.
- Refunded.

### Custom Album Orders

- Customer selects photos.
- Selects album size.
- Selects number of pages.
- Selects design options.
- Submits customization request.
- Studio reviews and approves.
- Album design assigned.
- Production status tracked.
- Final delivery.

### Inventory Management

- Stock tracking.
- Stock adjustment.
- Low-stock notifications.
- Product variants.
- Purchase records.
- Supplier details.
- Inventory reports.

### E-commerce Reports

- Total orders.
- Total sales.
- Pending orders.
- Delivered orders.
- Product-wise sales.
- Best-selling products.
- Inventory status.
- Refund reports.

Integrate e-commerce revenue and expenses with Finance Management.

---

# PART 12 – QR PHOTO GALLERY & CUSTOMER PHOTO SELECTION

This is a key differentiating feature of BuildNex Studio.

### Gallery Management

- Create event gallery.
- Upload photos.
- Upload videos.
- Organize albums.
- Organize folders.
- Set gallery visibility.
- Private gallery access.
- Password protection.
- Expiry date.
- Gallery download permissions.

### QR Gallery

- Generate unique QR code for each event.
- QR-based customer gallery access.
- Custom branded gallery page.
- Secure access token.
- QR code download.
- QR code sharing.
- QR code expiry.
- Revoke or regenerate QR access.

### Customer Photo Selection

- View event photos.
- Mark favorite photos.
- Select photos for albums.
- Add comments.
- Submit final selections.
- Track selection progress.
- Set selection deadlines.
- Notify studio when selection is completed.

### AI Face Recognition – Future Enhancement

- Optional face grouping.
- Find matching customer photos.
- Consent-based face processing.
- Secure biometric data handling.
- Deletion and retention controls.

Do not implement face recognition without appropriate consent and privacy safeguards.

---

# PART 13 – PHOTO & VIDEO PRODUCTION MANAGEMENT

Manage the complete media production workflow.

### Workflow

Media Upload → Photo Sorting → Photo Selection → Editing Assignment → Editing In Progress → Quality Review → Customer Approval → Final Delivery.

### Features

- Assign photos to editors.
- Assign videos to editors.
- Editing deadlines.
- Editing status.
- Internal review.
- Revision requests.
- Customer feedback.
- Final approval.
- Final media delivery.
- Delivery history.

### Editor Dashboard

- Assigned events.
- Pending photo editing.
- Pending video editing.
- Upcoming deadlines.
- Completed tasks.
- Revision requests.
- Workload overview.

---

# PART 14 – TASK & PROJECT MANAGEMENT

Build a task management system connected to events and employees.

### Features

- Create projects.
- Create tasks.
- Assign employees.
- Set priority.
- Set start date.
- Set due date.
- Task status.
- Progress percentage.
- Subtasks.
- Checklists.
- Comments.
- File attachments.
- Time tracking.
- Task reminders.
- Overdue tasks.
- Project timeline.
- Kanban board.
- Task reports.

Support tasks linked to customers, events, tickets, assets and editing workflows.

---

# PART 15 – CUSTOMER PORTAL

Create a responsive customer portal.

Customers should be able to:

- Register and log in.
- View their profile.
- View bookings.
- View event details.
- View quotations.
- Approve quotations.
- View agreements.
- View invoices.
- Pay outstanding balances.
- Access QR galleries.
- Select photographs.
- Submit editing requests.
- View delivery status.
- Submit support tickets.
- View order history.
- Purchase additional products.
- Receive notifications.

Customers must only access their own records and explicitly shared event/gallery information.

---

# PART 16 – NOTIFICATION MANAGEMENT

Build a centralized notification system.

### Notification Types

- New enquiry.
- New booking.
- Quotation approval.
- Payment received.
- Payment due.
- Event reminder.
- Crew assignment.
- Crew assignment acceptance.
- Event schedule change.
- Leave request.
- Ticket update.
- Asset return reminder.
- Editing deadline.
- Customer photo selection.
- Final delivery.
- New order.
- Low stock.
- Subscription expiry.

Support in-app notifications and configurable email, WhatsApp and SMS integrations.

---

# PART 17 – REPORTS & ANALYTICS

Create a complete reporting dashboard.

### Business Reports

- Revenue reports.
- Expense reports.
- Profit reports.
- Event booking reports.
- Customer reports.
- Lead conversion reports.
- Quotation conversion reports.
- Outstanding payment reports.

### HR Reports

- Employee reports.
- Crew availability.
- Crew assignment reports.
- Attendance reports.
- Freelance payment reports.
- Employee performance.

### Asset Reports

- Asset utilization.
- Asset maintenance.
- Asset allocation.
- Asset purchase value.

### Event Reports

- Event status.
- Event calendar.
- Event expenses.
- Event-wise profit.
- Crew assignments.
- Delivery status.

### E-commerce Reports

- Sales reports.
- Orders.
- Products.
- Inventory.
- Refunds.

Include date filters, search, sorting, pagination and Excel/PDF exports where appropriate.

---

# PART 18 – SETTINGS & CONFIGURATION

Build a complete settings module.

### Studio Settings

- Studio profile.
- Logo.
- Address.
- Contact details.
- Business details.
- Branches.
- Business hours.

### User & Permission Settings

- Users.
- Roles.
- Permissions.
- User invitations.
- Account status.
- Login history.

### Business Configuration

- Event categories.
- Service categories.
- Package configuration.
- Payment methods.
- Invoice settings.
- Tax configuration.
- Currency.
- Date and time format.
- Notification settings.
- Booking policies.
- Cancellation policies.
- Gallery settings.

### Integration Settings

- AWS S3.
- Email provider.
- WhatsApp provider.
- SMS provider.
- Payment gateway.
- Google Calendar where required.
- Analytics integrations.

Credentials must be stored securely on the backend.

---

# PART 19 – USER ROLES & ACCESS CONTROL

Implement role-based access control.

Suggested roles:

1. SaaS Super Admin.
2. Studio Owner.
3. Studio Admin.
4. Branch Manager.
5. Event Manager.
6. HR Manager.
7. Finance Manager.
8. Asset Manager.
9. Photographer.
10. Videographer.
11. Photo Editor.
12. Video Editor.
13. Customer.
14. Freelance Crew.

Permissions must be configurable.

Support:

- View.
- Create.
- Edit.
- Delete.
- Approve.
- Reject.
- Assign.
- Export.
- Download.
- Financial access.
- Sensitive data access.

Enforce authorization in backend APIs, not only in frontend menus.

---

# PART 20 – DATABASE & BACKEND ARCHITECTURE

Analyze the existing backend and database before making schema changes.

Design a normalized and scalable database structure.

Potential database domains:

- Tenants.
- Subscriptions.
- Users.
- Roles.
- Permissions.
- Customers.
- Leads.
- Events.
- Bookings.
- Packages.
- Quotations.
- Agreements.
- Payments.
- Invoices.
- Employees.
- Skills.
- Availability.
- Attendance.
- Leaves.
- Crew Assignments.
- Assets.
- Asset Assignments.
- Maintenance.
- Tickets.
- Products.
- Product Variants.
- Inventory.
- Orders.
- Order Items.
- Galleries.
- Gallery Media.
- Photo Selections.
- Editing Tasks.
- Projects.
- Tasks.
- Notifications.
- Audit Logs.

### Technical Requirements

- Proper primary and foreign keys.
- Database indexes.
- Tenant isolation.
- Secure authentication.
- Role-based API authorization.
- Input validation.
- Pagination.
- Search and filtering.
- API error handling.
- Transaction management.
- Audit history.
- Secure file upload.
- Rate limiting.
- Database backups.
- Environment variable protection.

Do not blindly create duplicate tables if equivalent structures already exist.

---

# PART 21 – UI/UX DESIGN SYSTEM

Design a premium, professional SaaS application.

### Design Direction

- Modern light theme.
- Clean white background.
- Professional blue primary color.
- Consistent typography.
- Modern sidebar navigation.
- Responsive header.
- Dashboard cards.
- Professional data tables.
- Search and filters.
- Calendar interfaces.
- Kanban boards.
- Modal dialogs.
- Drawer forms.
- Toast notifications.
- Charts and analytics.
- Empty states.
- Loading states.
- Error states.
- Form validation.

### Responsive Requirements

Desktop, laptop, tablet and mobile.

Ensure all major workflows can be used comfortably on mobile, especially event assignment, attendance, asset handover and customer gallery access.

Avoid unnecessary gradients, excessive animation and cluttered interfaces.

---

# PART 22 – SECURITY & PRODUCTION READINESS

Implement:

- Secure password hashing.
- Authentication and session management.
- Role-based access.
- Tenant isolation.
- API rate limiting.
- Input validation.
- Secure file uploads.
- Private object storage.
- Signed URLs for protected media.
- Audit logging.
- Database backup.
- Error logging.
- Secret management.
- CORS configuration.
- HTTPS.
- Access revocation.
- Data retention controls.

Do not expose database credentials, payment secrets or private storage credentials to frontend code.

---

# PART 23 – DEVELOPMENT PHASES

Develop the product in the following order.

### Phase 1 – Foundation
- Existing project audit.
- SaaS tenant architecture.
- Authentication.
- User roles.
- Studio settings.
- Dashboard.

### Phase 2 – Business Core
- Customer management.
- CRM.
- Enquiries.
- Event management.
- Booking calendar.
- Packages.
- Quotations.
- Agreements.

### Phase 3 – Event Operations
- HR and crew management.
- Crew availability.
- Event assignments.
- Attendance.
- Asset management.
- Equipment allocation.
- Task management.

### Phase 4 – Financial Management
- Income.
- Expenses.
- Payments.
- Invoices.
- Crew payments.
- Event profitability.
- Financial reports.

### Phase 5 – Media Workflow
- Gallery management.
- QR gallery.
- Customer photo selection.
- Editing workflow.
- Quality review.
- Final delivery.

### Phase 6 – E-commerce
- Product management.
- Product variants.
- Inventory.
- Storefront.
- Cart.
- Checkout.
- Orders.
- Album customization.

### Phase 7 – Support & Automation
- Ticket management.
- Notifications.
- Customer portal.
- Automated reminders.
- Reports.

### Phase 8 – SaaS Management
- Subscription management.
- Plan limits.
- Platform super admin.
- Tenant management.
- Usage analytics.

### Phase 9 – Testing & Release
- Functional testing.
- API testing.
- Database testing.
- Role testing.
- Tenant isolation testing.
- Security testing.
- Responsive testing.
- Performance testing.
- Regression testing.
- Production deployment.

---

# PART 24 – TESTING REQUIREMENTS

For every module:

1. Complete UI development.
2. Complete backend API development.
3. Complete database integration.
4. Test create, read, update and delete operations.
5. Test all form validations.
6. Test authentication and authorization.
7. Test tenant isolation.
8. Test API error handling.
9. Test responsive screens.
10. Test real workflows across connected modules.
11. Fix critical and high-priority bugs.
12. Update development documentation.

Create test cases and maintain a bug-tracking list.

Do not mark a module completed just because its UI has been built.

---

# PART 25 – FINAL ACCEPTANCE CRITERIA

The final product must support this complete business workflow:

Customer Enquiry
→ CRM Follow-up
→ Event Availability
→ Quotation
→ Customer Approval
→ Agreement
→ Advance Payment
→ Booking Confirmation
→ Crew Assignment
→ Asset Assignment
→ Event Execution
→ Attendance
→ Media Upload
→ QR Gallery
→ Customer Photo Selection
→ Editing
→ Quality Review
→ Final Delivery
→ Final Payment
→ Event Closure
→ Finance Reports
→ Customer Feedback.

Additional workflows:

- Customer buys photo albums and prints through the online store.
- Customer raises a support ticket.
- Studio manager assigns crew and equipment.
- Finance manager tracks event revenue and expenses.
- Studio owner monitors business performance.
- SaaS Super Admin manages studios and subscriptions.

### Final Instruction

First inspect the existing repository and produce:

1. Current architecture report.
2. Existing modules report.
3. Missing features report.
4. Database change proposal.
5. API implementation plan.
6. UI implementation plan.
7. Development timeline.
8. Testing strategy.

After approval, implement the platform phase by phase.

Do not generate the entire application in one uncontrolled operation.

Do not replace working functionality.

Build a reliable, scalable, secure and production-ready BuildNex Studio SaaS platform.