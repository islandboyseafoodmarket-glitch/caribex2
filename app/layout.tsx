import "./globals.css";
import type { Metadata } from "next";
import React from "react";
import { I18nProvider } from "../lib/I18nProvider";

export const metadata: Metadata = {
  title: "Caribex",
  description: "Plataforma logística Caribex",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
          integrity="sha512-dymI7W1JdV7pXhC2LkZqKqRR3YKHyCuXapnwYfJOLLm1Aun1vDLzA94ppIqhXXap5bVL+0vC8e7bqXjQdC9Jkw=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
