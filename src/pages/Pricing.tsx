import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Navbar from "@/components/Navbar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const pricingPlans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Perfect for trying out our service",
    features: [
      "3 videos per month",
      "Basic watermark options",
      "Standard processing speed",
      "Email support",
    ],
    videoLimit: 3,
    highlighted: false,
    checkoutLink: null,
  },
  {
    name: "Pro",
    price: "$9",
    period: "month",
    description: "Great for content creators",
    features: [
      "100 videos per month",
      "All features included",
      "500MB max file size",
      "Priority processing",
      "HD video quality",
      "Custom watermark options",
    ],
    videoLimit: 100,
    highlighted: false,
    checkoutLink: "https://polar.sh/checkout/0dfb8146-7505-4dc9-b7ce-a669919533b2",
  },
  {
    name: "Unlimited",
    price: "$29",
    period: "month",
    description: "For professional video creators",
    features: [
      "Unlimited videos (500/month)",
      "Everything in Pro",
      "Custom watermark logo upload",
      "1GB max file size",
      "Ultra-fast processing",
      "Priority support",
      "4K video quality",
      "API access",
    ],
    videoLimit: 500,
    highlighted: true,
    checkoutLink: "https://polar.sh/checkout/240aaa37-f58b-4f9c-93ae-e0df52f0644c",
  },
];

export default function Pricing() {
  const navigate = useNavigate();
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('plan')
          .eq('user_id', user.id)
          .single();

        if (subscription) {
          setCurrentPlan(subscription.plan);
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: typeof pricingPlans[0]) => {
    if (!user) {
      toast.error("Please sign in to upgrade");
      navigate('/auth');
      return;
    }

    if (!plan.checkoutLink) {
      toast.info("You're already on the free plan");
      return;
    }

    // Redirect to Polar checkout
    window.location.href = plan.checkoutLink;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar user={user} plan={currentPlan} />
      
      <div className="container mx-auto px-4 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4 gradient-text">
            Choose Your Plan
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start with our free plan and upgrade as you grow
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {pricingPlans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative p-8 ${
                plan.highlighted
                  ? 'border-primary shadow-lg shadow-primary/20 scale-105'
                  : 'border-border'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleUpgrade(plan)}
                disabled={loading || currentPlan === plan.name.toLowerCase()}
                className={`w-full ${
                  plan.highlighted
                    ? 'bg-primary hover:bg-primary/90'
                    : 'bg-secondary hover:bg-secondary/90'
                }`}
              >
                {currentPlan === plan.name.toLowerCase()
                  ? 'Current Plan'
                  : plan.checkoutLink
                  ? 'Upgrade Now'
                  : 'Get Started'}
              </Button>
            </Card>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Can I change my plan later?</h3>
              <p className="text-muted-foreground">
                Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected immediately.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What happens if I exceed my video limit?</h3>
              <p className="text-muted-foreground">
                You'll be prompted to upgrade your plan. Your existing videos will remain safe.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Do you offer refunds?</h3>
              <p className="text-muted-foreground">
                Yes, we offer a 14-day money-back guarantee on all paid plans.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
