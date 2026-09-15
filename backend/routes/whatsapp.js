const express = require("express");

const router = express.Router();

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// ==========================================
// META WEBHOOK VERIFICATION
// ==========================================
router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  console.log("WhatsApp webhook verification request");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WhatsApp webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("WhatsApp webhook verification failed");
  return res.sendStatus(403);
});

// ==========================================
// RECEIVE WHATSAPP MESSAGES
// ==========================================
router.post("/webhook", (req, res) => {
  console.log("\n========== WHATSAPP WEBHOOK ==========");
  console.log(JSON.stringify(req.body, null, 2));
  console.log("======================================\n");

  try {
    const entry = req.body?.entry || [];

    for (const item of entry) {
      const changes = item.changes || [];

      for (const change of changes) {
        const value = change.value;

        if (!value) continue;

        const messages = value.messages || [];

        for (const message of messages) {
          const from = message.from;
          const messageType = message.type;

          let text = "";

          if (messageType === "text") {
            text = message.text?.body || "";
          }

          console.log("From:", from);
          console.log("Message type:", messageType);
          console.log("Message:", text);
        }
      }
    }

    // Tell Meta we received the webhook
    return res.sendStatus(200);

  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return res.sendStatus(200);
  }
});

module.exports = router;