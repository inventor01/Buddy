import React from "react";
import { motion } from "framer-motion";

// One big, soft, rounded card per step — slides in from the right like
// you're handing it over. Cream background, gentle shadow, lots of air.
export default function StepCard({ stepKey, className = "", children }) {
  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, x: 56, scale: 0.985 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ duration: 0.38, ease: "easeOut" }}
      className={`relative rounded-[28px] border border-hairline bg-white p-7 sm:p-11 ${className}`}
      style={{ boxShadow: "0 26px 60px -30px rgba(60,45,25,.25)" }}
    >
      {children}
    </motion.div>
  );
}