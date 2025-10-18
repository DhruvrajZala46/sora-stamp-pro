import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface VideoPlayerProps {
  videoId: string;
  processedPath: string;
}

const VideoPlayer = ({ videoId, processedPath }: VideoPlayerProps) => {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('processed')
        .createSignedUrl(processedPath, 3600);

      if (error) throw error;

      setDownloadUrl(data.signedUrl);
      window.open(data.signedUrl, '_blank');
      
      toast({
        title: 'Download started',
        description: 'Your watermarked video is ready!',
      });
    } catch (error: any) {
      toast({
        title: 'Download failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-semibold">Your SoraStamp Video</h3>
      <div className="aspect-video bg-black rounded-lg overflow-hidden">
        <video
          src={downloadUrl || undefined}
          controls
          className="w-full h-full object-contain"
        >
          Your browser does not support the video tag.
        </video>
      </div>
      <Button onClick={handleDownload} className="w-full btn-hero">
        <Download className="w-4 h-4 mr-2" />
        Download Video
      </Button>
    </div>
  );
};

export default VideoPlayer;
