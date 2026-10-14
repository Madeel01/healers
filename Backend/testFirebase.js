
const {
  initializeApp,
  cert,
} = require("firebase-admin/app");

const fs = require("fs");

const serviceAccount = require("./config/healers-f4939-firebase-adminsdk-fbsvc-6d3bc7b779.json");

const app = initializeApp({
  credential: cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

async function testFirebase() {
  try {
    const accessToken =
      await app.options.credential.getAccessToken();

    console.log("Firebase authentication successful");
    console.log("Access token received:", Boolean(accessToken.access_token));
    console.log("Project ID:", serviceAccount.project_id);
  } catch (error) {
    console.error("Firebase authentication failed:", error.message);
  }
}

testFirebase();
