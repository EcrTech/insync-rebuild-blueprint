import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import landingBackground from "@/assets/landing-background.png";

const Index = () => {
  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${landingBackground})` }}
    >
      <div className="text-center space-y-6 p-8 max-w-3xl">
        <h1 className="text-6xl font-extrabold text-primary mb-4">
          In-Sync CRM
        </h1>
        <p className="text-2xl text-foreground font-semibold mb-2">
          The CRM that adapts to your chaos
        </p>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
          Powerful, intelligent, and effortlessly simple. Built for growing businesses that value adaptability over rigidity.
        </p>
        <div className="flex gap-4 justify-center">
          <Link to="/signup">
            <Button size="lg" className="bg-primary hover:bg-primary/90">
              Get Started Free
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline">
              Sign In
            </Button>
          </Link>
        </div>
        
        <div className="mt-16 grid md:grid-cols-3 gap-8 text-left">
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Refreshingly Honest</h3>
            <p className="text-sm text-muted-foreground">
              No BS, no fake promises. We tell it like it is.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Intelligently Adaptive</h3>
            <p className="text-sm text-muted-foreground">
              Smart enough to flex, human enough to understand.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-lg">Effortlessly Powerful</h3>
            <p className="text-sm text-muted-foreground">
              Sophisticated tech that feels simple.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
