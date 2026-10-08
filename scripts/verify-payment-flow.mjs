import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (path) => fs.readFileSync(path, 'utf8');
const subscription = read('src/pages/Subscription.tsx');
const billing = read('src/lib/billing.ts');
const admin = read('src/pages/AdminPortal.tsx');
const types = read('src/lib/database.types.ts');
const migration = read('supabase/migrations/202610060001_payment_receipt_approval_flow.sql');
const account = read('src/lib/paymentAccount.ts');

assert.match(account, /Goodshare intercontinental ventures/);
assert.match(account, /Jaiz Bank Plc/);
assert.match(account, /0021748767/);

assert.match(subscription, /id="bizguard-payment-proof-camera"/);
assert.match(subscription, /id="bizguard-payment-proof-gallery"/);
assert.match(subscription, /id="bizguard-payment-proof-file"/);
assert.match(subscription, /capture="environment"/);
assert.match(subscription, /Gallery/);
assert.match(subscription, /File \/ PDF/);
assert.match(subscription, /disabled=\{isLoading \|\| !proof\}/);
assert.match(subscription, /checkPaymentApproval/);
assert.match(subscription, /setInterval\(.*8000/);
assert.match(subscription, /submittingPaymentRef/);
assert.match(subscription, /approvalCheckRef/);
assert.match(subscription, /getPendingPaymentRequest/);
assert.match(subscription, /setPaymentStage\('submitted'\)/);

assert.match(billing, /supabase\.storage\.from\('bizguard-captures'\)\.upload/);
assert.match(billing, /getPendingPaymentRequest/);
assert.match(billing, /supabase\.rpc\('create_payment_request'/);
assert.match(billing, /getPendingPaymentRequest\(input\.businessId, input\.userId\)/);
assert.match(billing, /Payment request could not be created:/);
assert.doesNotMatch(billing, /from\('payment_requests'\)\.insert/);

assert.match(admin, /admin_list_payment_requests/);
assert.match(admin, /admin_review_payment_request/);
assert.match(admin, /createSignedUrl/);
assert.match(admin, /user_name/);
assert.match(admin, /business_name/);

assert.match(migration, /create policy bizguard_captures_admin_select/);
assert.match(migration, /create or replace function public\.create_payment_request/);
assert.match(migration, /pg_advisory_xact_lock/);
assert.match(migration, /a payment request is already awaiting admin approval/);
assert.match(migration, /payment amount does not match the selected plan/);
assert.match(migration, /payment proof is required before approval/);
assert.match(migration, /create or replace function public\.admin_review_payment_request/);
assert.match(migration, /is_current_user_super_admin\(\)/);
assert.match(migration, /business_subscriptions/);
assert.match(migration, /status = 'active'/);

assert.match(types, /create_payment_request:/);
assert.match(types, /admin_list_payment_requests:/);

console.log('PASS: payment flow static verification');
console.log('PASS: payment account preserved');
console.log('PASS: receipt upload + server-authoritative request creation');
console.log('PASS: admin proof visibility + approval path');
console.log('PASS: automatic approval polling + duplicate guards');
console.log('PASS: database approval hardening');
