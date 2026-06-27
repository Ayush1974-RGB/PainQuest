// server.js — Custom Node.js server that boots Next.js + Socket.IO together.
// Run: npm run dev (development) | npm run start (production)

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST ?? "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

// Register TypeScript support for the socket server module
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: {
    module: "commonjs",
    moduleResolution: "node",
    esModuleInterop: true,
    paths: { "@/*": ["./src/*"] },
    baseUrl: ".",
  },
});
require("tsconfig-paths").register({
  baseUrl: ".",
  paths: { "@/*": ["./src/*"] },
});

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Attach Socket.IO to the HTTP server
  const { initSocketServer } = require("./src/lib/socketServer");
  initSocketServer(httpServer);

  httpServer.listen(port, hostname, () => {
    console.log(
      `▶ Ready on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port} (${dev ? "dev" : "production"})`
    );
  });
});
