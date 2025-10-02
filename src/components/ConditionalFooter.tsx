"use client";

import { usePathname } from "next/navigation";
import Footer from "./Footer";

export default function ConditionalFooter() {
  const pathname = usePathname();
  
  // Hide footer on collaboration session pages
  const shouldHideFooter = pathname.startsWith("/collaboration/") && pathname.split("/").length === 3;
  
  if (shouldHideFooter) {
    return null;
  }
  
  return <Footer />;
}