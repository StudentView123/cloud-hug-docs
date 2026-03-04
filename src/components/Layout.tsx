import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, MapPin, Settings, Archive, PlugZap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

const primaryNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortName: "Home" },
  { name: "Locations", href: "/locations", icon: MapPin, shortName: "Places" },
  { name: "Archive", href: "/archive", icon: Archive, shortName: "Archive" },
  { name: "Integrations", href: "/integrations", icon: PlugZap, shortName: "API" },
  { name: "Settings", href: "/settings", icon: Settings, shortName: "Settings" },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isMobile = useIsMobile();

  return (
    <SidebarProvider>
      <div className="min-h-screen bg-background w-full flex">
        {/* Mobile Header */}
        {isMobile && (
          <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
            <div className="flex items-center justify-between px-4 h-14">
              <h1 className="text-xl font-bold text-foreground">Review Hub</h1>
              <Link to="/settings" className="p-2 -mr-2">
                <Settings className="h-5 w-5 text-foreground" />
              </Link>
            </div>
          </header>
        )}

        {/* Desktop Sidebar */}
        {!isMobile && (
          <>
            <AppSidebar />
            <div className="flex-1 flex flex-col w-full">
              <header className="h-14 border-b border-border bg-card flex items-center px-4">
                <SidebarTrigger />
                <h1 className="text-xl font-bold text-foreground ml-4">Review Hub</h1>
              </header>
              <main className="flex-1 w-full">
                {children}
              </main>
            </div>
          </>
        )}

        {/* Mobile Main Content */}
        {isMobile && (
          <main className="pt-14 pb-20 min-h-screen w-full">
            {children}
          </main>
        )}

        {/* Mobile Bottom Navigation */}
        {isMobile && (
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border pb-safe">
            <div className="flex justify-around items-center h-16 px-2">
              {primaryNav.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[60px] flex-1"
                  >
                    <item.icon 
                      className={cn(
                        "h-6 w-6 transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} 
                    />
                    <span className={cn(
                      "text-[10px] font-medium transition-colors",
                      isActive ? "text-primary" : "text-muted-foreground"
                    )}>
                      {item.shortName}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </SidebarProvider>
  );
};
