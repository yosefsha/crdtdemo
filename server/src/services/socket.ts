// Socket.IO setup for Express server (TypeScript)
import { Server } from "socket.io";
import { Server as HttpServer } from "http";

let io: Server | undefined;
export function setupSocket(server: HttpServer) {
  io = new Server(server, {
    path: "/socket", // ⬅️ ADD THIS LINE
    cors: {
      origin: [
        process.env.CLIENT_ORIGIN || "http://localhost:3000",
        "http://localhost",
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
}

export function emitEnrichmentResult(
  requestId: string,
  enrichedData: any,
  socketId?: string
) {
  if (io) {
    if (socketId) {
      io.to(socketId).emit("enrichment-result", { requestId, enrichedData });
    } else {
      io.emit("enrichment-result", { requestId, enrichedData });
    }
  }
}
