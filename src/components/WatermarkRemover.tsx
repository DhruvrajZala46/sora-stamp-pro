import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, ExternalLink } from 'lucide-react';

interface WatermarkRemoverProps {
  userCredits: number;
  creditsCost: number;
  onCreditsUpdate: () => void;
}

const WatermarkRemover = ({ userCredits, creditsCost, onCreditsUpdate }: WatermarkRemoverProps) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRemoveWatermark = async () => {
    if (!videoUrl.trim()) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid Sora video URL",
        variant: "destructive"
      });
      return;
    }

    if (!videoUrl.startsWith('https://sora.chatgpt.com/')) {
      toast({
        title: "Invalid Sora URL",
        description: "Please enter a valid Sora video URL from sora.chatgpt.com",
        variant: "destructive"
      });
      return;
    }

    if (userCredits < creditsCost) {
      toast({
        title: "Insufficient Credits",
        description: `You need ${creditsCost} credits. Please purchase more credits.`,
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProcessedVideoUrl(null);

    try {
      const { data, error } = await supabase.functions.invoke('remove-watermark', {
        body: { videoUrl }
      });

      if (error) {
        if (error.message?.includes('Insufficient credits')) {
          toast({
            title: "Insufficient Credits",
            description: `You need ${creditsCost} credits to remove watermarks`,
            variant: "destructive"
          });
        } else {
          throw error;
        }
        return;
      }

      if (data?.success) {
        const outputUrl = data.output_url 
          || (Array.isArray(data.resultUrls) ? data.resultUrls[0] : undefined)
          || (() => {
            try {
              const parsed = typeof data.raw?.resultJson === 'string' ? JSON.parse(data.raw.resultJson) : data.raw?.resultJson;
              return Array.isArray(parsed?.resultUrls) ? parsed.resultUrls[0] : undefined;
            } catch { return undefined; }
          })();

        if (outputUrl) {
          setProcessedVideoUrl(outputUrl);
          toast({
            title: "Watermark Removed!",
            description: `${creditsCost} credits deducted. Video saved to My Videos!`
          });
        } else {
          toast({
            title: "Processing Completed",
            description: "But no video URL was returned. Your credits were used. Please try again or contact support.",
            variant: "destructive"
          });
        }
        onCreditsUpdate();
      }
    } catch (error) {
      console.error('Error removing watermark:', error);
      toast({
        title: "Error",
        description: "Failed to remove watermark. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Remove Sora Watermark</h2>
              <p className="text-sm text-muted-foreground">{creditsCost} credits per video</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoUrl">Sora Video URL</Label>
            <Input
              id="videoUrl"
              type="url"
              placeholder="https://sora.chatgpt.com/p/s_..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              disabled={isProcessing}
            />
            <div className="text-xs text-muted-foreground space-y-1">
              <p>✅ Supported: URLs starting with <code className="bg-muted px-1 rounded">https://sora.chatgpt.com/p/s_</code></p>
              <p>❌ Not supported: URLs with <code className="bg-muted px-1 rounded">/d/gen_</code> format (these are web page URLs, not direct video URLs)</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                💡 Tip: Use the shareable video URL from Sora, not the page URL
              </p>
            </div>
          </div>

          <Button 
            onClick={handleRemoveWatermark} 
            disabled={isProcessing || !videoUrl.trim() || userCredits < creditsCost}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 w-5 h-5" />
                Remove Watermark ({creditsCost} credits)
              </>
            )}
          </Button>

          {userCredits < creditsCost && (
            <p className="text-sm text-destructive">
              Insufficient credits. You have {userCredits} credits but need {creditsCost}.
            </p>
          )}
        </div>
      </Card>

      {processedVideoUrl && (
        <Card className="p-6">
          <div className="space-y-4">
            <h3 className="text-xl font-bold">Your Watermark-Free Video</h3>
            <div className="max-w-2xl mx-auto">
              <video 
                src={processedVideoUrl} 
                controls 
                className="w-full rounded-lg max-h-[500px]"
              />
            </div>
            <Button 
              onClick={() => window.open(processedVideoUrl, '_blank')}
              variant="outline"
              className="w-full max-w-md mx-auto block"
            >
              <ExternalLink className="mr-2 w-4 h-4" />
              Open in New Tab
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default WatermarkRemover;