import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTrainingExamples } from "@/hooks/useTrainingExamples";
import { Edit2, Trash, Info, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export const TrainingExamplesTab = () => {
  const { trainingExamples, updateExample, deleteExample } = useTrainingExamples();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [editingExample, setEditingExample] = useState<any>(null);
  const [editingNotes, setEditingNotes] = useState("");

  const handleEditNotes = (example: any) => {
    setEditingExample(example);
    setEditingNotes(example.notes || "");
    setShowNotesDialog(true);
  };

  const handleSaveNotes = async () => {
    if (!editingExample) return;

    try {
      await updateExample.mutateAsync({
        id: editingExample.id,
        updates: { notes: editingNotes }
      });
      toast({ title: "Notes updated successfully" });
      setShowNotesDialog(false);
    } catch (error) {
      toast({ title: "Error updating notes", variant: "destructive" });
    }
  };

  const handleToggleExample = async (id: string, isActive: boolean) => {
    try {
      await updateExample.mutateAsync({
        id,
        updates: { is_active: isActive }
      });
      toast({ title: isActive ? "Example enabled" : "Example disabled" });
    } catch (error) {
      toast({ title: "Error updating example", variant: "destructive" });
    }
  };

  const handleDeleteExample = async (id: string) => {
    if (!confirm("Are you sure you want to remove this training example?")) return;
    
    try {
      await deleteExample.mutateAsync(id);
      toast({ title: "Example removed successfully" });
    } catch (error) {
      toast({ title: "Error deleting example", variant: "destructive" });
    }
  };

  const positiveExamples = trainingExamples?.filter(e => e.sentiment === 'positive') || [];
  const neutralExamples = trainingExamples?.filter(e => e.sentiment === 'neutral') || [];
  const negativeExamples = trainingExamples?.filter(e => e.sentiment === 'negative') || [];

  return (
    <div className="space-y-6 mt-6">
      <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
        <p className="text-sm text-blue-900 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Training examples help the AI learn your preferred reply style. 
            Select examples from your Archive that represent how you want the AI to sound.
          </span>
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Positive Examples</p>
          <p className="text-2xl font-bold text-green-600">{positiveExamples.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Neutral Examples</p>
          <p className="text-2xl font-bold text-yellow-600">{neutralExamples.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Negative Examples</p>
          <p className="text-2xl font-bold text-red-600">{negativeExamples.length}</p>
        </Card>
      </div>

      {['positive', 'neutral', 'negative'].map(sentiment => {
        const examples = trainingExamples?.filter(e => e.sentiment === sentiment) || [];
        if (examples.length === 0) return null;

        const sentimentColors = {
          positive: 'text-green-600',
          neutral: 'text-yellow-600',
          negative: 'text-red-600'
        };

        return (
          <div key={sentiment}>
            <h4 className={`font-medium mb-3 capitalize ${sentimentColors[sentiment as keyof typeof sentimentColors]}`}>
              {sentiment} Examples
            </h4>
            <div className="space-y-3">
              {examples.map(example => (
                <Card key={example.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                          Review ({example.review_rating} <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />)
                        </p>
                        <p className="text-sm">
                          {example.review_text || <em className="text-muted-foreground">No text (star-only)</em>}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">
                          Our Reply
                        </p>
                        <p className="text-sm bg-muted p-2 rounded">
                          {example.reply_content}
                        </p>
                      </div>

                      {example.notes && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground mb-1">
                            Why we like this
                          </p>
                          <p className="text-sm italic text-muted-foreground">
                            "{example.notes}"
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <Switch
                        checked={example.is_active}
                        onCheckedChange={(checked) => 
                          handleToggleExample(example.id, checked)
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditNotes(example)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteExample(example.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        );
      })}

      {trainingExamples?.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            No training examples yet. Go to your Archive to add some!
          </p>
          <Button variant="outline" onClick={() => navigate('/archive')}>
            <Star className="h-4 w-4 mr-2" />
            Go to Archive
          </Button>
        </div>
      )}

      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Notes</DialogTitle>
            <DialogDescription>
              Explain what you like about this reply
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g., 'Love the casual tone and how it mentions the specific dish'"
            value={editingNotes}
            onChange={(e) => setEditingNotes(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotesDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNotes}>Save Notes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
