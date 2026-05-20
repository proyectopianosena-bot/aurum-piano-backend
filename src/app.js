const path = require("path");
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const contactoRoutes = require("./routes/contacto");
const authRoutes     = require("./routes/auth");
const clasesRoutes   = require("./routes/clases");
const reservasRoutes = require("./routes/reservas");
const adminRoutes    = require("./routes/admin");
const paginaRoutes   = require("./routes/pagina");

const app = express();

app.use(cors());
app.use(express.json({ limit: "60mb" }));

// Servir archivos subidos (videos, imágenes del hero)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => res.send("Aurum Piano Academy API 🎹"));

app.use("/api/contacto", contactoRoutes);
app.use("/api/auth",     authRoutes);
app.use("/api/clases",   clasesRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/admin",    adminRoutes);
app.use("/api/pagina",   paginaRoutes);

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, () => console.log(`✅ Servidor corriendo en puerto ${PORT}`));
