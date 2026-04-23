import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/Student-Trips-SA/",
  server: {
    port: 5174
  }
});
