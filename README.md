# StreamSphere — Task 3: Subscription Management

A full-stack subscription management module extending the Task 2 Controlled Downloads system.

## Included
- Free, Bronze, Silver and Gold plans
- Pricing, validity and feature display
- Current subscription status and expiry
- Subscription history stored in MongoDB
- Upgrade/change plan flow
- Cancel subscription and return to Free
- Automatic expired paid plan fallback to Free
- Existing user/download history preserved
- Server-side connection between active plan and download quota
- Razorpay Test Mode integration when test keys are configured
- Demo activation for local testing without real payment
- JWT-protected subscription APIs

## Plans
| Plan | Price | Validity | Downloads/day |
|---|---:|---|---:|
| Free | ₹0 | No expiry | 1 |
| Bronze | ₹99 | 30 days | 5 |
| Silver | ₹199 | 30 days | 10 |
| Gold | ₹299 | 30 days | 20 |

## Run backend
```powershell
cd backend
npm install
copy .env.example .env
npm start
```
MongoDB must be running locally.

## Run frontend
```powershell
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Razorpay Test Mode
Add your Razorpay TEST credentials to `backend/.env`:
- `RAZORPAY_KEY_ID=rzp_test_...`
- `RAZORPAY_KEY_SECRET=...`

If keys are not configured, use **Demo activate** to test the complete subscription/expiry/quota workflow locally without charging money.

## Task 2 compatibility
The existing Controlled Downloads APIs remain available. Subscription APIs are mounted under `/api/subscriptions`, while `/api/downloads` continues to enforce the active plan's daily quota.
