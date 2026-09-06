import { reportToSentry } from "@jobccq/shared";
import { env } from "./env.js";
import { buildServer } from "./server.js";

const app = buildServer();

process.on("unhandledRejection", (reason) => {
  void reportToSentry(process.env.SENTRY_DSN, reason, { app: "api", extra: { kind: "unhandledRejection" } });
});
process.on("uncaughtException", (err) => {
  void reportToSentry(process.env.SENTRY_DSN, err, { app: "api", extra: { kind: "uncaughtException" } });
});

app
  .listen({ port: env.PORT, host: env.HOST })
  .then(() => {
    app.log.info(`JobCCQ API prête sur http://${env.HOST}:${env.PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
