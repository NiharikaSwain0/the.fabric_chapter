# The Fabric Chapter

The Fabric Chapter is a stylish online store for scrunchies, hair clips, and custom gift hampers, featuring customer authentication, a shopping cart, order management, and Firebase integration.

A responsive React storefront for The Fabric Chapter, built with Firebase Authentication and Cloud Firestore. The catalog starts empty and only displays products and hampers that the store publishes.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the web app configuration from a Firebase project on the Spark plan.
3. Enable Email/Password sign-in and create a Firestore database in the Firebase console.
4. Publish `firestore.rules` from the Firebase console or with the Firebase CLI.
5. Start the app with `npm run dev`.
6. For Hosting, run `npm run build`, then `firebase deploy --only hosting,firestore:rules`. `firebase.json` configures static hosting and SPA routes; no billing or Functions are enabled.

All storefront routes require an authenticated Firebase account. Signed-out visitors are sent to login or registration and returned to their requested page after signing in. Without Firebase configuration, the auth screens remain available but account creation and store access cannot complete. No demo inventory is seeded.

## Firebase setup

- Registration and login use one customer-facing Email/Password flow; there is no role selector. All authenticated users receive customer access by default. Elevated admin access comes only from an owner-provisioned `admins/{uid}` document, never from a role field or value supplied by the browser.
- Every storefront route, including catalog, product, policy, and admin pages, is behind the authentication gate. Login, registration, and password reset remain available before signing in.
- Provision administrators from the Firebase console using the account's authenticated UID, or from a trusted owner-controlled Firebase Admin SDK environment. Client rules deny create, update, delete, and list access to `admins`; changing a URL or request cannot grant admin access.
- The app uses Firebase Authentication and Cloud Firestore from the client. It does not use Cloud Functions, paid APIs, or a payment gateway. SMS phone authentication is intentionally not enabled: Firebase phone OTP requires Blaze billing and per-SMS charges, which this Spark-only setup does not authorize.
- Add product documents to `products` with `name`, `description`, `categoryId`, `price`, `stock`, and `active` fields. Optional fields include `discountPrice`, `colors`, `variants`, `imageUrl`, and `popularity`.
- Product `categoryId` values are `scrunchies` and `hair-clips`; ready-made hampers are stored separately in `hampers`. Kurtis is not shown on customer-facing pages.
- Admins can create, edit, publish, hide, and remove product and ready-made hamper records. The stock field on each record is the manually maintained inventory count; the app does not decrement or reserve it automatically.
- Customers can edit their Firebase Auth display name and see only their own orders. Order status changes appear through a customer-scoped Firestore listener.
- The admin dashboard checks the signed-in UID against `admins`, then listens to orders and payment-reference submissions in real time. “New” means `Order Placed`; “Pending” means not yet delivered or cancelled. It shows counts by status, in-dashboard new-order notices, customer/delivery details, and status/payment controls. The live orders listener reads the order collection while the dashboard is open; monitor Firestore Spark read quotas as order volume grows.
- Store the UPI ID as `settings/upiId` with a `value` field. Configure optional builder packaging and card choices in `settings/hamperBuilder`.
- Configure a flat non-negative `shippingCharge` in `settings/storefront` before enabling UPI at checkout. If shipping is unset, UPI remains unavailable and COD orders are clearly presented as an estimated subtotal.
- `storage.rules` is provided for a future Storage setup, but the app does not initialize Firebase Storage or upload files. Firebase Storage availability can depend on project and billing requirements; do not enable billing for this project. Product images can be served as static files or another owner-configured public URL.

## Brand assets and store details

The header and homepage hero use the owner-provided logo at `logo/logo .jpeg`. Keep this asset in place; Vite bundles it into the production build.

Business email, WhatsApp, Instagram profile, delivery timelines, return terms, and legal policy content are intentionally not invented. Add these details before accepting real orders.

## Checkout and payment boundary

Checkout requires a signed-in customer and writes an order request to Firestore. Guest carts live in local storage; customer carts and wishlists sync to Firestore after sign-in. Manual UPI references are stored as unverified submissions. COD orders remain pending. Card payments are not collected.

Firestore Rules restrict customers to creating a new order request for their own UID with an allowed payment method, initial pending statuses, a matching order ID, a valid delivery-address shape, and a consistent subtotal/shipping/total sum. Customers cannot update or delete orders; only an admin can change the permitted order and payment status fields. A customer-submitted UPI reference is never proof of payment and cannot set payment status to `Paid`.

This is still a Spark-only client app with no trusted server-side code. Firestore Rules cannot authoritatively reprice every nested custom hamper, verify current stock, atomically reserve inventory, or validate shipping fees from trusted configuration during order creation. Treat every customer order as an unconfirmed request: the admin must independently check current catalog prices, stock, shipping, recipient details, and final amount before confirming it. Verify UPI payments against the store's bank or UPI account before manually selecting `Paid`. Cancellation/refund handling is manual; do not request a UPI PIN, OTP, card number, or CVV.

There is no coupon application, customer review UI, saved-address manager, contact form, newsletter subscription, Instagram gallery, product image uploader, or category-management UI in this delivery.

## Build checks

- `npm run build`
- `npm audit`
