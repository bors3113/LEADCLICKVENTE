import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Session-mode pooler for migrations / db pull (supports DDL + prepared statements)
    url: process.env["DIRECT_URL"],
  },
});
