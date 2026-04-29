import express from "express";
import cors from "cors";
import { createServer } from "http";
import { setupWS } from "./ws";

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.send({ status: "ok", timestamp: new Date() });
});

const server = createServer(app);

setupWS(server);

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log(`WebSocket server is attached to the same port`);
});
