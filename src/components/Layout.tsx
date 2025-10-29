import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, MapPin, Activity, Settings, Archive, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

const primaryNav = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, shortName: "Home" },
  { name: "Locations", href: "/locations", icon: MapPin, shortName: "Locations" },
  { name: "Archive", href: "/archive", icon: Archive, shortName: "Archive" },
  { name: "Activity Log", href: "/activity-log", icon: Activity, shortName: "Activity" },
  { name: "Review Audit", href: "/review-audit", icon: ClipboardCheck, shortName: "Audit" },
];

const allNavigation = [
  ...primaryNav,
  { name: "Settings", href: "/settings", icon: Settings, shortName: "Settings" },
];

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      {isMobile && (
        <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
          <div className="flex items-center justify-between px-4 h-14">
            <h1 className="text-xl font-bold text-foreground">ReviewHub</h1>
            <Link to="/settings" className="p-2 -mr-2">
              <Settings className="h-5 w-5 text-foreground" />
            </Link>
          </div>
        </header>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside className="fixed left-0 top-0 h-screen w-64 border-r border-border bg-card">
          <div className="flex h-16 items-center border-b border-border px-6">
            <h1 className="text-xl font-bold text-foreground">ReviewHub</h1>
          </div>
          <nav className="flex flex-col gap-1 p-4">
            {allNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all hover:bg-secondary",
                    isActive
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </aside>
      )}

      {/* Main Content */}
      <main className={cn(
        isMobile ? "pt-14 pb-20" : "ml-64",
        "min-h-screen w-full"
      )}>
        {children}
      </main>

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
  );
};
