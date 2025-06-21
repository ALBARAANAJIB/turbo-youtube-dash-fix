
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function YouTubeSummarizer() {
  const [videoUrl, setVideoUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSummarize = async () => {
    if (!videoUrl.trim()) {
      toast.error('Please enter a YouTube video URL');
      return;
    }

    if (!videoUrl.includes('youtube.com/watch') && !videoUrl.includes('youtu.be/')) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    setIsLoading(true);
    setSummary('');

    try {
      const response = await fetch('http://localhost:3000/api/summary/youtube', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSummary(data.summary);
        toast.success('Summary generated successfully!');
      } else {
        const errorMessage = data.error || 'Failed to generate summary';
        toast.error(errorMessage);
        console.error('Backend error:', data);
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('Failed to connect to backend. Make sure it\'s running on port 3000.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            YouTube Video Summarizer
          </CardTitle>
          <CardDescription className="text-center">
            Enter a YouTube URL to get an AI-powered summary
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="flex-1"
              disabled={isLoading}
            />
            <Button 
              onClick={handleSummarize} 
              disabled={isLoading}
              className="sm:w-auto w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Summarizing...
                </>
              ) : (
                'Summarize Video'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {summary}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
