const express = require("express");
const cors = require("cors");
require("dotenv").config();

const googleRoutes = require("./routes/google");
const appointmentRoutes = require("./routes/appointments");
const patientRoutes = require("./routes/patients");
const doctorRoutes = require("./routes/doctors");
const aiRoutes = require("./routes/ai");
const calendarRoutes = require("./routes/calendar");
const notificationRoutes = require("./routes/notifications");
const toolsRoutes = require("./routes/tools");
const dashboardRoutes = require("./routes/dashboard");
const app = express();
const whatsappRoutes = require("./routes/whatsapp");
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "Clinic AI Backend is running"
    });
});

// Appointment routes
app.use("/api/appointments", appointmentRoutes);

// Patient routes
app.use("/api/patients", patientRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/whatsapp", whatsappRoutes);

// Google OAuth routes
app.use("/", googleRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});