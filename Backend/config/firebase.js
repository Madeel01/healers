
const {
  initializeApp,
  getApps,
  cert,
} = require("firebase-admin/app");

const {
  getMessaging,
} = require("firebase-admin/messaging");

const serviceAccount = require("./healers-f4939-firebase-adminsdk-fbsvc-6d3bc7b779.json");

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
}

const messaging = getMessaging();

console.log("Firebase Admin initialized successfully");

module.exports = { messaging };
