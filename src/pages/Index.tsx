import { useState, useEffect } from 'react';
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MessageSquareText, Youtube, CirclePlay } from "lucide-react";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [apiKeySet, setApiKeySet] = useState(true); // Set to true since we use a fixed key now
  const [showApiKeyForm, setShowApiKeyForm] = useState(false);
  const [aiModel, setAiModel] = useState('standard');

  useEffect(() => {
    // Check if this is running in a Chrome extension context
    const isExtension = window.location.protocol === 'chrome-extension:';
    
    if (isExtension && window.chrome?.storage) {
      // Get auth status from Chrome storage
      window.chrome.storage.local.get(['userToken', 'userInfo', 'aiApiKey', 'aiModel'], (result) => {
        if (result.userToken && result.userInfo) {
          setIsAuthenticated(true);
          setUserEmail(result.userInfo.email || '');
        }
        
        // API key is now fixed in the code (AIzaSyDxQpk6jmBsM5lsGdzRJKokQkwSVTk5sRg)
        setApiKeySet(true);
        setShowApiKeyForm(false);
        
        if (result.aiModel) {
          setAiModel(result.aiModel);
        }
        
        setIsLoading(false);
      });
    } else {
      // Web version - show message that this is meant for Chrome extension
      toast("Chrome Extension Required", 
        { description: "This application is designed to run as a Chrome extension." });
      setIsLoading(false);
    }
  }, []);

  const handleAuth = () => {
    if (window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
        if (response && response.success) {
          setIsAuthenticated(true);
          setUserEmail(response.userInfo?.email || '');
          
          toast("Authentication Successful", 
            { description: "You are now signed in with YouTube." });
        } else {
          toast("Authentication Failed", 
            { description: "Please try again." });
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
          toast("Videos Fetched", 
            { description: `${response.count} videos have been fetched from your YouTube account.` });
        } else {
          toast("Failed to Fetch Videos", 
            { description: "Please try again or check your connection." });
        }
      });
    }
  };

  const handleOpenDashboard = () => {
    if (window.chrome?.runtime && window.chrome?.tabs) {
      window.chrome.tabs.create({ url: window.chrome.runtime.getURL('dashboard.html') });
    } else {
      toast("Extension Context Required", 
        { description: "This feature is only available in the Chrome extension." });
    }
  };

  const handleSaveAiModel = (model) => {
    if (window.chrome?.runtime) {
      window.chrome.runtime.sendMessage({ 
        action: 'saveAiModel',
        aiModel: model
      }, (response) => {
        if (response && response.success) {
          setAiModel(model);
          toast("AI Model Updated", 
            { description: `Now using ${model === 'advanced' ? 'advanced' : 'Gemini 2.5 Flash'} model for summaries.` });
        } else {
          toast("Failed to Update AI Model", 
            { description: "Please try again." });
        }
      });
    }
  };

  const handleSignOut = () => {
    if (window.chrome?.storage) {
      window.chrome.storage.local.remove(['userToken', 'userInfo', 'likedVideos'], () => {
        setIsAuthenticated(false);
        setUserEmail('');
        
        toast("Signed Out", 
          { description: "You have been signed out of your YouTube account." });
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
                          toast("Export Started", 
                            { description: "Your data export has started. Please wait a moment." });
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
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Smart Video Summaries</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Get instant AI-generated summaries of any YouTube video in the video's original language.
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                          This feature adds a "Summarize Video" button to YouTube video pages and provides intelligent summaries in Arabic, English, Spanish, German, and more.
                        </p>
                        
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 mb-2">Available summarization modes:</p>
                          <div className="grid grid-cols-1 gap-2">
                            <div className="flex items-center justify-between p-2 bg-white rounded border">
                              <div>
                                <div className="font-medium text-sm">Quick Summary</div>
                                <div className="text-xs text-gray-500">2-3 min read • Brief overview</div>
                              </div>
                              <CirclePlay className="h-4 w-4 text-green-500" />
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-white rounded border">
                              <div>
                                <div className="font-medium text-sm">Detailed Summary</div>
                                <div className="text-xs text-gray-500">5-7 min read • Comprehensive analysis</div>
                              </div>
                              <CirclePlay className="h-4 w-4 text-blue-500" />
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex flex-col space-y-2">
                          <Button 
                            variant="default"
                            className="w-full"
                            onClick={() => {
                              toast("AI Summary Feature Active", 
                                { description: "You'll see the summarization panel on YouTube videos with 2 reliable modes." });
                            }}
                          >
                            Summarize Videos with Gemini
                          </Button>
                          
                          <div className="text-xs p-2 rounded-md border text-emerald-700 bg-emerald-50 border-emerald-100">
                            ✨ Simplified with 2 reliable modes for consistent language detection!
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded border border-gray-200 mt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Recent improvements:</h4>
                    <ul className="text-xs text-gray-600 space-y-2 list-disc pl-5">
                      <li>Simplified to 2 reliable summarization modes</li>
                      <li>Ultra-consistent language detection and matching</li>
                      <li>Better handling of long videos (40+ minutes)</li>
                      <li>Removed problematic prompts causing mixed languages</li>
                    </ul>
                  </div>
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
