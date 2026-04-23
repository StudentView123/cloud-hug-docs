import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, MapPin, Settings, Archive, ClipboardCheck, Headphones, PlugZap, Flag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";

const allNavigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Locations", href: "/locations", icon: MapPin },
  { name: "Disputes", href: "/disputes", icon: Flag },
  { name: "Archive", href: "/archive", icon: Archive },
  { name: "Review Audit", href: "/review-audit", icon: ClipboardCheck },
  { name: "Integrations", href: "/integrations", icon: PlugZap },
  { name: "Support", href: "/support", icon: Headphones },
  { name: "Settings", href: "/settings", icon: Settings },
];

const useUnhandledDisputeCount = () =>
  useQuery({
    queryKey: ["disputes-unhandled-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("rating", 1)
        .eq("dispute_status", "none")
        .eq("archived", false);
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

export function AppSidebar() {
  const location = useLocation();
  const { open } = useSidebar();
  const { data: unhandledCount } = useUnhandledDisputeCount();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={cn(!open && "sr-only")}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allNavigation.map((item) => {
                const isActive = location.pathname === item.href;
                const showBadge =
                  item.href === "/disputes" && open && unhandledCount && unhandledCount > 0;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={
                        item.href === "/disputes" && unhandledCount
                          ? `${item.name} (${unhandledCount})`
                          : item.name
                      }
                    >
                      <Link to={item.href}>
                        <item.icon />
                        <span className="flex-1">{item.name}</span>
                        {showBadge ? (
                          <Badge
                            variant="outline"
                            className="bg-destructive/15 text-destructive border-destructive/30 h-5 px-1.5 text-[10px]"
                          >
                            {unhandledCount}
                          </Badge>
                        ) : null}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
