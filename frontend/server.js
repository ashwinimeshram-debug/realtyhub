// Passenger entrypoint for cPanel "Setup Node.js App" (production only).
//
// Next.js needs a Node server for SSR / image optimization / rewrites, so it
// cannot be static-exported. cPanel runs apps under Phusion Passenger, which
// exposes the listen port via process.env.PORT (no `next start` / CLI allowed).
const { createServer } = require("http");
const next = require("next");

// Passenger does not set NODE_ENV; force production so `next dev` (on-demand
// compilation + debug logging) is never started on the server.
const dev = false;
process.env.NODE_ENV = "production";

const app = next({ dev });
const handle = app.getRequestHandler();

const port = parseInt(process.env.PORT || process.env.NODE_PORT || "3000", 10);

app.prepare().then(() => {
  createServer((req, res) => {
    handle(req, res);
  }).listen(port, "0.0.0.0", () => {
    console.log(`> Ready on http://0.0.0.0:${port} (Passenger)`);
  });
});
