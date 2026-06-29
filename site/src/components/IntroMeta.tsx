import { motion } from "framer-motion";

export default function IntroMeta() {
  return (
    <motion.div
      className="intro-meta"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.9 }}
    >
      <span>Est. 2016</span>
      <span>1,500+ frames curated to 85</span>
      <span>Alps · NYC · Southwest · Canaries · India</span>
    </motion.div>
  );
}
