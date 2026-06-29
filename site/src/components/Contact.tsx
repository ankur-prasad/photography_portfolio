import { motion } from "framer-motion";

export default function Contact() {
  return (
    <>
      <section className="contact" id="contact">
        <div className="container">
          <motion.p
            className="contact-kicker"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            Have a project — or a photo that deserves a third dimension?
          </motion.p>
          <motion.a
            className="contact-mail"
            href="mailto:prasadankur11@gmail.com"
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            prasadankur11@gmail.com
          </motion.a>
        </div>
      </section>
      <footer className="footer">
        <span>© {new Date().getFullYear()} Ankur Prasad</span>
        <span>Munich, Germany</span>
        <span>Designed & engineered by me — that's the point</span>
      </footer>
    </>
  );
}
