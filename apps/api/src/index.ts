import { env } from "./env.js";
import { buildServer } from "./server.js";

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
