import { useAuth } from "@/hooks/use-auth";
import { LogoDropdown } from "@/components/LogoDropdown";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Home,
  Users,
  ClipboardList,
  Warehouse,
  Contact,
  Wrench,
  Scissors,
  Settings,
  UserCog,
  LogOut,
  ChevronDown,
  Beaker,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { ReactNode } from "react";

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  title: string;
  icon: typeof Home;
  path: string;
  roles?: string[];
  subItems?: {
    title: string;
    path: string;
  }[];
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Define navigation items with role-based visibility
  const coreOperations: NavItem[] = [
    {
      title: "Dashboard",
      icon: Home,
      path: "/dashboard",
    },
    {
      title: "Research",
      icon: Beaker,
      path: "/research",
      roles: ["admin", "research_development"],
    },
    {
      title: "Clients",
      icon: Users,
      path: "/clients",
      roles: ["admin", "operations"],
    },
    {
      title: "Assignments",
      icon: ClipboardList,
      path: "/assignments",
      roles: ["admin", "operations"],
    },
  ];

  const inventorySection: NavItem[] = [
    {
      title: "Inventory",
      icon: Warehouse,
      path: "/inventory",
      roles: ["admin", "inventory", "operations", "research_development"],
      subItems: [
        { title: "Processing Jobs", path: "/inventory/processing-jobs" },
        { title: "Bill Records", path: "/inventory/bill-records" },
      ],
    },
    {
      title: "Vendor Contacts",
      icon: Contact,
      path: "/vendor-contacts",
      roles: ["admin", "inventory"],
    },
    {
      title: "Services",
      icon: Wrench,
      path: "/services",
      roles: ["admin", "inventory"],
    },
  ];

  const specializedTools: NavItem[] = [
    {
      title: "Laser Files",
      icon: Scissors,
      path: "/laser-files",
      roles: ["admin", "laser_operator"],
    },
  ];

  const adminSection: NavItem[] = [
    {
      title: "Admin Zone",
      icon: Settings,
      path: "/admin-zone",
      roles: ["admin"],
    },
    {
      title: "User Management",
      icon: UserCog,
      path: "/user-management",
      roles: ["admin"],
    },
  ];

  // Filter items based on user role
  const filterByRole = (items: NavItem[]) => {
    if (!user?.role) return [];
    return items.filter(
      (item) => !item.roles || item.roles.includes(user.role || "")
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isSubActive = (path: string) => location.pathname.startsWith(path);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b border-border">
            <div className="flex items-center gap-2 px-2 py-2">
              <LogoDropdown />
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight">
                  ScienceUtsav
                </span>
                <span className="text-xs text-muted-foreground">
                  Management System
                </span>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            {/* Core Operations */}
            {filterByRole(coreOperations).length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Operations</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterByRole(coreOperations).map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.path)}
                        >
                          <Link to={item.path}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Inventory Section */}
            {filterByRole(inventorySection).length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Inventory</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterByRole(inventorySection).map((item) => (
                      <SidebarMenuItem key={item.path}>
                        {item.subItems ? (
                          <>
                            <SidebarMenuButton
                              asChild
                              isActive={isSubActive(item.path)}
                            >
                              <Link to={item.path}>
                                <item.icon />
                                <span>{item.title}</span>
                                <ChevronDown className="ml-auto h-4 w-4" />
                              </Link>
                            </SidebarMenuButton>
                            <SidebarMenuSub>
                              {item.subItems.map((subItem) => (
                                <SidebarMenuSubItem key={subItem.path}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={isActive(subItem.path)}
                                  >
                                    <Link to={subItem.path}>
                                      <span>{subItem.title}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </>
                        ) : (
                          <SidebarMenuButton
                            asChild
                            isActive={isActive(item.path)}
                          >
                            <Link to={item.path}>
                              <item.icon />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Specialized Tools */}
            {filterByRole(specializedTools).length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Tools</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterByRole(specializedTools).map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.path)}
                        >
                          <Link to={item.path}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}

            {/* Administration */}
            {filterByRole(adminSection).length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Administration</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterByRole(adminSection).map((item) => (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive(item.path)}
                        >
                          <Link to={item.path}>
                            <item.icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-border">
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {user?.name || user?.email || "User"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user?.email}
                </p>
                {user?.role && (
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {user.role.replace("_", " ")}
                  </Badge>
                )}
              </div>
              <Separator />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger />
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}