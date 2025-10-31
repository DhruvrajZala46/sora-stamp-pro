import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight } from 'lucide-react';

interface ServiceCardProps {
  title: string;
  description: string;
  credits: number;
  icon: React.ReactNode;
  onClick: () => void;
  featured?: boolean;
}

const ServiceCard = ({ title, description, credits, icon, onClick, featured }: ServiceCardProps) => {
  return (
    <Card className={`relative overflow-hidden group cursor-pointer transition-all duration-300 hover:scale-105 ${featured ? 'border-primary border-2' : ''}`} onClick={onClick}>
      {featured && (
        <div className="absolute top-4 right-4 z-10">
          <Badge className="bg-primary text-primary-foreground">Popular</Badge>
        </div>
      )}
      <div className="p-8 space-y-6">
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
          {icon}
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">{title}</h3>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold text-primary">{credits}</span>
            <span className="text-muted-foreground">credits</span>
          </div>
          <Button size="sm" className="group-hover:translate-x-1 transition-transform">
            Start <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

export default ServiceCard;