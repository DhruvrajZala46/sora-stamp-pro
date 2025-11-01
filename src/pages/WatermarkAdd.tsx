import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import UploadCard from '@/components/UploadCard';
import StarField from '@/components/StarField';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WatermarkAdd = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const [creditsCost, setCreditsCost] = useState(200);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setUser(user);
    fetchCredits(user.id);
  };

  const fetchCredits = async (userId: string) => {
    const { data } = await supabase
      .from('user_subscriptions')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (data) {
      setCredits(data.credits || 0);
    }
  };

  const handleCreditsUpdate = () => {
    if (user) {
      fetchCredits(user.id);
    }
  };

  const handleUploadComplete = async (videoId: string) => {
    try {
      await supabase.functions.invoke('start-processing', {
        body: { video_id: videoId },
      });
      
      navigate('/dashboard');
    } catch (error) {
      console.error('Error starting processing:', error);
    }
  };

  return (
    <div className="min-h-screen sora-hero">
      <StarField />
      <Navbar user={user} credits={credits} />
      
      <div className="relative z-10 pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <Button
            onClick={() => navigate('/')}
            variant="ghost"
            className="mb-6"
          >
            <ArrowLeft className="mr-2 w-4 h-4" />
            Back to Services
          </Button>

          <div className="text-center space-y-4 mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold">Add Sora Watermark</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your video and add a viral Sora watermark
            </p>
            <p className="text-sm text-muted-foreground">
              Cost: {creditsCost} credits per video • You have {credits} credits
            </p>
          </div>

          <UploadCard
            user={user}
            onAuthRequired={() => navigate('/auth')}
            onUploadComplete={handleUploadComplete}
            onCreditsUpdate={handleCreditsUpdate}
            userCredits={credits}
            creditsCost={creditsCost}
            maxFileSizeMb={200}
          />

          {credits < creditsCost && (
            <div className="mt-6 text-center">
              <Button onClick={() => navigate('/credits')} size="lg">
                Buy More Credits
              </Button>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default WatermarkAdd;