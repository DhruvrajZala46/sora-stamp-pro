import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import WatermarkRemover from '@/components/WatermarkRemover';
import StarField from '@/components/StarField';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WatermarkRemove = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const [creditsCost] = useState(100); // Fixed: 100 credits

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

  const fetchCredits = async (_userId: string) => {
    const { data: currentCredits, error: ensureError } = await supabase.rpc('ensure_user_subscription');
    if (ensureError) {
      console.error('Error ensuring subscription:', ensureError);
      setCredits(0);
      return;
    }
    setCredits(currentCredits ?? 0);
  };

  const handleCreditsUpdate = () => {
    if (user) {
      fetchCredits(user.id);
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
            <h1 className="text-4xl sm:text-5xl font-bold">Remove Sora Watermark</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Use AI to remove Sora watermarks from OpenAI videos
            </p>
            <p className="text-sm text-muted-foreground">
              Cost: {creditsCost} credits per video • You have {credits} credits
            </p>
          </div>

          <WatermarkRemover
            userCredits={credits}
            creditsCost={creditsCost}
            onCreditsUpdate={handleCreditsUpdate}
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

export default WatermarkRemove;