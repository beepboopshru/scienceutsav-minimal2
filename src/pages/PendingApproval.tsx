import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Clock, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function PendingApproval() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user?.isApproved) {
      navigate("/dashboard");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl">Approval Pending</CardTitle>
            <CardDescription>
              Your account is awaiting administrator approval
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground text-center">
              An administrator will review your account shortly. You'll receive access once approved.
            </p>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/")}
              >
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
