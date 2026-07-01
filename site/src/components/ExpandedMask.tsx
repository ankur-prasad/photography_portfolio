import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ExpandedMaskProps {
  onPillarClick?: (pillarKey: string) => void;
}

const PILLARS_MASK = [
  {
    key: "dark",
    no: "01",
    title: "Night",
    blurb: "Astro, light trails, the moon — the hours most cameras sleep.",
    image: "/web/20160503_164015.jpg",
  },
  {
    key: "long",
    no: "02",
    title: "Nature",
    blurb: "Distance rendered as haze — ridgelines, canyons, the scale of land.",
    image: "/web/ANK09879.jpg",
  },
  {
    key: "hard",
    no: "03",
    title: "City",
    blurb: "Cities and structure — glass, grids and deliberate geometry.",
    image: "/web/ANK08837.jpg",
  },
  {
    key: "far",
    no: "04",
    title: "Travel",
    blurb: "Places worth the journey — ruins, landmarks and far horizons.",
    image: "/web/ANK03010.jpg",
  },
  {
    key: "speed",
    no: "05",
    title: "Motion",
    blurb: "Machines, roads and motion held still for a thousandth of a second.",
    image: "/web/ANK07684.jpg",
  },
];

export default function ExpandedMask({ onPillarClick }: ExpandedMaskProps) {
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const handleResize = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    handleResize(mediaQuery);
    mediaQuery.addEventListener("change", handleResize);
    return () => mediaQuery.removeEventListener("change", handleResize);
  }, []);

  return (
    <div className={`expanded-mask-container ${isMobile ? "mobile" : "desktop"}`}>
      <div className="expanded-mask">
        {PILLARS_MASK.map((pillar, idx) => {
          const isExpanded = idx === expandedIndex;
          const isHovered = idx === hoveredIndex;
          
          // Animate width (horizontal) or height (vertical)
          const baseSize = isExpanded ? 50 : 12.5; // percentage-based approximate layout weight
          let animateValue = baseSize;
          if (isHovered && !isExpanded) {
            animateValue += 3; // slight expand on hover
          } else if (hoveredIndex !== null && hoveredIndex !== idx && !isExpanded) {
            animateValue -= 0.75; // slight shrink on other items to balance
          }

          return (
            <motion.div
              key={pillar.key}
              className={`expanded-mask__panel ${isExpanded ? "expanded" : "collapsed"}`}
              onClick={() => {
                if (!isExpanded) {
                  setExpandedIndex(idx);
                }
              }}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              animate={{
                flexGrow: isExpanded ? 12 : 2,
                flexBasis: `${animateValue}%`,
              }}
              transition={{
                type: "spring",
                stiffness: 120,
                damping: 20,
              }}
            >
              <img
                src={pillar.image}
                alt={pillar.title}
                className="expanded-mask__panel-bg"
              />
              <div className="expanded-mask__panel-overlay" />
              
              <div className="expanded-mask__panel-content">
                <div className="expanded-mask__panel-meta">
                  <span className="expanded-mask__panel-no">{pillar.no}</span>
                  <h3 className="expanded-mask__panel-title">{pillar.title}</h3>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      className="expanded-mask__panel-details"
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.3, delay: 0.1 }}
                    >
                      <p className="expanded-mask__panel-blurb">{pillar.blurb}</p>
                      <button
                        className="expanded-mask__panel-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onPillarClick) {
                            onPillarClick(pillar.key);
                          }
                        }}
                      >
                        View Gallery <span>→</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!isExpanded && (
                <div className="expanded-mask__panel-vertical-title">
                  <span className="no">{pillar.no}</span>
                  <span className="title">{pillar.title}</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
