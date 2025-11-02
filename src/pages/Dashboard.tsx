import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { 
  Package, 
  Users, 
  ClipboardList, 
  Warehouse, 
  Loader2,
  Settings,
  UserCog,
  Beaker,
  Contact,
  Wrench
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
      icon: Beaker,
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
    {
      title: "Vendor Contacts",
      description: "Manage vendor relationships",
      icon: Contact,
      path: "/vendor-contacts",
      roles: ["admin", "inventory"],
    },
    {
      title: "Services",
      description: "Manage service providers",
      icon: Wrench,
      path: "/services",
      roles: ["admin", "inventory"],
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
    <Layout>
      <div className="p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Welcome Section */}
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Welcome back, {user.name || user.email || "User"}
            </p>
          </div>

          {/* Quick Actions */}
          <section>
            <h2 className="text-xl font-bold tracking-tight mb-6">Quick Actions</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </div>
    </Layout>
  );
}