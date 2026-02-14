import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import themesRouter from "./routes/themes";
import conversationsRouter from "./routes/conversations";
import audioRouter from "./routes/audio";

dotenv.config();

const app = express();
const server = createServer(app);

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/themes", themesRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/audio", audioRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Audio API ready at http://localhost:${PORT}/api/audio`);
});
