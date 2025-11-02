import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, CheckCircle2, Loader2, Users } from "lucide-react";
import { useNavigate } from "react-router";

export default function Landing() {
  const { isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const fadeInUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6 }
  };

  const staggerContainer = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <motion.nav 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="border-b border-border"
      >
        <div className="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img src="./logo.svg" alt="ScienceUtsav" className="h-8 w-8" />
            <span className="text-lg font-medium tracking-tight">ScienceUtsav</span>
          </div>
          <Button 
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
            variant="ghost"
            className="font-medium"
          >
            {isAuthenticated ? "Dashboard" : "Sign In"}
          </Button>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section 
        initial="initial"
        animate="animate"
        variants={staggerContainer}
        className="flex-1 flex items-center justify-center px-8 py-32"
      >
        <div className="max-w-4xl mx-auto text-center space-y-12">
          <motion.div variants={fadeInUp} className="space-y-6">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight">
              ScienceUtsav 
              <br />
              Management System
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Streamline your science festival operations with a simple, powerful management system
            </p>
          </motion.div>

          <motion.div variants={fadeInUp}>
            <Button 
              size="lg"
              onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
              className="h-14 px-8 text-base font-medium group"
            >
              {isAuthenticated ? "Go to Dashboard" : "Get Started"}
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="py-32 px-8 border-t border-border"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-16">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              <div className="h-12 w-12 rounded-full bg-foreground flex items-center justify-center">
                <Users className="h-6 w-6 text-background" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">Team Management</h3>
              <p className="text-muted-foreground leading-relaxed">
                Organize participants, volunteers, and staff with ease
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="space-y-4"
            >
              <div className="h-12 w-12 rounded-full bg-foreground flex items-center justify-center">
                <Calendar className="h-6 w-6 text-background" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">Event Scheduling</h3>
              <p className="text-muted-foreground leading-relaxed">
                Plan and coordinate activities across multiple venues
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="space-y-4"
            >
              <div className="h-12 w-12 rounded-full bg-foreground flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-background" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight">Real-time Updates</h3>
              <p className="text-muted-foreground leading-relaxed">
                Stay synchronized with live data and instant notifications
              </p>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="py-32 px-8 border-t border-border"
      >
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-5xl font-bold tracking-tight">
            Ready to get started?
          </h2>
          <p className="text-xl text-muted-foreground">
            Join us in making science festivals more organized and impactful
          </p>
          <Button 
            size="lg"
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/auth")}
            className="h-14 px-8 text-base font-medium group"
          >
            {isAuthenticated ? "Go to Dashboard" : "Create Account"}
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </motion.section>

      {/* Footer */}
      <motion.footer 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="border-t border-border py-8 px-8"
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2024 ScienceUtsav. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built with{" "}
            <a
              href="https://vly.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              vly.ai
            </a>
          </p>
        </div>
      </motion.footer>
    </div>
  );
}