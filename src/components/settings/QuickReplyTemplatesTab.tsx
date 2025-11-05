import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuickReplyTemplates } from "@/hooks/useQuickReplyTemplates";
import { Plus, Edit2, Trash, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const ratingTiers = [
  { min: 5, max: 5, label: '5-Star Reviews', color: 'bg-green-50 border-green-200' },
  { min: 4, max: 4, label: '4-Star Reviews', color: 'bg-blue-50 border-blue-200' },
  { min: 3, max: 3, label: '3-Star Reviews', color: 'bg-yellow-50 border-yellow-200' },
  { min: 1, max: 2, label: '1-2 Star Reviews', color: 'bg-red-50 border-red-200' }
];

export const QuickReplyTemplatesTab = () => {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useQuickReplyTemplates();
  const { toast } = useToast();
  
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateText, setTemplateText] = useState("");
  const [selectedRatingMin, setSelectedRatingMin] = useState(5);
  const [selectedRatingMax, setSelectedRatingMax] = useState(5);

  const handleAddTemplate = (min: number, max: number) => {
    setSelectedRatingMin(min);
    setSelectedRatingMax(max);
    setTemplateText("");
    setEditingTemplate(null);
    setShowTemplateDialog(true);
  };

  const handleEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setTemplateText(template.template_text);
    setSelectedRatingMin(template.rating_min);
    setSelectedRatingMax(template.rating_max);
    setShowTemplateDialog(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateText.trim()) {
      toast({ title: "Please enter template text", variant: "destructive" });
      return;
    }

    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({
          id: editingTemplate.id,
          updates: { template_text: templateText }
        });
        toast({ title: "Template updated successfully" });
      } else {
        await addTemplate.mutateAsync({
          rating_min: selectedRatingMin,
          rating_max: selectedRatingMax,
          template_text: templateText,
          is_active: true,
          usage_count: 0
        });
        toast({ title: "Template added successfully" });
      }
      setShowTemplateDialog(false);
      setTemplateText("");
    } catch (error) {
      toast({ title: "Error saving template", variant: "destructive" });
    }
  };

  const handleToggleTemplate = async (id: string, isActive: boolean) => {
    try {
      await updateTemplate.mutateAsync({
        id,
        updates: { is_active: isActive }
      });
      toast({ title: isActive ? "Template enabled" : "Template disabled" });
    } catch (error) {
      toast({ title: "Error updating template", variant: "destructive" });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    
    try {
      await deleteTemplate.mutateAsync(id);
      toast({ title: "Template deleted successfully" });
    } catch (error) {
      toast({ title: "Error deleting template", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 mt-6">
      <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
        <p className="text-sm text-blue-900 flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            Quick reply templates are used for reviews with no text (star-only). 
            The system automatically rotates through active templates to avoid repetition.
          </span>
        </p>
      </div>

      {ratingTiers.map(tier => {
        const tierTemplates = templates?.filter(
          t => t.rating_min === tier.min && t.rating_max === tier.max
        ) || [];

        return (
          <Card key={tier.label} className={`p-4 border-2 ${tier.color}`}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium">{tier.label}</h4>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddTemplate(tier.min, tier.max)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Template
              </Button>
            </div>

            <div className="space-y-2">
              {tierTemplates.map(template => (
                <div key={template.id} className="bg-white p-3 rounded border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm">{template.template_text}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Used {template.usage_count} times
                        {template.last_used_at && ` • Last used ${formatDistanceToNow(new Date(template.last_used_at))} ago`}
                      </p>
                    </div>
                    <div className="flex gap-2 items-center flex-shrink-0">
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={(checked) => 
                          handleToggleTemplate(template.id, checked)
                        }
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {tierTemplates.length === 0 && (
                <p className="text-sm text-muted-foreground italic p-3">
                  No templates yet. Using default system responses.
                </p>
              )}
            </div>
          </Card>
        );
      })}

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit' : 'Add'} Quick Reply Template
            </DialogTitle>
            <DialogDescription>
              For {selectedRatingMin === selectedRatingMax ? `${selectedRatingMin}-star` : `${selectedRatingMin}-${selectedRatingMax} star`} reviews
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Type your reply template..."
            value={templateText}
            onChange={(e) => setTemplateText(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
