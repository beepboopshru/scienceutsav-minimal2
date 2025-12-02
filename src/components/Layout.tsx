import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
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
  TrendingUp,
  MessageSquare,
  X,
  Send,
  Trash2,
  Package,
  FileText,
  AlertTriangle,
  Moon,
  Sun,
  Truck,
  Bell,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { ReactNode, useState, useEffect, useRef } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";

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

const CHAT_STORAGE_KEY = "science_utsav_chat_history";
const CHAT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface StoredChat {
  messages: ChatMessage[];
  timestamp: number;
}

export function Layout({ children }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const sendChat = useAction(api.ai.chat);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("dark-mode");
    return saved === "true" || document.documentElement.classList.contains("dark");
  });

  const unreadCount = useQuery(api.notifications.getUnreadCount);
  const notifications = useQuery(api.notifications.list);
  const markAsRead = useMutation(api.notifications.markAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Apply dark mode on mount and when toggled
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("dark-mode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("dark-mode", "false");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Apply saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("app-theme");
    if (savedTheme && savedTheme !== "none") {
      const body = document.body;
      
      // Theme backgrounds mapping
      const THEME_BACKGROUNDS: Record<string, string> = {
        "red-waves": "https://harmless-tapir-303.convex.cloud/api/storage/af314735-18df-40da-8c8e-af7f4d842a60",
        "blue-gray-waves": "https://harmless-tapir-303.convex.cloud/api/storage/55c9d3f2-daac-49d3-af51-d997afcf208e",
        "soft-gradient": "https://harmless-tapir-303.convex.cloud/api/storage/a85d5ab9-8a94-4f64-8f3a-c2c5a666582d",
        "teal-triangles": "https://harmless-tapir-303.convex.cloud/api/storage/acb39d1b-2144-4355-9ac0-8b2a2857e835",
        "concentric-circles": "https://harmless-tapir-303.convex.cloud/api/storage/3f699957-39ba-4a86-892a-981722f9fa22",
        "pastel-waves": "https://harmless-tapir-303.convex.cloud/api/storage/1bd70797-e73d-46d9-8d0f-8a2267170c37",
        "particle-network": "https://harmless-tapir-303.convex.cloud/api/storage/66276a20-15f9-4412-8968-e465fa67f820",
        "fractal-art": "https://harmless-tapir-303.convex.cloud/api/storage/72193311-61fe-44e8-a036-29913ee1b974",
        "pink-waves": "https://harmless-tapir-303.convex.cloud/api/storage/7d7544db-a3e3-4bdd-93c3-e6758f729a47",
        "tech-network": "https://harmless-tapir-303.convex.cloud/api/storage/5c15cacf-d936-4569-9187-d2cd6ee0fdbb",
        "watercolor": "https://harmless-tapir-303.convex.cloud/api/storage/7e598922-2012-4012-bc7c-01c2250d8edd",
        "purple-silk": "https://harmless-tapir-303.convex.cloud/api/storage/b33f2f32-0c0d-4125-8f53-7b32f239d104",
        "dreamy-bokeh": "https://harmless-tapir-303.convex.cloud/api/storage/3cdf4fdb-6a5c-4191-bce4-5deb995719ee",
      };

      const themeUrl = THEME_BACKGROUNDS[savedTheme];
      if (themeUrl) {
        body.style.backgroundImage = `url(${themeUrl})`;
        body.style.backgroundSize = "cover";
        body.style.backgroundPosition = "center";
        body.style.backgroundAttachment = "fixed";
        body.style.backgroundRepeat = "no-repeat";

        // Add blur overlay
        let overlay = document.getElementById("theme-blur-overlay");
        if (!overlay) {
          overlay = document.createElement("div");
          overlay.id = "theme-blur-overlay";
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            backdrop-filter: blur(80px);
            -webkit-backdrop-filter: blur(80px);
            pointer-events: none;
            z-index: -1;
          `;
          body.appendChild(overlay);
        }
      }
    }
  }, []);

  // Load chat history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed: StoredChat = JSON.parse(stored);
        const now = Date.now();
        
        // Check if chat has expired (older than 24 hours)
        if (now - parsed.timestamp < CHAT_EXPIRY_MS) {
          setMessages(parsed.messages);
        } else {
          // Clear expired chat
          localStorage.removeItem(CHAT_STORAGE_KEY);
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }, []);

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        const toStore: StoredChat = {
          messages,
          timestamp: Date.now(),
        };
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toStore));
      } catch (error) {
        console.error("Error saving chat history:", error);
      }
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: inputMessage.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsLoading(true);

    try {
      const result = await sendChat({
        messages: [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      if (result.success && result.response) {
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: result.response,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        toast.error(result.error || "Failed to get AI response");
        // Remove the user message if AI failed
        setMessages((prev) => prev.slice(0, -1));
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message. Please try again.");
      // Remove the user message if request failed
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    toast.success("Chat history cleared");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Define navigation items with permission-based visibility
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
      roles: [hasPermission("programs", "view") ? "allowed" : ""],
    },
    {
      title: "Clients",
      icon: Users,
      path: "/clients",
      roles: [hasPermission("clients", "view") ? "allowed" : ""],
      subItems: [
        { title: "B2B Clients", path: "/clients" },
        { title: "B2C Clients", path: "/b2c-clients" },
      ],
    },
    {
      title: "Assignments",
      icon: ClipboardList,
      path: "/b2b-assignments",
      roles: [hasPermission("assignments", "view") ? "allowed" : ""],
      subItems: [
        { title: "B2B Assignments", path: "/b2b-assignments" },
        { title: "B2C Assignments", path: "/b2c-assignments" },
      ],
    },
  ];

  const packingDispatchSection: NavItem[] = [
    {
      title: "Packing",
      icon: Package,
      path: "/packing",
      roles: [hasPermission("packing", "view") ? "allowed" : ""],
    },
    {
      title: "Dispatch",
      icon: Truck,
      path: "/dispatch",
      roles: [hasPermission("dispatch", "view") ? "allowed" : ""],
    },
    {
      title: "Discrepancy Tickets",
      icon: AlertTriangle,
      path: "/discrepancy-tickets",
      roles: [hasPermission("discrepancyTickets", "view") ? "allowed" : ""],
    },
  ];

  const inventorySection: NavItem[] = [
    {
      title: "Inventory",
      icon: Warehouse,
      path: "/inventory",
      roles: [hasPermission("inventory", "view") ? "allowed" : ""],
    },
    {
      title: "Procurement Jobs",
      icon: TrendingUp,
      path: "/procurement",
      roles: [hasPermission("inventory", "view") ? "allowed" : ""],
    },
    {
      title: "Pre-Processing Jobs",
      icon: Package,
      path: "/inventory/processing-jobs",
      roles: [hasPermission("processingJobs", "view") ? "allowed" : ""],
    },
    {
      title: "Sealing Packet Jobs",
      icon: Package,
      path: "/inventory/sealing-jobs",
      roles: [hasPermission("processingJobs", "view") ? "allowed" : ""],
    },
    {
      title: "Inventory Requests",
      icon: TrendingUp,
      path: "/operations-inventory-relations",
      roles: [
        hasPermission("procurementJobs", "view") ||
        hasPermission("materialRequests", "view")
          ? "allowed"
          : "",
      ],
    },
    {
      title: "Vendor Contacts",
      icon: Contact,
      path: "/vendor-contacts",
      roles: [hasPermission("vendors", "view") ? "allowed" : ""],
    },
    {
      title: "Services",
      icon: Wrench,
      path: "/services",
      roles: [hasPermission("services", "view") ? "allowed" : ""],
    },
  ];

  const financeSection: NavItem[] = [
    {
      title: "Bill Tracking",
      icon: FileText,
      path: "/bill-tracking",
      roles: [hasPermission("billTracking", "view") ? "allowed" : ""],
    },
    {
      title: "Inventory Bill Records",
      icon: FileText,
      path: "/inventory/bill-records",
      roles: [hasPermission("billRecords", "view") ? "allowed" : ""],
    },
  ];

  const orderRecordsSection: NavItem[] = [
    {
      title: "Order Records",
      icon: Package,
      path: "/order-records",
      roles: [hasPermission("orderHistory", "view") ? "allowed" : ""],
    },
  ];

  const specializedTools: NavItem[] = [
    {
      title: "Laser Files",
      icon: Scissors,
      path: "/laser-files",
      roles: [hasPermission("laserFiles", "view") ? "allowed" : ""],
    },
    {
      title: "View Kit Files",
      icon: Home,
      path: "/view-kit-files",
      roles: [hasPermission("laserFiles", "view") ? "allowed" : ""],
    },
  ];

  const kitInfoSection: NavItem[] = [
    {
      title: "Kit Statistics",
      icon: FileText,
      path: "/kit-statistics",
      roles: [hasPermission("kitStatistics", "view") ? "allowed" : ""],
    },
    {
      title: "LMS",
      icon: FileText,
      path: "/lms",
      roles: [hasPermission("lms", "view") ? "allowed" : ""],
    },
  ];

  const adminSection: NavItem[] = [
    {
      title: "Admin Zone",
      icon: Settings,
      path: "/admin-zone",
      roles: [hasPermission("adminZone", "view") ? "allowed" : ""],
    },
    {
      title: "User Management",
      icon: UserCog,
      path: "/user-management",
      roles: [hasPermission("userManagement", "view") ? "allowed" : ""],
    },
    {
      title: "Deletion Requests",
      icon: Trash2,
      path: "/deletion-requests",
      roles: [user?.role === "admin" ? "allowed" : ""],
    },
  ];

  const settingsSection: NavItem[] = [
    {
      title: "Themes",
      icon: Settings,
      path: "/themes",
    },
  ];

  // Filter items based on permissions
  const filterByRole = (items: NavItem[]) => {
    return items.filter(
      (item) => !item.roles || item.roles.includes("allowed")
    );
  };

  const isActive = (path: string) => location.pathname === path;
  const isSubActive = (path: string) => location.pathname.startsWith(path);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full relative">
        
        {/* Content Wrapper */}
        <div className="flex min-h-screen w-full relative z-10">
        <Sidebar className="bg-background/95 backdrop-blur-sm">
          <SidebarHeader className="border-b border-border">
            <div className="flex items-center gap-2 px-4 py-3">
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
                <SidebarGroupLabel>Core</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterByRole(coreOperations).map((item) => (
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

            {/* Packing & Dispatch Operations */}
            {filterByRole(packingDispatchSection).length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Operations</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterByRole(packingDispatchSection).map((item) => (
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

            {/* Finance Section */}
            {filterByRole(financeSection).length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Finance</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterByRole(financeSection).map((item) => (
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

            {/* Order Records Section */}
            {filterByRole(orderRecordsSection).length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Order Records</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterByRole(orderRecordsSection).map((item) => (
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

            {/* Kit Info Section */}
            {filterByRole(kitInfoSection).length > 0 && (
              <SidebarGroup>
                <SidebarGroupLabel>Kit Info</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filterByRole(kitInfoSection).map((item) => (
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

            {/* Settings */}
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {settingsSection.map((item) => (
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
          <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur-sm px-6">
            <SidebarTrigger />
            <div className="flex-1" />
            
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => setNotificationsOpen(true)}
            >
              <Bell className="h-5 w-5" />
              {unreadCount && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleDarkMode}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        </div>

        {/* Notifications Panel */}
        {notificationsOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setNotificationsOpen(false)}
            />

            {/* Notifications Panel */}
            <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-background border-l shadow-xl z-50 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  <h2 className="font-semibold">Notifications</h2>
                  {unreadCount && unreadCount > 0 && (
                    <Badge variant="secondary">{unreadCount}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {notifications && notifications.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await markAllAsRead();
                        toast.success("All notifications marked as read");
                      }}
                    >
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setNotificationsOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-4 space-y-2">
                    {!notifications || notifications.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-sm">No notifications yet</p>
                      </div>
                    ) : (
                      notifications.map((notification: any) => (
                        <Card
                          key={notification._id}
                          className={`cursor-pointer transition-colors hover:bg-accent ${
                            !notification.read ? "border-primary/50 bg-primary/5" : ""
                          }`}
                          onClick={async () => {
                            if (!notification.read) {
                              await markAsRead({ notificationId: notification._id });
                            }
                            if (notification.relatedId) {
                              navigate("/b2b-assignments");
                              setNotificationsOpen(false);
                            }
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {new Date(notification._creationTime).toLocaleString()}
                                </p>
                              </div>
                              {!notification.read && (
                                <div className="h-2 w-2 rounded-full bg-primary mt-1" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </>
        )}

        {/* AI Chat Button */}
        <Button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-40"
          size="icon"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>

        {/* AI Chat Panel */}
        {chatOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setChatOpen(false)}
            />

            {/* Chat Panel */}
            <div className="fixed right-0 top-0 bottom-0 w-full sm:w-96 bg-background border-l shadow-xl z-50 flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  <h2 className="font-semibold">Chat with AI</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleClearChat}
                    disabled={messages.length === 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setChatOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  <div className="space-y-4 pb-4">
                  {messages.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">
                        Ask me about kits, inventory, stock levels, or assignments!
                      </p>
                    </div>
                  )}
                  {messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <p className="text-sm text-muted-foreground">Thinking...</p>
                      </div>
                    </div>
                  )}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
              </div>

              {/* Input */}
              <div className="p-4 border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask about kits, inventory..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={isLoading || !inputMessage.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </div>
          </>
        )}
      </div>
    </SidebarProvider>
  );
}