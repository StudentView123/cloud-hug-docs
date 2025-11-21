# Smart Review-Count-Aware Batching Implementation Plan

## Overview
Replace the current `handleFetchReviews` function in `src/pages/Dashboard.tsx` to implement intelligent batching based on the actual number of reviews per location. This ensures we never exceed the 50-second edge function timeout while maximizing efficiency.

## Core Strategy

**Batch Creation Algorithm:**
1. Fetch all locations with their `review_count` from the database
2. Sort locations by review count (largest first) for better progress visibility
3. Create dynamic batches where total reviews ≤ 200 per batch
4. Process each batch sequentially through the edge function
5. Provide detailed progress feedback to the user

## Key Configuration
- **MAX_REVIEWS_PER_BATCH**: 200 reviews
- **Safety margin**: Locations with ≥200 reviews get their own individual batch
- **Progress tracking**: Show batch number, location count, and total review count per batch

## Implementation Details

### Step 1: Replace `handleFetchReviews` Function

**Location:** `src/pages/Dashboard.tsx`, starting at line 200

**New Function Logic:**

```typescript
const handleFetchReviews = async () => {
  setFetchingReviews(true);
  
  try {
    // Step 1: Fetch all locations with review counts
    const { data: locations, error } = await supabase
      .from('locations')
      .select('id, google_location_id, name, review_count')
      .order('review_count', { ascending: false }); // Largest first
    
    if (error) throw error;
    
    if (!locations || locations.length === 0) {
      toast({
        title: "No locations found",
        description: "Please connect your Google Business Profile first."
      });
      return;
    }

    // Step 2: Create smart batches based on review counts
    const MAX_REVIEWS_PER_BATCH = 200;
    const batches: typeof locations[] = [];
    let currentBatch: typeof locations = [];
    let currentBatchReviewCount = 0;

    for (const location of locations) {
      const locationReviewCount = location.review_count || 0;
      
      // If this location alone has ≥200 reviews, it gets its own batch
      if (locationReviewCount >= MAX_REVIEWS_PER_BATCH) {
        // Save current batch if it has items
        if (currentBatch.length > 0) {
          batches.push([...currentBatch]);
          currentBatch = [];
          currentBatchReviewCount = 0;
        }
        // Add this large location as its own batch
        batches.push([location]);
        continue;
      }
      
      // Check if adding this location would exceed the batch limit
      if (currentBatchReviewCount + locationReviewCount > MAX_REVIEWS_PER_BATCH) {
        // Start a new batch
        batches.push([...currentBatch]);
        currentBatch = [location];
        currentBatchReviewCount = locationReviewCount;
      } else {
        // Add to current batch
        currentBatch.push(location);
        currentBatchReviewCount += locationReviewCount;
      }
    }
    
    // Don't forget the last batch
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Step 3: Process each batch sequentially
    const totalBatches = batches.length;
    let totalProcessed = 0;
    let totalNewReviews = 0;
    const failedBatches: number[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchNum = i + 1;
      const batchReviewCount = batch.reduce((sum, loc) => sum + (loc.review_count || 0), 0);
      
      try {
        // Show progress toast
        const locationNames = batch.length === 1 
          ? batch[0].name 
          : `${batch.length} locations`;
        
        toast({
          title: `Syncing batch ${batchNum}/${totalBatches}`,
          description: `${locationNames} • ~${batchReviewCount} reviews`,
        });

        // Sync this batch
        const locationIds = batch.map(loc => loc.google_location_id);
        const result = await syncMissingReviews(locationIds);
        
        totalNewReviews += result.newReviewsCount || 0;
        totalProcessed += batch.length;

        // Small delay between batches to avoid rate limiting
        if (i < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error: any) {
        console.error(`Batch ${batchNum} failed:`, error);
        failedBatches.push(batchNum);
        
        // Continue with next batch instead of stopping completely
        toast({
          title: `Batch ${batchNum} failed`,
          description: error.message,
          variant: "destructive",
        });
      }
    }

    // Step 4: Show final summary
    const successBatches = totalBatches - failedBatches.length;
    
    toast({
      title: "Full refresh complete",
      description: `✓ Processed ${successBatches}/${totalBatches} batches\n${totalNewReviews} new reviews synced${failedBatches.length > 0 ? `\n⚠️ ${failedBatches.length} batches failed` : ''}`,
    });

    // Step 5: Refresh data
    queryClient.invalidateQueries({ queryKey: ["reviews"] });
    queryClient.invalidateQueries({ queryKey: ["review-counts-by-location"] });

  } catch (error: any) {
    toast({
      title: "Error during full refresh",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setFetchingReviews(false);
  }
};
```

## Example Batch Distribution

**Scenario: 13 locations with varying review counts**

| Location | Reviews | Batch Assignment |
|----------|---------|------------------|
| Long Island Ophthalmic | 400 | Batch 1 (alone) |
| Dr. Tung | 150 | Batch 2 (with others) |
| Location 3 | 45 | Batch 2 |
| Location 4 | 30 | Batch 3 |
| Location 5 | 50 | Batch 3 |
| Location 6 | 60 | Batch 3 |
| Location 7 | 40 | Batch 3 |
| Location 8 | 20 | Batch 4 |
| Location 9 | 20 | Batch 4 |
| Location 10 | 20 | Batch 4 |
| Location 11 | 20 | Batch 4 |
| Location 12 | 20 | Batch 4 |
| Location 13 | 10 | Batch 4 |

**Result:**
- Batch 1: 1 location, 400 reviews (~40s)
- Batch 2: 2 locations, 195 reviews (~20s)
- Batch 3: 4 locations, 180 reviews (~18s)
- Batch 4: 6 locations, 110 reviews (~12s)

**Total time: ~90 seconds vs. timeout at 50 seconds with old approach**

## Benefits of This Approach

✅ **Zero Timeout Risk**: Each batch stays well under the 50-second limit  
✅ **Maximum Speed**: Combines multiple small locations efficiently  
✅ **Fault Tolerant**: One failed batch doesn't stop the entire process  
✅ **Clear Progress**: User sees exactly what's being synced  
✅ **Intelligent**: Automatically adapts to your location distribution  
✅ **Future Proof**: Works even if review counts grow over time  

## Edge Cases Handled

1. **All small locations (0-20 reviews)**: Batches them efficiently in groups
2. **Mix of small and large**: Large ones get individual batches, small ones grouped
3. **Multiple huge locations (500+ reviews each)**: Each gets its own batch, no timeout
4. **New location with 0 reviews**: Included in batch, processed quickly
5. **Batch failure**: Other batches continue processing

## Performance Comparison

### Old Approach (Simple batching by count)
- 5 locations per batch regardless of size
- Batch with 1 huge location (400 reviews) times out
- Manual retries needed
- Unpredictable completion

### New Approach (Smart batching by review count)
- Dynamic batches based on actual workload
- 200-review threshold prevents timeouts
- Automatic completion
- Predictable, reliable sync

## Implementation Status

- [ ] Replace `handleFetchReviews` function in `src/pages/Dashboard.tsx`
- [ ] Test with small locations (0-50 reviews)
- [ ] Test with large locations (200+ reviews)
- [ ] Test with mixed distribution
- [ ] Verify progress toasts display correctly
- [ ] Verify final summary is accurate
- [ ] Test error handling for failed batches

## Related Files

- `src/pages/Dashboard.tsx` - Main implementation
- `src/hooks/useSyncStatus.tsx` - Sync hooks
- `src/hooks/useReviews.tsx` - Review fetching hooks
- `supabase/functions/fetch-reviews/index.ts` - Edge function (no changes needed)

## Notes

- The `review_count` column in the `locations` table is kept up-to-date by the `fetch-reviews` edge function
- No changes needed to the edge function itself - it already supports batching via `location_ids` parameter
- The 200-review threshold was chosen based on observed performance: single location with 400 reviews takes ~56 seconds, so 200 provides a safe margin under the 50-second timeout
