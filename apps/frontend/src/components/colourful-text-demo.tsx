"use client";
import React from "react";
import ColourfulText from "@/components/ui/colourful-text";
import { motion } from "motion/react";
import dashboardImage from "../assets/dashboard.png";

export default function ColourfulTextDemo() {
  return (
    <div className="h-screen w-full flex items-center justify-center relative overflow-hidden bg-black">
      <motion.img
        src="https://assets.aceternity.com/linear-demo.webp"
        // src={dashboardImage}
        alt=""
        className="h-full w-full object-cover absolute inset-0 [mask-image:radial-gradient(circle,transparent,black_80%)] pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.5 }}
        transition={{ duration: 1 }}
      />
      <h1 className="relative z-2 px-4 text-center font-sans text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl md:text-5xl lg:text-6xl xl:text-7xl">
        Welcome back,{" "}
        <span className="inline-block whitespace-nowrap">
          <ColourfulText text="Trader" />
        </span>
        .
      </h1>
    </div>
  );
}
