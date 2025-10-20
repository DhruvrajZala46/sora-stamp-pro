import { Card } from "@/components/ui/card";

const BeforeAfterDemo = () => {
  return (
    <section className="relative z-10 w-full max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <div className="text-center space-y-3 sm:space-y-4 mb-8 sm:mb-12">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold">See the Magic</h2>
        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
          Watch how SoraStamp transforms your videos with authentic watermarks
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-12">
        {/* Before Video */}
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
              <span className="px-4 py-1.5 bg-muted/90 backdrop-blur-sm rounded-full text-sm font-medium border border-border">
                Before
              </span>
            </div>
            <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-2 border-border/50 hover:border-primary/50 transition-all duration-300">
              <div className="aspect-[9/16] bg-muted/20 flex items-center justify-center relative group">
                <video
                  id="before-video"
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                  loop
                  preload="metadata"
                  poster="/placeholder.svg"
                  aria-label="Before video preview"
                >
                  <source src="/videos/before.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </Card>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Your original video without watermark
          </p>
        </div>

        {/* After Video */}
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
              <span className="px-4 py-1.5 bg-primary/90 backdrop-blur-sm rounded-full text-sm font-medium border border-primary text-primary-foreground">
                After
              </span>
            </div>
            <Card className="overflow-hidden bg-card/50 backdrop-blur-sm border-2 border-primary/50 hover:border-primary transition-all duration-300 shadow-[0_0_30px_rgba(var(--primary),0.15)]">
              <div className="aspect-[9/16] bg-muted/20 flex items-center justify-center relative group">
                <video
                  id="after-video"
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                  autoPlay
                  loop
                  preload="metadata"
                  poster="/placeholder.svg"
                  aria-label="After video preview"
                >
                  <source src="/videos/after.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>
            </Card>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            With authentic SORA watermark applied
          </p>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center space-y-2 p-6 rounded-lg bg-card/30 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all">
          <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h3 className="font-semibold">Lightning Fast</h3>
          <p className="text-sm text-muted-foreground">
            Process videos in seconds
          </p>
        </div>

        <div className="text-center space-y-2 p-6 rounded-lg bg-card/30 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all">
          <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h3 className="font-semibold">Authentic Watermarks</h3>
          <p className="text-sm text-muted-foreground">
            Hyperreal motion effects
          </p>
        </div>

        <div className="text-center space-y-2 p-6 rounded-lg bg-card/30 backdrop-blur-sm border border-border/50 hover:border-primary/50 transition-all">
          <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <svg
              className="w-6 h-6 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <h3 className="font-semibold">Mobile Optimized</h3>
          <p className="text-sm text-muted-foreground">
            Perfect for 9:16 content
          </p>
        </div>
      </div>
    </section>
  );
};

export default BeforeAfterDemo;
