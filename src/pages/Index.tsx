import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import StarField from '@/components/StarField';
import Navbar from '@/components/Navbar';
import AuthModal from '@/components/AuthModal';
import UploadCard from '@/components/UploadCard';
import LoadingScreen from '@/components/LoadingScreen';
import VideoPlayer from '@/components/VideoPlayer';

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [plan, setPlan] = useState('free');
  const [videosRemaining, setVideosRemaining] = useState(3);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string>('');
  const [processedPath, setProcessedPath] = useState<string | null>(null);

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchSubscription(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchSubscription(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Subscribe to video status changes
  useEffect(() => {
    if (!currentVideoId) return;

    const channel = supabase
      .channel(`video-${currentVideoId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'videos',
          filter: `id=eq.${currentVideoId}`,
        },
        (payload: any) => {
          setVideoStatus(payload.new.status);
          if (payload.new.status === 'done') {
            setProcessedPath(payload.new.processed_path);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentVideoId]);

  const fetchSubscription = async (userId: string) => {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (data) {
      setPlan(data.plan);
      setVideosRemaining(data.videos_remaining);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPlan('free');
    setVideosRemaining(3);
  };

  const handleUploadComplete = async (videoId: string) => {
    setCurrentVideoId(videoId);
    setVideoStatus('processing');

    // Call placeholder API to start processing
    try {
      await supabase.functions.invoke('start-processing', {
        body: { video_id: videoId },
      });
    } catch (error) {
      console.error('Error starting processing:', error);
    }
  };

  return (
    <div className="min-h-screen sora-hero">
      <StarField />
      <Navbar user={user} plan={plan} onLogout={handleLogout} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 pt-20">
        <div className="max-w-4xl mx-auto text-center space-y-12">
          {/* Hero Section */}
          <div className="space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center shadow-2xl">
              <div className="w-14 h-14 bg-white/10 rounded-2xl backdrop-blur-sm" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold">
              The new SoraStamp app
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Add viral SORA watermarks to your videos with hyperreal motion and authenticity.
            </p>
            <p className="text-lg text-muted-foreground">
              Rolling out now.
            </p>
          </div>

          {/* Upload Card */}
          <div className="max-w-xl mx-auto">
            <UploadCard
              user={user}
              onAuthRequired={() => setAuthModalOpen(true)}
              onUploadComplete={handleUploadComplete}
              videosRemaining={videosRemaining}
            />
          </div>

          {/* Video Player (shown when processing is done) */}
          {videoStatus === 'done' && processedPath && (
            <div className="max-w-2xl mx-auto mt-8">
              <VideoPlayer videoId={currentVideoId!} processedPath={processedPath} />
            </div>
          )}
        </div>
      </div>

      {/* Loading Screen */}
      {videoStatus === 'processing' && <LoadingScreen />}

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onOpenChange={setAuthModalOpen}
        onSuccess={() => {
          if (user) {
            fetchSubscription(user.id);
          }
        }}
      />
    </div>
  );
};

export default Index;
