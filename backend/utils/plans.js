export const PLANS = {
  Free: {
    dailyLimit: 1,
    price: 0,
    validityDays: null,
    validity: "No expiry",
    features: ["1 download per day", "Basic file access", "Download history"]
  },
  Bronze: {
    dailyLimit: 5,
    price: 99,
    validityDays: 30,
    validity: "30 days",
    features: ["5 downloads per day", "Priority access", "Download history"]
  },
  Silver: {
    dailyLimit: 10,
    price: 199,
    validityDays: 30,
    validity: "30 days",
    features: ["10 downloads per day", "Priority access", "Download history"]
  },
  Gold: {
    dailyLimit: 20,
    price: 299,
    validityDays: 30,
    validity: "30 days",
    features: ["20 downloads per day", "Priority access", "Download history"]
  }
};

export function normalizePlan(user) {
  if (!user || !PLANS[user.plan]) return "Free";
  if (user.plan !== "Free" && user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) <= new Date()) return "Free";
  return user.plan;
}

export function indiaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}
