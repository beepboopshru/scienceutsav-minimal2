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
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { ReactNode, useState, useEffect, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      icon: Package,
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
      subItems: [
        { title: "Processing Jobs", path: "/inventory/processing-jobs" },
        { title: "Bill Records", path: "/inventory/bill-records" },
        { title: "Procurement", path: "/procurement" },
      ],
    },
    {
      title: "Operations-Inventory",
      icon: TrendingUp,
      path: "/operations-inventory-relations",
      roles: [hasPermission("procurementJobs", "view") ? "allowed" : ""],
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
      roles: [hasPermission("programs", "view") ? "allowed" : ""],
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
        {/* Blurred Background */}
        <div 
          className="fixed inset-0 z-0 bg-cover bg-center"
          style={{
            backgroundImage: 'url(https://harmless-tapir-303.convex.cloud/api/storage/35f27a22-fb8f-4c6b-aca0-e423b71005b3)',
            filter: 'blur(8px)',
            transform: 'scale(1.1)',
          }}
        />
        
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
          </header>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
        </div>

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