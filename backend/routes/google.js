const express = require("express");
const { google } = require("googleapis");

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Start Google OAuth
router.get("/auth/google", (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: [
            "https://www.googleapis.com/auth/calendar"
        ]
    });

    res.redirect(authUrl);
});

// Google OAuth callback
router.get("/auth/google/callback", async (req, res) => {
    try {
        const { code } = req.query;

        if (!code) {
            return res.status(400).send("Authorization code missing");
        }

        const { tokens } = await oauth2Client.getToken(code);

        console.log("Google connected successfully!");
        console.log("REFRESH TOKEN:", tokens.refresh_token);

        // Temporarily store tokens in memory
        oauth2Client.setCredentials(tokens);

        res.send(`
            <h1>Google Calendar Connected ✅</h1>
            <p>You can close this window.</p>
        `);

    } catch (error) {
        console.error(error);

        res.status(500).send(
            "Google authentication failed"
        );
    }
});

module.exports = router;