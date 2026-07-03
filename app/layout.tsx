import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenBook - AI Research Notebook",
  description:
    "An AI-powered research notebook. Upload documents, ask questions, and get source-grounded answers — a NotebookLM clone.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="h-screen overflow-hidden antialiased">{children}</body>
    </html>
  );
}
