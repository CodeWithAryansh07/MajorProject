"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  
  // Hide footer on collaboration session pages, files page, and collaboration main page
  const shouldHideFooter = 
    (pathname.startsWith("/collaboration/") && pathname.split("/").length === 3) ||
    pathname === "/files" ||
    pathname === "/collaboration";
  
  if (shouldHideFooter) {
    return null;
  }
  
  return <Footer />;
}