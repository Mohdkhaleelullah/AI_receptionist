const express = require("express");
const router = express.Router();

router.post("/test", async (req, res) => {
    console.log("🔔 APPOINTMENT REMINDER");
    console.log(req.body);

    res.json({
        success: true,
        message: "Reminder triggered successfully."
    });
});

module.exports = router;