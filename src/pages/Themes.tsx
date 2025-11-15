import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

const THEME_BACKGROUNDS = [
  {
    id: "red-waves",
    name: "Red Waves",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/af314735-18df-40da-8c8e-af7f4d842a60",
  },
  {
    id: "blue-gray-waves",
    name: "Blue Gray Waves",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/55c9d3f2-daac-49d3-af51-d997afcf208e",
  },
  {
    id: "soft-gradient",
    name: "Soft Gradient",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/a85d5ab9-8a94-4f64-8f3a-c2c5a666582d",
  },
  {
    id: "teal-triangles",
    name: "Teal Triangles",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/acb39d1b-2144-4355-9ac0-8b2a2857e835",
  },
  {
    id: "concentric-circles",
    name: "Concentric Circles",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/3f699957-39ba-4a86-892a-981722f9fa22",
  },
  {
    id: "pastel-waves",
    name: "Pastel Waves",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/1bd70797-e73d-46d9-8d0f-8a2267170c37",
  },
  {
    id: "particle-network",
    name: "Particle Network",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/66276a20-15f9-4412-8968-e465fa67f820",
  },
  {
    id: "fractal-art",
    name: "Fractal Art",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/72193311-61fe-44e8-a036-29913ee1b974",
  },
  {
    id: "pink-waves",
    name: "Pink Waves",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/7d7544db-a3e3-4bdd-93c3-e6758f729a47",
  },
  {
    id: "tech-network",
    name: "Tech Network",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/5c15cacf-d936-4569-9187-d2cd6ee0fdbb",
  },
  {
    id: "watercolor",
    name: "Watercolor",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/7e598922-2012-4012-bc7c-01c2250d8edd",
  },
  {
    id: "purple-silk",
    name: "Purple Silk",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/b33f2f32-0c0d-4125-8f53-7b32f239d104",
  },
  {
    id: "dreamy-bokeh",
    name: "Dreamy Bokeh",
    url: "https://harmless-tapir-303.convex.cloud/api/storage/3cdf4fdb-6a5c-4191-bce4-5deb995719ee",
  },
];

export default function Themes() {
  const { isLoading, isAuthenticated, user } = useAuth();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [selectedTheme, setSelectedTheme] = useState<string>(() => {
    return localStorage.getItem("app-theme") || "none";
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate("/auth");
    if (!isLoading && isAuthenticated && user && !user.isApproved) navigate("/pending-approval");
  }, [isLoading, isAuthenticated, user, navigate]);

  useEffect(() => {
    // Apply theme to body
    const body = document.body;
    
    if (selectedTheme === "none") {
      body.style.backgroundImage = "none";
      body.style.backgroundColor = "";
    } else {
      const theme = THEME_BACKGROUNDS.find((t) => t.id === selectedTheme);
      if (theme) {
        body.style.backgroundImage = `url(${theme.url})`;
        body.style.backgroundSize = "cover";
        body.style.backgroundPosition = "center";
        body.style.backgroundAttachment = "fixed";
        body.style.backgroundRepeat = "no-repeat";
      }
    }

    // Add blur overlay
    let overlay = document.getElementById("theme-blur-overlay");
    if (selectedTheme !== "none") {
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
    } else {
      if (overlay) {
        overlay.remove();
      }
    }

    return () => {
      // Cleanup on unmount
      if (overlay) {
        overlay.remove();
      }
    };
  }, [selectedTheme]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  const handleThemeSelect = (themeId: string) => {
    setSelectedTheme(themeId);
    localStorage.setItem("app-theme", themeId);
    toast.success(themeId === "none" ? "Theme removed" : "Theme applied successfully");
  };

  return (
    <Layout>
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Themes</h1>
          <p className="text-muted-foreground mt-2">
            Choose a background theme for your application
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {/* No Theme Option */}
          <Card
            className={`relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${
              selectedTheme === "none" ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => handleThemeSelect("none")}
          >
            <div className="aspect-video bg-muted flex items-center justify-center">
              <span className="text-muted-foreground font-medium">No Background</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Default</h3>
                {selectedTheme === "none" && (
                  <Check className="h-5 w-5 text-primary" />
                )}
              </div>
            </div>
          </Card>

          {/* Theme Options */}
          {THEME_BACKGROUNDS.map((theme) => (
            <Card
              key={theme.id}
              className={`relative overflow-hidden cursor-pointer transition-all hover:scale-105 ${
                selectedTheme === theme.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => handleThemeSelect(theme.id)}
            >
              <div className="aspect-video relative">
                <img
                  src={theme.url}
                  alt={theme.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 backdrop-blur-[80px]" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{theme.name}</h3>
                  {selectedTheme === theme.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 p-4 border rounded-lg bg-card">
          <h3 className="font-semibold mb-2">Preview</h3>
          <p className="text-sm text-muted-foreground">
            The selected theme will be applied as a blurred background across the entire application.
            Your selection is saved automatically.
          </p>
        </div>
      </div>
    </Layout>
  );
}
