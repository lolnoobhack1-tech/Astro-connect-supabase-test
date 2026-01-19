import { Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const Hero = () => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-secondary via-background to-muted">
      <div className="absolute inset-0 bg-[url('/src/assets/hero-bg.jpg')] bg-cover bg-center opacity-10" />
      
      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="animate-fade-in">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Vedic Astrology Powered</span>
          </div>
          
          <h1 className="font-display text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Find Your Perfect Match
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Discover meaningful connections guided by the stars. Our AI-powered kundli matching helps you find compatibility that goes beyond the surface.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/auth">
              <Button size="lg" className="text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all">
                <Heart className="w-5 h-5 mr-2" />
                Start Your Journey
              </Button>
            </Link>
            
            <Link to="/auth">
              <Button variant="outline" size="lg" className="text-lg px-8 py-6 rounded-full">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto animate-slide-up">
          <div className="p-6 rounded-2xl bg-card/50 backdrop-blur border border-border/50 shadow-subtle">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">AI Kundli Generation</h3>
            <p className="text-muted-foreground text-sm">
              Advanced Vedic astrology analysis powered by AI
            </p>
          </div>
          
          <div className="p-6 rounded-2xl bg-card/50 backdrop-blur border border-border/50 shadow-subtle">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
              <Heart className="w-6 h-6 text-accent" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Smart Matching</h3>
            <p className="text-muted-foreground text-sm">
              Find compatible partners based on astrological harmony
            </p>
          </div>
          
          <div className="p-6 rounded-2xl bg-card/50 backdrop-blur border border-border/50 shadow-subtle">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2">Easy Discovery</h3>
            <p className="text-muted-foreground text-sm">
              Swipe through curated matches with compatibility scores
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
