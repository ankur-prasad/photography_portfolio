/**
 * Static first paint for the home hero, shown while the 3D camera chunk loads.
 * Mirrors the initial camera frame (viewfinder photo + hero copy) so the upgrade
 * to interactive 3D is seamless. Reuses the .act-hero / .camera-veil styles.
 */
export default function HeroPoster() {
  return (
    <section className="hero-poster">
      <video
        className="hero-poster-img"
        src="/viewfinder/can_we_make_this_into_a_loopab.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <div className="camera-veil" />
      <div className="act-hero" style={{ opacity: 1 }}>
        <div className="container">
          <p className="act-hero-kicker">Photographer × AI Engineer — Munich</p>
          <h1 className="act-hero-title" aria-label="Ankur Prasad">
            <span className="line">Ankur</span>
            <span className="line">Prasad</span>
          </h1>
          <p className="act-hero-sub">
            I notice what the eye would miss — and freeze it into a single frame.
          </p>
        </div>
      </div>
    </section>
  );
}
