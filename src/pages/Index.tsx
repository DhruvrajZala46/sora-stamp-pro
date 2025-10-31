import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import StarField from '@/components/StarField';
import Navbar from '@/components/Navbar';
import ServiceCard from '@/components/ServiceCard';
import Footer from '@/components/Footer';
import { Plus, Eraser, Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(15);
  const [servicePricing, setServicePricing] = useState({
    watermark_add: 5,
    watermark_remove: 15
  });

  useEffect(() => {
    checkAuth();
    fetchServicePricing();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      fetchCredits(session.user.id);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCredits(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
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

  const fetchServicePricing = async () => {
    const { data } = await supabase
      .from('service_pricing')
      .select('*');

    if (data) {
      const pricing = data.reduce((acc, item) => {
        acc[item.service_type] = item.credits_cost;
        return acc;
      }, {} as any);
      setServicePricing(pricing);
    }
  };

  const handleServiceSelect = (serviceType: 'add' | 'remove') => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if (serviceType === 'add') {
      navigate('/watermark-add');
    } else {
      navigate('/watermark-remove');
    }
  };

  return (
    <div className="min-h-screen sora-hero">
      <StarField />
      <Navbar user={user} credits={credits} />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 pt-20 sm:pt-24 pb-16">
        <div className="max-w-6xl mx-auto w-full space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-primary to-accent rounded-3xl flex items-center justify-center shadow-2xl">
              <div className="w-14 h-14 bg-white/10 rounded-2xl backdrop-blur-sm" />
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold px-4">
              Sora Watermark Studio
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto px-4">
              Add or remove Sora watermarks with AI. Choose your service below.
            </p>
            
            {user && (
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="inline-flex items-center gap-2 bg-primary/10 px-6 py-3 rounded-full">
                  <Coins className="w-5 h-5 text-primary" />
                  <span className="text-lg font-semibold">{credits} credits available</span>
                </div>
                <Button 
                  onClick={() => navigate('/credits')}
                  variant="outline"
                  className="rounded-full"
                >
                  Buy More Credits
                </Button>
              </div>
            )}
          </div>

          {/* Service Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <ServiceCard
              title="Add Watermark"
              description="Add a Sora watermark to any video and make it look AI-generated"
              credits={servicePricing.watermark_add}
              icon={<Plus className="w-8 h-8 text-white" />}
              onClick={() => handleServiceSelect('add')}
            />
            <ServiceCard
              title="Remove Watermark"
              description="Use AI to remove Sora watermarks from OpenAI videos"
              credits={servicePricing.watermark_remove}
              icon={<Eraser className="w-8 h-8 text-white" />}
              onClick={() => handleServiceSelect('remove')}
              featured
            />
          </div>

          {!user && (
            <div className="text-center">
              <p className="text-muted-foreground mb-4">Sign in to get started with 15 free credits</p>
              <Button onClick={() => navigate('/auth')} size="lg">
                Sign In to Continue
              </Button>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Index;
