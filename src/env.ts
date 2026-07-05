import path from "node:path";
import { config as loadDotenv } from "dotenv";

const ENV_FILE_NAMES = [".env.local", ".env"];

export function loadEnvFiles(): void {
    for (const fileName of ENV_FILE_NAMES) {
        loadDotenv({
            path: path.join(process.cwd(), fileName),
            quiet: true,
        });
    }
}
