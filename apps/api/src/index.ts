import * as Sentry from "@sentry/node";
import { env } from "./env.js";
import { buildServer } from "./server.js";

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.ENVIRONMENT,
    tracesSampleRate: 1.0,
  });
}

const app = buildServer();

app
  .listen({ port: env.PORT, host: env.HOST })
  .then(() => {
    app.log.info(`JobCCQ API prête sur http://${env.HOST}:${env.PORT}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
