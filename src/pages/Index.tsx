
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageSquareText } from "lucide-react";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if this is running in a Chrome extension context
    const isExtension = window.location.protocol === 'chrome-extension:';
    
    if (isExtension && window.chrome?.storage) {
      // Get auth status from Chrome storage
      window.chrome.storage.local.get(['userToken', 'userInfo', 'aiApiKey'], (result) => {
        if (result.userToken && result.userInfo) {
          setIsAuthenticated(true);
          setUserEmail(result.userInfo.email || '');
        }
        
        if (result.aiApiKey) {
          setApiKey(result.aiApiKey);
        } else {
          setShowApiKeyForm(true);
        }
        
        setIsLoading(false);
      });
    } else {
      // Web version - show message that this is meant for Chrome extension
      toast({
        title: "Chrome Extension Required",
        description: "This application is designed to run as a Chrome extension.",
      });
      setIsLoading(false);
    }
  }, [toast]);

  const handleAuth = () => {
    if (window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
        if (response && response.success) {
          setIsAuthenticated(true);
          setUserEmail(response.userInfo?.email || '');
          
          toast({
            title: "Authentication Successful",
            description: "You are now signed in with YouTube.",
          });
        } else {
          toast({
            title: "Authentication Failed",
            description: "Please try again.",
            variant: "destructive",
          });
        }
      });
    }
  };

  const handleFetchVideos = () => {
    if (window.chrome?.runtime) {
      setIsLoading(true);
      
      window.chrome.runtime.sendMessage({ action: 'fetchLikedVideos' }, (response) => {
        setIsLoading(false);
        
        if (response && response.success) {
          toast({
            title: "Videos Fetched",
            description: `${response.count} videos have been fetched from your YouTube account.`,
          });
        } else {
          toast({
            title: "Failed to Fetch Videos",
            description: "Please try again or check your connection.",
            variant: "destructive",
          });
        }
      });
    }
  };

  const handleOpenDashboard = () => {
    if (window.chrome?.runtime && window.chrome?.tabs) {
      window.chrome.tabs.create({ url: window.chrome.runtime.getURL('dashboard.html') });
    } else {
      toast({
        title: "Extension Context Required",
        description: "This feature is only available in the Chrome extension.",
        variant: "destructive",
      });
    }
  };

  const handleSaveApiKey = () => {
    if (window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({ 
        action: 'saveApiKey',
        apiKey: apiKey
      }, (response) => {
        if (response && response.success) {
          toast({
            title: "API Key Saved",
            description: "Your AI service API key has been saved.",
          });
          setShowApiKeyForm(false);
        } else {
          toast({
            title: "Failed to Save API Key",
            description: "Please try again.",
            variant: "destructive",
          });
        }
      });
    }
  };

  const handleSignOut = () => {
    if (window.chrome?.storage) {
      window.chrome.storage.local.remove(['userToken', 'userInfo', 'likedVideos'], () => {
        setIsAuthenticated(false);
        setUserEmail('');
        
        toast({
          title: "Signed Out",
          description: "You have been signed out of your YouTube account.",
        });
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="text-gray-600">Please wait while we set up your YouTube Enhancer.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900">YouTube Enhancer</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage your liked videos efficiently
          </p>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          {!isAuthenticated ? (
            <div className="text-center">
              <p className="mb-4 text-gray-600">
                Login with your YouTube account to use this extension
              </p>
              <button
                onClick={handleAuth}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Sign in with YouTube
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center mb-6 pb-4 border-b border-gray-200">
                <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-700 font-medium">
                    {userEmail.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="ml-3 text-gray-700">{userEmail}</span>
              </div>

              {showApiKeyForm && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="text-lg font-medium text-blue-800 mb-2">AI Summary Setup</h3>
                  <p className="text-sm text-blue-600 mb-4">
                    To use the AI summary feature, please enter your OpenAI API key. 
                    You can get one from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="underline">OpenAI's website</a>.
                  </p>
                  <div className="flex flex-col space-y-2">
                    <input 
                      type="text" 
                      placeholder="Enter your OpenAI API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <Button 
                      onClick={handleSaveApiKey}
                      disabled={!apiKey}
                      className="w-full"
                    >
                      Save API Key
                    </Button>
                  </div>
                </div>
              )}

              <Tabs defaultValue="videos" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="videos">Video Management</TabsTrigger>
                  <TabsTrigger value="ai">AI Features</TabsTrigger>
                </TabsList>
                
                <TabsContent value="videos" className="space-y-4">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">YouTube Features</h2>

                  <div className="space-y-4">
                    <button
                      onClick={handleFetchVideos}
                      className="w-full flex justify-between items-center px-4 py-3 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                    >
                      <span>Fetch 50 liked videos</span>
                      <span className="text-gray-400">→</span>
                    </button>

                    <button
                      onClick={handleOpenDashboard}
                      className="w-full px-4 py-3 bg-purple-600 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-purple-700 focus:outline-none"
                    >
                      Open Dashboard
                    </button>

                    <button
                      onClick={() => {
                        if (window.chrome?.runtime) {
                          window.chrome.runtime.sendMessage({ action: 'exportData' });
                          toast({
                            title: "Export Started",
                            description: "Your data export has started. Please wait a moment."
                          });
                        }
                      }}
                      className="w-full flex justify-between items-center px-4 py-3 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
                    >
                      <span>Export data</span>
                      <span className="text-gray-400">→</span>
                    </button>
                  </div>
                </TabsContent>
                
                <TabsContent value="ai" className="space-y-4">
                  <div className="bg-gradient-to-r from-purple-100 to-indigo-100 p-4 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="bg-indigo-600 rounded-full p-2 mt-1">
                        <MessageSquareText className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">AI Video Summaries</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Get instant AI-generated summaries of any YouTube video you're watching.
                          {!apiKey && " You'll need to set up your API key first."}
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                          This feature will add a "Summarize Video" button to your YouTube video page.
                        </p>
                        <div className="flex flex-col space-y-2">
                          <Button 
                            variant={apiKey ? "default" : "secondary"}
                            className="w-full"
                            disabled={!apiKey}
                            onClick={() => {
                              toast({
                                title: "AI Summary Feature Active",
                                description: "You'll see a 'Summarize Video' button on YouTube videos.",
                              });
                            }}
                          >
                            {apiKey ? "Summarize Videos" : "API Key Required"}
                          </Button>
                          
                          {apiKey && (
                            <Button 
                              variant="outline"
                              className="w-full"
                              onClick={() => setShowApiKeyForm(true)}
                            >
                              Change API Key
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {apiKey && (
                    <div className="bg-gray-50 p-4 rounded border border-gray-200 mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Coming soon:</h4>
                      <ul className="text-xs text-gray-600 space-y-2 list-disc pl-5">
                        <li>Batch summarization of multiple videos</li>
                        <li>Custom summary formats and lengths</li>
                        <li>Topic extraction and keyword analysis</li>
                        <li>Video recommendations based on your interests</li>
                      </ul>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <div className="mt-8 text-center">
                <button
                  onClick={handleSignOut}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
