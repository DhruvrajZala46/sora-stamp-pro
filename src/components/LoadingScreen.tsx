import { Video } from 'lucide-react';

interface LoadingScreenProps {
  progress?: number;
}

const LoadingScreen = ({ progress }: LoadingScreenProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center glass-card">
      <div className="text-center space-y-6">
        <Video className="w-20 h-20 mx-auto text-primary animate-pulse" />
        <div className="space-y-2">
          <h3 className="text-2xl font-bold">Adding watermarks...</h3>
          <p className="text-muted-foreground">
            This may take a few moments
          </p>
          {progress !== undefined && (
            <p className="text-sm text-primary font-medium">
              {Math.round(progress)}% complete
            </p>
          )}
        </div>
        <div className="flex justify-center gap-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
