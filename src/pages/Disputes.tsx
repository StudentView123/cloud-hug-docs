import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Flag,
  ExternalLink,
  Map as MapIcon,
  Copy,
  Archive as ArchiveIcon,
  AlertTriangle,
  Search,
  Star,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { useDisputes, useUpdateDisputeStatus, useArchiveReview, type DisputeReview, type DisputeStatus } from "@/hooks/useDisputes";
import { useLocations } from "@/hooks/useLocations";
import { buildGoogleReviewsUrl, buildGoogleMapsUrl } from "@/lib/googleLinks";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

type RatingFilter = "1" | "1-2" | "all";
type DateFilter = "30" | "90" | "all";

const sentimentColor: Record<string, string> = {
  negative: "bg-destructive/10 text-destructive border-destructive/30",
  neutral: "bg-muted text-muted-foreground",
  positive: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
};

const statusMeta: Record<DisputeStatus, { label: string; className: string }> = {
  none: { label: "Unhandled", className: "bg-muted text-muted-foreground" },
  flagged: { label: "Flagged with Google", className: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  resolved: { label: "Removed by Google", className: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  rejected: { label: "Google declined", className: "bg-destructive/10 text-destructive border-destructive/30" },
};

const Disputes = () => {
  const { toast } = useToast();
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("1");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [search, setSearch] = useState("");
  const [hideHandled, setHideHandled] = useState(false);
  const [resolvingPlaceIds, setResolvingPlaceIds] = useState(false);

  const [notesDialog, setNotesDialog] = useState<{ review: DisputeReview; status: DisputeStatus } | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const maxRating = ratingFilter === "1" ? 1 : ratingFilter === "1-2" ? 2 : 5;
  const { data: reviews, isLoading } = useDisputes({ maxRating });
  const { data: locations } = useLocations();
  const updateStatus = useUpdateDisputeStatus();
  const archiveReview = useArchiveReview();

  const filtered = useMemo(() => {
    if (!reviews) return [];
    const now = Date.now();
    const dateCutoff =
      dateFilter === "30" ? now - 30 * 24 * 60 * 60 * 1000 : dateFilter === "90" ? now - 90 * 24 * 60 * 60 * 1000 : 0;

    return reviews.filter((r) => {
      if (locationFilter !== "all" && r.location_id !== locationFilter) return false;
      if (dateCutoff && new Date(r.review_created_at).getTime() < dateCutoff) return false;
      if (hideHandled && r.dispute_status !== "none") return false;
      if (search) {
        const q = search.toLowerCase();
        const inAuthor = r.author_name.toLowerCase().includes(q);
        const inText = (r.text ?? "").toLowerCase().includes(q);
        if (!inAuthor && !inText) return false;
      }
      return true;
    });
  }, [reviews, locationFilter, dateFilter, hideHandled, search]);

  const stats = useMemo(() => {
    const list = reviews ?? [];
    const oneStar = list.filter((r) => r.rating === 1);
    const last30 = oneStar.filter(
      (r) => new Date(r.review_created_at).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000
    );
    const byLocation = new Map<string, { name: string; count: number }>();
    oneStar.forEach((r) => {
      if (!r.location) return;
      const cur = byLocation.get(r.location.id);
      if (cur) cur.count += 1;
      else byLocation.set(r.location.id, { name: r.location.name, count: 1 });
    });
    const topLocations = Array.from(byLocation.values()).sort((a, b) => b.count - a.count).slice(0, 3);
    const unhandled = oneStar.filter((r) => r.dispute_status === "none").length;
    return { totalOneStar: oneStar.length, last30: last30.length, topLocations, unhandled };
  }, [reviews]);

  const handleCopy = async (text: string | null) => {
    if (!text) {
      toast({ title: "Nothing to copy", variant: "destructive" });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast({ title: "Review text copied" });
  };

  const openStatusDialog = (review: DisputeReview, status: DisputeStatus) => {
    setNotesValue(review.dispute_notes ?? "");
    setNotesDialog({ review, status });
  };

  const handleSaveStatus = async () => {
    if (!notesDialog) return;
    try {
      await updateStatus.mutateAsync({
        reviewId: notesDialog.review.id,
        status: notesDialog.status,
        notes: notesValue || null,
      });
      toast({ title: `Marked as ${statusMeta[notesDialog.status].label}` });
      setNotesDialog(null);
    } catch (e) {
      toast({ title: "Could not update dispute status", variant: "destructive" });
    }
  };

  const handleClearStatus = async (review: DisputeReview) => {
    try {
      await updateStatus.mutateAsync({ reviewId: review.id, status: "none", notes: null });
      toast({ title: "Reset to unhandled" });
    } catch {
      toast({ title: "Could not reset status", variant: "destructive" });
    }
  };

  const handleArchive = async (review: DisputeReview) => {
    try {
      await archiveReview.mutateAsync({ reviewId: review.id, archived: true });
      toast({ title: "Review archived" });
    } catch {
      toast({ title: "Could not archive review", variant: "destructive" });
    }
  };

  const handleResolvePlaceIds = async () => {
    setResolvingPlaceIds(true);
    try {
      const { error } = await supabase.functions.invoke("resolve-place-ids", { body: {} });
      if (error) throw error;
      toast({ title: "Place IDs refreshed" });
    } catch (e) {
      toast({ title: "Could not resolve place IDs", variant: "destructive" });
    } finally {
      setResolvingPlaceIds(false);
    }
  };

  const missingPlaceIdCount = filtered.filter((r) => !r.location?.place_id).length;

  return (
    <Layout>
      <div className="container mx-auto p-4 md:p-6 space-y-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Reputation</p>
            <h1 className="text-2xl font-bold flex items-center gap-2 mt-1">
              <Flag className="h-6 w-6 text-destructive" />
              Disputes
            </h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              One-click access to flag low-star reviews on Google. Tracking is local — Google doesn't expose
              dispute status via API, so log outcomes here.
            </p>
          </div>
          {missingPlaceIdCount > 0 && (
            <Button variant="outline" onClick={handleResolvePlaceIds} disabled={resolvingPlaceIds}>
              {resolvingPlaceIds ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MapIcon className="h-4 w-4 mr-2" />
              )}
              Resolve {missingPlaceIdCount} missing place ID{missingPlaceIdCount === 1 ? "" : "s"}
            </Button>
          )}
        </header>

        {/* Summary */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Total 1★</p>
            <p className="text-2xl font-bold mt-1">{stats.totalOneStar}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">1★ in last 30d</p>
            <p className="text-2xl font-bold mt-1">{stats.last30}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Unhandled</p>
            <p className="text-2xl font-bold mt-1 text-destructive">{stats.unhandled}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Top hotspot</p>
            <p className="text-sm font-medium mt-1 truncate">
              {stats.topLocations[0]?.name ?? "—"}
            </p>
            {stats.topLocations[0] && (
              <p className="text-xs text-muted-foreground">{stats.topLocations[0].count} reviews</p>
            )}
          </Card>
        </section>

        {/* Filters */}
        <Card className="p-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Select value={ratingFilter} onValueChange={(v) => setRatingFilter(v as RatingFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1★ only</SelectItem>
                <SelectItem value="1-2">1–2★</SelectItem>
                <SelectItem value="all">All ratings</SelectItem>
              </SelectContent>
            </Select>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger><SelectValue placeholder="All locations" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations?.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search author or text"
                className="pl-9"
              />
            </div>

            <Button
              variant={hideHandled ? "default" : "outline"}
              onClick={() => setHideHandled((v) => !v)}
            >
              {hideHandled ? "Showing unhandled" : "Hide handled"}
            </Button>
          </div>
        </Card>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <Flag className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-muted-foreground">No reviews match these filters. Nice work.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((review) => {
              const meta = statusMeta[review.dispute_status];
              const placeId = review.location?.place_id ?? null;
              return (
                <Card key={review.id} className="p-4 md:p-5">
                  <div className="flex flex-col md:flex-row md:items-start gap-4">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={review.author_photo_url ?? undefined} alt={review.author_name} />
                      <AvatarFallback>{review.author_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{review.author_name}</span>
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                          {Array.from({ length: review.rating }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-current" />
                          ))}
                          <span className="ml-1">{review.rating}★</span>
                        </Badge>
                        {review.location && (
                          <Badge variant="secondary" className="font-normal">{review.location.name}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(review.review_created_at), { addSuffix: true })}
                        </span>
                        {review.sentiment && (
                          <Badge variant="outline" className={sentimentColor[review.sentiment] ?? ""}>
                            {review.sentiment}
                          </Badge>
                        )}
                        {review.sentiment_mismatch && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            sentiment mismatch
                          </Badge>
                        )}
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </div>

                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {review.text || <span className="italic text-muted-foreground">No text — rating only.</span>}
                      </p>

                      {review.dispute_notes && (
                        <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
                          <span className="font-medium text-muted-foreground">Notes:</span>{" "}
                          <span className="text-foreground">{review.dispute_notes}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        {placeId ? (
                          <>
                            <Button asChild size="sm">
                              <a href={buildGoogleReviewsUrl(placeId)} target="_blank" rel="noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                Open on Google
                              </a>
                            </Button>
                            <Button asChild size="sm" variant="outline">
                              <a href={buildGoogleMapsUrl(placeId)} target="_blank" rel="noreferrer">
                                <MapIcon className="h-3.5 w-3.5 mr-1.5" />
                                Open in Maps
                              </a>
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Missing place_id — run "Resolve" above
                          </Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => handleCopy(review.text)}>
                          <Copy className="h-3.5 w-3.5 mr-1.5" />
                          Copy text
                        </Button>

                        {review.dispute_status === "none" ? (
                          <Button size="sm" variant="outline" onClick={() => openStatusDialog(review, "flagged")}>
                            <Flag className="h-3.5 w-3.5 mr-1.5" />
                            Mark flagged
                          </Button>
                        ) : (
                          <>
                            <Button size="sm" variant="outline" onClick={() => openStatusDialog(review, "resolved")}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                              Resolved
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => openStatusDialog(review, "rejected")}>
                              <XCircle className="h-3.5 w-3.5 mr-1.5" />
                              Rejected
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleClearStatus(review)}>
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              Reset
                            </Button>
                          </>
                        )}

                        {!review.archived && (
                          <Button size="sm" variant="ghost" onClick={() => handleArchive(review)}>
                            <ArchiveIcon className="h-3.5 w-3.5 mr-1.5" />
                            Archive
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={!!notesDialog} onOpenChange={(open) => !open && setNotesDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {notesDialog && `Mark as ${statusMeta[notesDialog.status].label}`}
              </DialogTitle>
              <DialogDescription>
                Add an optional note about this dispute (e.g., date you reported it, Google case ID).
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder="Optional notes…"
              rows={4}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesDialog(null)}>Cancel</Button>
              <Button onClick={handleSaveStatus} disabled={updateStatus.isPending}>
                {updateStatus.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Disputes;
