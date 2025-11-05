import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const AISettingsTab = () => {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    formality: "professional",
    length: "concise",
    personality: "friendly",
    custom_instructions: "",
    avoid_phrases: [] as string[],
    variation_strength: "high"
  });
  const [newPhrase, setNewPhrase] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('reply_style_settings')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (data?.reply_style_settings && typeof data.reply_style_settings === 'object') {
        const s = data.reply_style_settings as any;
        setSettings({
          formality: s.formality || "professional",
          length: s.length || "concise",
          personality: s.personality || "friendly",
          custom_instructions: s.custom_instructions || "",
          avoid_phrases: Array.isArray(s.avoid_phrases) ? s.avoid_phrases : [],
          variation_strength: s.variation_strength || "high"
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ reply_style_settings: settings })
        .eq('id', user.id);

      if (error) throw error;
      toast({ title: "Settings saved successfully" });
    } catch (error) {
      toast({ title: "Error saving settings", variant: "destructive" });
    }
  };

  const handleAddPhrase = () => {
    if (!newPhrase.trim()) return;
    setSettings(prev => ({
      ...prev,
      avoid_phrases: [...prev.avoid_phrases, newPhrase.trim()]
    }));
    setNewPhrase("");
  };

  const handleRemovePhrase = (index: number) => {
    setSettings(prev => ({
      ...prev,
      avoid_phrases: prev.avoid_phrases.filter((_, i) => i !== index)
    }));
  };

  const variationLabels = ['low', 'medium', 'high'];
  const variationValue = variationLabels.indexOf(settings.variation_strength);

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 mt-6">
      <div>
        <Label>Formality</Label>
        <div className="flex gap-2 mt-2">
          {['casual', 'professional', 'formal'].map(option => (
            <Button
              key={option}
              variant={settings.formality === option ? 'default' : 'outline'}
              onClick={() => setSettings({ ...settings, formality: option })}
              className="capitalize"
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label>Length Preference</Label>
        <div className="flex gap-2 mt-2">
          {[
            { value: 'brief', label: 'Brief (1-2 sentences)' },
            { value: 'concise', label: 'Concise (2-3 sentences)' },
            { value: 'detailed', label: 'Detailed (3-4 sentences)' }
          ].map(option => (
            <Button
              key={option.value}
              variant={settings.length === option.value ? 'default' : 'outline'}
              onClick={() => setSettings({ ...settings, length: option.value })}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label>Personality</Label>
        <div className="flex gap-2 mt-2">
          {['friendly', 'warm', 'reserved'].map(option => (
            <Button
              key={option}
              variant={settings.personality === option ? 'default' : 'outline'}
              onClick={() => setSettings({ ...settings, personality: option })}
              className="capitalize"
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="custom-instructions">Custom Instructions (Optional)</Label>
        <Textarea
          id="custom-instructions"
          placeholder="e.g., 'Always mention our 30-day guarantee' or 'Use first-person plural (we/our)'"
          value={settings.custom_instructions}
          onChange={(e) => setSettings({ ...settings, custom_instructions: e.target.value })}
          className="mt-2"
          rows={3}
        />
        <p className="text-xs text-muted-foreground mt-1">
          These instructions will be added to every AI-generated reply
        </p>
      </div>

      <div>
        <Label>Avoid These Phrases</Label>
        <div className="flex gap-2 mt-2">
          <Input
            placeholder='e.g., "Thank you so much for your kind words"'
            value={newPhrase}
            onChange={(e) => setNewPhrase(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPhrase()}
          />
          <Button size="sm" onClick={handleAddPhrase}>Add</Button>
        </div>
        
        <div className="flex flex-wrap gap-2 mt-3">
          {settings.avoid_phrases.map((phrase, idx) => (
            <Badge key={idx} variant="secondary" className="gap-1">
              {phrase}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => handleRemovePhrase(idx)}
              />
            </Badge>
          ))}
        </div>
        {settings.avoid_phrases.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">No blocked phrases yet</p>
        )}
      </div>

      <div>
        <Label htmlFor="variation-slider">Reply Variation</Label>
        <div className="flex items-center gap-4 mt-2">
          <Slider
            id="variation-slider"
            value={[variationValue]}
            onValueChange={([val]) => setSettings({ ...settings, variation_strength: variationLabels[val] })}
            min={0}
            max={2}
            step={1}
            className="flex-1"
          />
          <span className="text-sm font-medium min-w-16 capitalize">
            {settings.variation_strength}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Higher variation = more unique phrasing, but potentially less consistency
        </p>
      </div>

      <Button onClick={saveSettings} className="w-full">
        Save Settings
      </Button>
    </div>
  );
};
