import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogoDropdown } from "@/components/LogoDropdown";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { 
  Package, 
  Users, 
  ClipboardList, 
  Warehouse, 
  Loader2,
  Settings,
  UserCog
} from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function Dashboard() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/auth");
    }
    if (!isLoading && isAuthenticated && user && !user.isApproved) {
      navigate("/pending-approval");
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const quickActions = [
    {
      title: "Research & Kits",
      description: "Manage programs and kit specifications",
      icon: Package,
      path: "/research",
      roles: ["admin", "research_development"],
    },
    {
      title: "Clients",
      description: "Manage client database",
      icon: Users,
      path: "/clients",
      roles: ["admin", "operations"],
    },
    {
      title: "Assignments",
      description: "Track kit assignments",
      icon: ClipboardList,
      path: "/assignments",
      roles: ["admin", "operations"],
    },
    {
      title: "Inventory",
      description: "Manage materials and stock",
      icon: Warehouse,
      path: "/inventory",
      roles: ["admin", "inventory", "operations"],
    },
  ];

  const adminActions = [
    {
      title: "User Management",
      description: "Approve users and manage roles",
      icon: UserCog,
      path: "/user-management",
    },
    {
      title: "Admin Zone",
      description: "System configuration",
      icon: Settings,
      path: "/admin-zone",
    },
  ];

  const filteredActions = quickActions.filter(
    (action) => !action.roles || action.roles.includes(user.role || "")
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-border bg-background"
      >
        <div className="max-w-7xl mx-auto px-8 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LogoDropdown />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Welcome back, {user.name || user.email || "User"}
              </p>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-12"
        >
          {/* Quick Actions */}
          <section>
            <h2 className="text-xl font-bold tracking-tight mb-6">Quick Actions</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredActions.map((action, index) => (
                <motion.div
                  key={action.path}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * (index + 1) }}
                >
                  <Card
                    className="cursor-pointer hover:border-foreground transition-colors"
                    onClick={() => navigate(action.path)}
                  >
                    <CardHeader>
                      <action.icon className="h-8 w-8 mb-2" />
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                      <CardDescription>{action.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Admin Section */}
          {user.role === "admin" && (
            <section>
              <h2 className="text-xl font-bold tracking-tight mb-6">Administration</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {adminActions.map((action, index) => (
                  <motion.div
                    key={action.path}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + 0.1 * index }}
                  >
                    <Card
                      className="cursor-pointer hover:border-foreground transition-colors"
                      onClick={() => navigate(action.path)}
                    >
                      <CardHeader>
                        <action.icon className="h-8 w-8 mb-2" />
                        <CardTitle className="text-lg">{action.title}</CardTitle>
                        <CardDescription>{action.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      </main>
    </div>
  );
}
